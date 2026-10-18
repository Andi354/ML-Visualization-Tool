"""The tools of the agent (feature C): what it can do in the tool, and how freely.

Each tool has a kind that decides, together with the mode, whether it runs at once or waits for a click:

- `read`: looks things up, never changes the tool
- `nav`: changes what Tim sees (tabs, filters, applying a template, a widget draft)
- `change`: changes the analysis or writes files (widgets, templates, saving)

Mode Direkt runs everything at once, Gemischt asks for `change`, Bestätigen asks for `nav` and `change`.
Reads run in the backend; everything else is a command the browser executes (`web/src/agent/commands.ts`).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable

from . import agent_guide, aggregate, configview, own_widgets, store, widgets
from .listing import merkmal_candidates, run_listing
from .project import Project
from .agent_store import MAX_INSTRUCTIONS
from . import progress
from .project import now as clock
from .notes import NoteStore, clean_anchor
from .runs import get_run, list_runs
from .settings import SettingsStore
from .templates import TemplateStore

READ, NAV, CHANGE = "read", "nav", "change"


def needs_confirmation(mode: str, kind: str) -> bool:
    if kind == READ:
        return False
    if mode == "direct":
        return False
    if mode == "confirm":
        return True
    return kind == CHANGE  # mixed (and anything unknown): ask for changes only


def asks(tool: "Tool", mode: str) -> bool:
    """Does this call wait for a click? The mode decides, except for a tool that always asks."""
    return tool.always_confirm or needs_confirmation(mode, tool.kind)


@dataclass
class Tool:
    name: str
    kind: str
    description: str
    properties: dict[str, Any] = field(default_factory=dict)
    required: list[str] = field(default_factory=list)
    #: "backend" tools are answered here, "browser" tools are commands for the open tool
    side: str = "browser"
    #: shown as "Bestätigen · <what>" and as the action line if the browser gives no better text
    describe: Callable[[dict], str] = lambda a: ""
    #: further lines on the confirmation card (e.g. the target folder of a save)
    details: Callable[[dict], list[str]] = lambda a: []
    #: not an action of the agent worth a line in the chat (looking at the view)
    silent: bool = False
    #: asks for a click in every mode, also in Direkt (what outlives the chat, like the project instructions)
    always_confirm: bool = False
    #: checks the arguments before anything is shown or done; raises ValueError with a message for the agent
    check: Callable[[dict], None] = lambda a: None

    def schema(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": {"type": "object", "properties": self.properties, "required": self.required, "additionalProperties": False},
        }


def _s(description: str, **extra) -> dict:
    return {"type": "string", "description": description, **extra}


_SCOPE = _s("Ansicht der Analyse: one (Ein Lauf), two (Zwei Läufe) oder project (Projektverlauf)", enum=["one", "two", "project"])
_SETTINGS = {"type": "object", "description": "Einstellungen des Widgets (Schlüssel wie im Katalog), Werte als Text", "additionalProperties": {"type": ["string", "null"]}}
_WIDTH = _s("half (halbe Zeile) oder full (volle Zeile)", enum=["half", "full"])
_RUN = _s("Lauf-ID (Ordnername) oder ein eindeutiger Teil davon")


def _short(run: str | None) -> str:
    import re

    return re.sub(r"^\d{4}-\d{2}-\d{2}_\d{4,6}_", "", str(run or ""))


TOOLS: dict[str, Tool] = {}


def _add(tool: Tool) -> None:
    TOOLS[tool.name] = tool


# --- read (backend) -------------------------------------------------------------------------------
_add(Tool("help", READ, "Erklärt, was der Agent im Tool kann und was nicht, und wie die Teile des Tools zusammenhängen. Ohne Thema das Inhaltsverzeichnis; "
          "zum Einstieg das Thema faehigkeiten. Aufrufen, wenn der Nutzer fragt, was du kannst, oder wenn du unsicher bist.", {
    "topic": _s("Thema aus dem Inhaltsverzeichnis, z. B. faehigkeiten, widgets, eigene-widgets, modi"),
}, side="backend", silent=True))
_add(Tool("find_runs", READ, "Sucht Läufe nach Text (Name, ID, Kurzbeschreibung, Zweck, „Soll zeigen“), Issue, Datum, Zustand, Lauf-Merkmal (z. B. pred_len) oder Grid-Achse.", {
    "text": _s("Teil des Namens, der ID oder der Beschreibung (short, purpose, shows)"), "issue": _s("Issue-ID, z. B. TIM-52"),
    "date_from": _s("ab Datum YYYY-MM-DD"), "date_to": _s("bis Datum YYYY-MM-DD"),
    "state": _s("finished, running oder stalled"),
    "feature": {"type": "object", "description": "Lauf-Merkmal und Wert, z. B. {\"pred_len\": \"30\"}", "additionalProperties": {"type": "string"}},
    "axis": _s("Name einer Grid-Achse, die der Lauf variiert"),
    "limit": {"type": "integer", "description": "höchstens so viele Treffer (Standard 20)"},
}, side="backend"))
_add(Tool("read_run", READ, "Liest Ergebnisse (summary: beste Gruppen je Metrik) oder die Konfiguration (config) eines Laufs.", {
    "run": _RUN, "part": _s("summary oder config", enum=["summary", "config"]),
}, ["run"], side="backend"))
_add(Tool("run_progress", READ, "Fortschritt eines Laufs: Zellen fertig und geplant, fehlgeschlagene, Tempo, Restzeit, voraussichtlich fertig, hängt seit.", {
    "run": _RUN,
}, ["run"], side="backend"))
_add(Tool("read_notes", READ, "Liest die eigenen Notizen des Nutzers zu einem Lauf (am Lauf, an Abschnitten der Beschreibung, an Gruppen der Tabelle).", {
    "run": _RUN,
}, ["run"], side="backend"))
_add(Tool("propose_note", CHANGE, "Schlägt dem Nutzer eine Notiz zu einem Lauf vor. Sie wird nie ohne seine Bestätigung gespeichert: im Chat fragt eine Karte, danach erscheint der Vorschlag in der Notizspalte des Lauf-Tabs.", {
    "run": _RUN, "text": _s("Text der Notiz, Markdown ist erlaubt"),
    "anchor": {"type": "object", "description": "Woran die Notiz hängt: {kind: run} (Standard), {kind: section, key: purpose|shows|expectation|notes} oder {kind: group, key: \"lstm_layer=2 · lr_epochs=40\"}",
               "properties": {"kind": {"type": "string", "enum": ["run", "section", "group"]}, "key": {"type": "string"}}},
}, ["run", "text"], describe=lambda a: "Notiz vorschlagen", always_confirm=True))
_add(Tool("list_widgets", READ, "Listet die Widgets (Katalog und eigene) einer Analyse-Ansicht mit Einstellungen.", {"scope": _SCOPE}, side="backend"))
_add(Tool("list_templates", READ, "Listet die gespeicherten Vorlagen (Boards ohne Läufe) einer Analyse-Ansicht.", {"scope": _SCOPE}, side="backend"))
_add(Tool("choose_run", READ, "Fragt den Nutzer, welcher von mehreren Läufen gemeint ist (anklickbare Karten). Liefert die gewählte Lauf-ID.", {
    "question": _s("kurze Rückfrage"), "runs": {"type": "array", "items": {"type": "string"}, "description": "Kandidaten (Lauf-IDs)"},
}, ["runs"], side="backend"))

# --- read (browser) -------------------------------------------------------------------------------
_add(Tool("get_view", READ, "Der ganze aktuelle Zustand der Ansicht als JSON: Bereich, Tabs, Analyse-Ansicht, Läufe, Widgets des Boards mit IDs, Einstellungen und Zustand (`state`: loading, ok, error, unavailable, gone; `reason`), Vorlage, Entwurf.", silent=True))

# --- navigate ---------------------------------------------------------------------------------------
_add(Tool("open_run", NAV, "Öffnet einen Lauf als Tab (oder fokussiert ihn, wenn er offen ist).", {"run": _RUN}, ["run"],
          describe=lambda a: f"Lauf öffnen · {_short(a.get('run'))}"))
_add(Tool("focus_tab", NAV, "Fokussiert einen offenen Tab; run=\"pinned\" für den festen Tab.", {"run": _RUN}, ["run"],
          describe=lambda a: f"Tab fokussieren · {_short(a.get('run'))}"))
_add(Tool("close_tab", NAV, "Schließt den Tab eines Laufs.", {"run": _RUN}, ["run"], describe=lambda a: f"Tab schließen · {_short(a.get('run'))}"))
_add(Tool("show_runs", NAV, "Wechselt in Läufe zwischen Liste und Issues.", {"view": _s("list oder issues", enum=["list", "issues"])}, ["view"],
          describe=lambda a: "Läufe · " + ("Issues" if a.get("view") == "issues" else "Liste")))
_add(Tool("open_analysis", NAV, "Öffnet die Analyse in einer Ansicht und mit den Läufen dafür (one: 1 Lauf, two: 2 Läufe, project: keine nötig).", {
    "scope": _SCOPE, "runs": {"type": "array", "items": {"type": "string"}, "description": "Lauf-IDs"},
}, ["scope"], describe=lambda a: {"one": "Analyse · Ein Lauf", "two": "Analyse · Zwei Läufe", "project": "Analyse · Projektverlauf"}.get(a.get("scope"), "Analyse öffnen") + (
    " · " + " ↔ ".join(_short(r) for r in a.get("runs") or []) if a.get("runs") else "")))
_add(Tool("set_run_view", NAV, "Stellt in einem Lauf-Tab Filter und Sortierung ein. filters: Dimension → Liste gewählter Werte (leere Liste = Filter entfernen).", {
    "run": _RUN, "filters": {"type": "object", "additionalProperties": {"type": "array", "items": {"type": "string"}}},
    "sort": {"type": "object", "properties": {"metric": {"type": "string"}, "stat": {"type": "string"}, "dir": {"type": "string", "enum": ["asc", "desc"]}}},
}, ["run"], describe=lambda a: f"Ansicht einstellen · {_short(a.get('run'))}"))
_add(Tool("apply_template", NAV, "Wendet eine Vorlage ('Standard' oder eine gespeicherte) auf das Board der aktuellen Analyse-Ansicht an.", {
    "name": _s("Name der Vorlage"), "scope": _SCOPE,
}, ["name"], describe=lambda a: f"Vorlage anwenden · {a.get('name')}"))
_add(Tool("draft_widget", NAV, "Zeigt einen Entwurf für ein eigenes Widget (Vega-Lite-Beschreibung) zuerst im Board. Der Nutzer behält oder verwirft ihn.", {
    "definition": {"type": "object", "description": "Beschreibung des eigenen Widgets (name, question, scope, width, params, data, spec)"},
}, ["definition"], describe=lambda a: f"Widget-Entwurf · {(a.get('definition') or {}).get('name', '')}"))

# --- change ---------------------------------------------------------------------------------------
_add(Tool("add_widget", CHANGE, "Fügt dem Board der aktuellen Analyse ein Widget hinzu (type aus list_widgets).", {
    "type": _s("Widget-Schlüssel"), "settings": _SETTINGS, "width": _WIDTH,
}, ["type"], describe=lambda a: f"Widget hinzufügen · {a.get('type')}"))
_add(Tool("remove_widget", CHANGE, "Entfernt ein Widget vom Board (ID oder Typ aus get_view).", {"widget": _s("Widget-ID oder -Typ")}, ["widget"],
          describe=lambda a: f"Widget entfernen · {a.get('widget')}"))
_add(Tool("configure_widget", CHANGE, "Ändert die Einstellungen eines Widgets auf dem Board.", {"widget": _s("Widget-ID oder -Typ"), "settings": _SETTINGS}, ["widget", "settings"],
          describe=lambda a: f"Widget einstellen · {a.get('widget')}",
          details=lambda a: [f"{k}: {v}" for k, v in (a.get("settings") or {}).items()]))
_add(Tool("move_widget", CHANGE, "Verschiebt ein Widget im Board.", {"widget": _s("Widget-ID oder -Typ"), "direction": _s("up oder down", enum=["up", "down"]), "steps": {"type": "integer"}}, ["widget", "direction"],
          describe=lambda a: f"Widget verschieben · {a.get('widget')} {'↑' if a.get('direction') == 'up' else '↓'}"))
_add(Tool("resize_widget", CHANGE, "Setzt die Breite eines Widgets.", {"widget": _s("Widget-ID oder -Typ"), "width": _WIDTH}, ["widget", "width"],
          describe=lambda a: f"Widget-Breite · {a.get('widget')} → {'volle' if a.get('width') == 'full' else 'halbe'} Breite"))
_add(Tool("save_template", CHANGE, "Speichert das aktuelle Board als Vorlage (gleicher Name überschreibt).", {"name": _s("Name der Vorlage")}, ["name"],
          describe=lambda a: f"Vorlage speichern · {a.get('name')}"))
_add(Tool("keep_draft", CHANGE, "Behält den offenen Widget-Entwurf als eigenes Widget.", describe=lambda a: "Entwurf behalten"))
_add(Tool("save_deliverable", CHANGE, "Speichert Widgets des Boards als Bilder im Deliverable-Ordner des Projekts (ein Bild je Widget).", {
    "title": _s("Titel des Ordners"), "widgets": {"type": "array", "items": {"type": "string"}, "description": "Widget-IDs oder -Typen (leer = alle)"},
}, ["title"], describe=lambda a: f"Deliverable speichern · {a.get('title')}",
          details=lambda a: [f"Titel: {a.get('title')}"] + ([f"Widgets: {', '.join(a['widgets'])}"] if a.get("widgets") else ["Widgets: alle"])))


def _check_instructions(a: dict) -> None:
    text = a.get("text")
    if not isinstance(text, str):
        raise ValueError("text fehlt: der ganze neue Text der Anweisungen")
    if len(text.strip()) > MAX_INSTRUCTIONS:
        raise ValueError(f"Die Anweisungen dürfen höchstens {MAX_INSTRUCTIONS} Zeichen haben (hier {len(text.strip())}). Fass sie kürzer.")


_add(Tool("set_instructions", CHANGE, "Schreibt die Projekt-Anweisungen des Nutzers neu (der ganze neue Text ersetzt den bisherigen, leerer Text löscht sie). "
          "Nur auf ausdrücklichen Wunsch des Nutzers im Chat, nie von dir aus. Fragt in jedem Modus nach. Siehe help, Thema anweisungen.", {
    "text": _s(f"der ganze neue Text, höchstens {MAX_INSTRUCTIONS} Zeichen"),
}, ["text"], describe=lambda a: "Projekt-Anweisungen ändern", always_confirm=True, check=_check_instructions))


def catalog() -> list[dict]:
    return [t.schema() for t in TOOLS.values()]


# --- reads ----------------------------------------------------------------------------------------
def _resolve(project: Project, run_ref: str):
    """A run by exact id or by a part of it (None / list when unknown / ambiguous)."""
    run = get_run(project, run_ref)
    if run is not None:
        return run, []
    hits = [r for r in list_runs(project) if run_ref and run_ref.lower() in r.id.lower()]
    return (hits[0], []) if len(hits) == 1 else (None, [r.id for r in hits])


def resolve_runs(project: Project, args: dict) -> dict:
    """Run references of a command (`run`, `runs`) become exact run ids; unknown or ambiguous ones are an error for the agent."""

    def one(ref: str) -> str:
        if ref == "pinned":
            return ref
        run, many = _resolve(project, ref)
        if run is not None:
            return run.id
        if many:
            raise ValueError(f"Mehrere Läufe passen auf „{ref}“: {', '.join(many)}. Frag den Nutzer mit choose_run, welcher gemeint ist.")
        raise ValueError(f"Es gibt keinen Lauf „{ref}“. find_runs hilft beim Suchen.")

    out = dict(args)
    if isinstance(out.get("run"), str):
        out["run"] = one(out["run"])
    if isinstance(out.get("runs"), list):
        out["runs"] = [one(str(r)) for r in out["runs"]]
    return out


def resolve_runs_lenient(project: Project, refs: list) -> list[str]:
    """Candidates for choose_run: every reference that names exactly one run (the rest is dropped)."""
    out = []
    for ref in refs:
        run, _ = _resolve(project, str(ref))
        if run is not None and run.id not in out:
            out.append(run.id)
    return out


def deliverable_target(project: Project, title: str) -> str:
    """Folder a save of the agent writes to: the deliverables folder, `<date> <title>` (as the save dialog does)."""
    from .project import now

    base = (project.to_json().get("paths") or {}).get("deliverables") or "deliverables"
    return f"{base}/{now().date().isoformat()} {title}".replace("//", "/")


def _text_matches(run, info: dict, text: str) -> bool:
    """The search text is part of the run ID or of its description (`short`, `purpose`, `shows`)."""
    needle = text.lower()
    if needle in info["id"].lower() or needle in (info.get("short") or "").lower():
        return True
    if not info.get("has_description"):
        return False
    description = store.read_description(run.path) or {}
    shows = description.get("shows") or []
    hay = [str(description.get("purpose") or ""), *(str(x) for x in (shows if isinstance(shows, list) else [shows]))]
    return needle in " ".join(hay).lower()


def run_tool(project: Project, name: str, args: dict) -> Any:
    """Answers a backend tool. Raises ValueError with a German message for the agent."""
    if name == "help":
        return agent_guide.read(args.get("topic"))
    if name == "find_runs":
        runs = list_runs(project)
        candidates = merkmal_candidates(runs)
        out = []
        for r in runs:
            info = run_listing(project, r, candidates)
            started = str(info.get("started") or "")[:10]
            if args.get("text") and not _text_matches(r, info, str(args["text"])):
                continue
            if args.get("issue") and (info.get("issue") or "").lower() != str(args["issue"]).lower():
                continue
            if args.get("date_from") and started < args["date_from"]:
                continue
            if args.get("date_to") and started > args["date_to"]:
                continue
            if args.get("state") and info.get("state") != args["state"]:
                continue
            if args.get("axis") and args["axis"] not in (info.get("axes") or []):
                continue
            cfg = info.get("config_values") or {}
            if any(not any(k.split(".", 1)[-1] == f and str(v) == str(want) for k, v in cfg.items()) for f, want in (args.get("feature") or {}).items()):
                continue
            out.append({k: info.get(k) for k in ("id", "name", "issue", "short", "started", "state", "axes", "cells", "planned", "best", "merkmal", "notes")})
        out.sort(key=lambda i: str(i["started"] or ""), reverse=True)
        limit = int(args.get("limit") or 20)
        return {"count": len(out), "runs": out[:limit]}
    if name == "read_run":
        run, many = _resolve(project, str(args.get("run") or ""))
        if run is None:
            raise ValueError("Mehrere Läufe passen: " + ", ".join(many) if many else "Lauf nicht gefunden")
        if args.get("part") == "config":
            return _clip(configview.run_config(project, run, {}))
        table = aggregate.run_table(run, project, {})
        rows = [{"group": r["params"], "n": r["n"], "mean": {m: v["mean"] for m, v in list(r["metrics"].items())[:6]}} for r in table["rows"][:10]]
        return _clip({"run": run.id, "sorted_by": table["sort"], "groups": table["groups"], "cells": table["cells"], "best": table["best"], "rows": rows})
    if name == "run_progress":
        run, many = _resolve(project, str(args.get("run") or ""))
        if run is None:
            raise ValueError("Mehrere Läufe passen: " + ", ".join(many) if many else "Lauf nicht gefunden")
        p = progress.run_progress(run, clock(), int(SettingsStore(project).get("runs.stallMin")))
        return {k: p[k] for k in ("state", "cells_done", "cells_planned", "cells_failed", "rate_per_hour", "remaining", "eta", "last_cell_at", "stalled_since")}
    if name == "read_notes":
        run, many = _resolve(project, str(args.get("run") or ""))
        if run is None:
            raise ValueError("Mehrere Läufe passen: " + ", ".join(many) if many else "Lauf nicht gefunden")
        return {"run": run.id, "notes": [{k: n[k] for k in ("id", "text", "anchor", "created", "by")} for n in NoteStore(project).list(run.id)]}
    if name == "list_widgets":
        scope = args.get("scope")
        cat_scope = {"one": "run", "two": "two-runs", "project": "project"}.get(scope)
        own = [{**own_widgets.catalog_entry(d)} for d in own_widgets.OwnWidgetStore(project).list()]
        entries = widgets.catalog(cat_scope) + [e for e in own if cat_scope is None or cat_scope in e["scopes"]]
        return [{k: e.get(k) for k in ("key", "label", "question", "settings", "optional", "width")} for e in entries]
    if name == "list_templates":
        return [{"name": "Standard", "built_in": True}] + [
            {"name": t["name"], "scope": t["scope"], "widgets": [w["type"] for w in t["widgets"]], "last_used": t.get("last_used")}
            for t in TemplateStore(project).list(args.get("scope"))
        ]
    raise KeyError(name)


def _clip(value: Any, limit: int = 8000) -> Any:
    text = json.dumps(value, ensure_ascii=False, default=str)
    return value if len(text) <= limit else {"truncated": True, "text": text[:limit]}
