"""Own widgets: a declarative description (Vega-Lite with a thin wrapper) instead of code.

The agent writes the description, the tool validates and renders it (feature E). A kept widget is one JSON
file in `<project>/.mlviz/widgets/<slug>.json`:

    { name, question, scope: "one" | "two" | "project", width: "half" | "full",
      title?, subtitle?,
      params: [{ name, label, options, default }],
      data: { source, filter },
      spec: <Vega-Lite without data> }

`data.source` is one of the datasets the tool provides (`cells`, `channels`, `curves`, `predictions`, `runs`,
see `own_data.py`); `filter` is a mapping column -> value. Values in `filter` and strings in `spec` may refer to
a param as `{{param.<name>}}`. The tool draws the widget with its own theme, so the spec sets no colours or fonts.
"""

from __future__ import annotations

import copy
import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

from .own_data import SOURCES, SCOPE_OF, rows_for
from .project import Project

WIDGETS_DIR = "widgets"
KEY_PREFIX = "own:"
#: The marks the tool can theme to its tokens. A spec with another mark is refused.
MARKS = ("bar", "line", "point", "area", "rect", "text", "tick")
SCOPES = tuple(SCOPE_OF)  # one, two, project
WIDTHS = ("half", "full")
_PARAM = re.compile(r"\{\{\s*param\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}")
_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,59}$")
#: Keys that would set colours or fonts: the theme of the tool owns them.
_COLOUR_KEYS = {"color", "fill", "stroke"}
_FORBIDDEN_TOP = ("data", "datasets", "config")


class OwnWidgetError(ValueError):
    """A description that cannot be saved or drawn; `errors` lists the reasons (German, for the user and the agent)."""

    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


# --- validation ----------------------------------------------------------------------------------
def _walk(node: Any, path: str = "spec"):
    yield path, node
    if isinstance(node, dict):
        for k, v in node.items():
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk(v, f"{path}[{i}]")


def spec_errors(spec: Any) -> list[str]:
    if not isinstance(spec, dict):
        return ["spec ist keine Beschreibung (Objekt)"]
    errors = [f"spec.{k} ist nicht erlaubt: die Daten liefert das Tool" if k != "config" else "spec.config ist nicht erlaubt: das Tool setzt Farben und Schrift selbst" for k in _FORBIDDEN_TOP if k in spec]
    marks = []
    for path, node in _walk(spec):
        if not isinstance(node, dict):
            continue
        for key in node:
            if re.match(r"(?i).*font.*", key):
                errors.append(f"{path}.{key}: Schrift setzt das Tool selbst")
            if key == "scheme" or (key == "range" and path.endswith(".scale")):
                errors.append(f"{path}.{key}: Farben setzt das Tool selbst")
        if "mark" in node:
            mark = node["mark"]
            mtype = mark.get("type") if isinstance(mark, dict) else mark
            marks.append((path, mtype))
            if isinstance(mark, dict):
                for c in _COLOUR_KEYS & set(mark):
                    errors.append(f"{path}.mark.{c}: Farben setzt das Tool selbst (Farbe nur über encoding.color mit einem Feld)")
        for channel in _COLOUR_KEYS & set(node):
            enc = node[channel]
            if path.endswith(".encoding") and isinstance(enc, dict) and "value" in enc:
                errors.append(f"{path}.{channel}: eine feste Farbe ist nicht erlaubt, Farbe nur über ein Feld")
    if not marks:
        errors.append("spec hat keine Mark (zum Beispiel mark: bar)")
    for path, mtype in marks:
        if mtype not in MARKS:
            errors.append(f"{path}.mark {mtype!r} geht nicht, erlaubt sind {', '.join(MARKS)}")
    return errors


def validate(defn: Any) -> list[str]:
    """All reasons why a description is not valid; empty when it is."""
    if not isinstance(defn, dict):
        return ["Die Beschreibung ist kein Objekt"]
    errors: list[str] = []
    name = defn.get("name")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 60:
        errors.append("name fehlt oder ist länger als 60 Zeichen")
    elif not slugify(name):
        errors.append("name enthält keine Buchstaben oder Ziffern")
    if not isinstance(defn.get("question"), str) or not defn["question"].strip():
        errors.append("question fehlt (die Frage, die das Widget beantwortet)")
    if defn.get("scope") not in SCOPES:
        errors.append(f"scope muss {', '.join(SCOPES)} sein")
    if defn.get("width", "half") not in WIDTHS:
        errors.append("width muss half oder full sein")
    params = defn.get("params", [])
    names: set[str] = set()
    if not isinstance(params, list):
        errors.append("params ist keine Liste")
        params = []
    for i, p in enumerate(params):
        if not isinstance(p, dict) or not isinstance(p.get("name"), str) or not _NAME.match(p["name"]):
            errors.append(f"params[{i}].name fehlt oder ist kein Name (Buchstaben, Ziffern, _)")
            continue
        if p["name"] in names:
            errors.append(f"params[{i}].name {p['name']!r} kommt doppelt vor")
        names.add(p["name"])
        opts = p.get("options")
        if not isinstance(opts, list) or not opts or not all(isinstance(o, str) for o in opts):
            errors.append(f"params[{i}].options braucht eine Liste von Texten")
        elif p.get("default") not in opts:
            errors.append(f"params[{i}].default muss eine der options sein")
    data = defn.get("data")
    if not isinstance(data, dict) or data.get("source") not in SOURCES:
        errors.append(f"data.source muss {', '.join(SOURCES)} sein")
    elif not isinstance(data.get("filter", {}), dict):
        errors.append("data.filter ist keine Zuordnung (Spalte: Wert)")
    errors.extend(spec_errors(defn.get("spec")))
    used = {m for _, node in _walk(defn.get("spec")) if isinstance(node, str) for m in _PARAM.findall(node)}
    used |= {m for v in (data or {}).get("filter", {}).values() if isinstance(v, str) for m in _PARAM.findall(v)} if isinstance(data, dict) and isinstance(data.get("filter", {}), dict) else set()
    errors.extend(f"{{{{param.{u}}}}} verweist auf einen Parameter, den es nicht gibt" for u in sorted(used - names))
    return errors


_GERMAN = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss"})


def slugify(name: str) -> str:
    text = unicodedata.normalize("NFKD", name.translate(_GERMAN)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:60]


# --- storage -------------------------------------------------------------------------------------
class OwnWidgetStore:
    def __init__(self, project: Project):
        self.dir = project.root / ".mlviz" / WIDGETS_DIR

    def _file(self, slug: str) -> Path:
        if not _SLUG.match(slug or ""):
            raise KeyError(slug)
        return self.dir / f"{slug}.json"

    def get(self, slug: str) -> dict:
        try:
            return json.loads(self._file(slug).read_text())
        except (OSError, ValueError):
            raise KeyError(slug) from None

    def list(self) -> list[dict]:
        out = []
        for f in sorted(self.dir.glob("*.json")) if self.dir.is_dir() else []:
            try:
                d = json.loads(f.read_text())
            except (OSError, ValueError):
                continue
            if isinstance(d, dict) and not validate(d):
                out.append({**d, "slug": f.stem})
        return out

    def save(self, defn: dict) -> dict:
        errors = validate(defn)
        if errors:
            raise OwnWidgetError(errors)
        slug = slugify(defn["name"])
        clean = {**defn, "name": defn["name"].strip(), "width": defn.get("width", "half"), "params": defn.get("params", [])}
        self.dir.mkdir(parents=True, exist_ok=True)
        tmp = self._file(slug).with_suffix(".tmp")
        tmp.write_text(json.dumps(clean, ensure_ascii=False, indent=2))
        os.replace(tmp, self._file(slug))
        return {**clean, "slug": slug}

    def delete(self, slug: str) -> None:
        try:
            self._file(slug).unlink()
        except OSError:
            raise KeyError(slug) from None


# --- as catalog entries and widget results -----------------------------------------------------------
def catalog_entry(defn: dict) -> dict:
    """An own widget in the shape of a catalog entry (the frontend merges it into the "Eigene" menu)."""
    settings = []
    for p in defn.get("params", []):
        opts = p["options"]
        settings.append(
            {
                "key": p["name"],
                "label": p.get("label") or p["name"],
                "type": "seg" if len(opts) <= 4 else "select",
                "options": [{"value": o, "label": o} for o in opts],
                "default": p["default"],
            }
        )
    scope = SCOPE_OF[defn["scope"]]
    return {
        "key": KEY_PREFIX + defn["slug"] if "slug" in defn else KEY_PREFIX + slugify(defn["name"]),
        "label": defn["name"],
        "question": defn["question"],
        "scopes": [scope],
        "settings": settings,
        "requires": None,
        "exportable": True,
        "optional": False,
        "width": defn.get("width", "half"),
        "own": True,
    }


def _fill(node: Any, values: dict[str, str]) -> Any:
    """`{{param.x}}` replaced by the value of the param, in every string of a description."""
    if isinstance(node, str):
        return _PARAM.sub(lambda m: str(values.get(m.group(1), m.group(0))), node)
    if isinstance(node, list):
        return [_fill(v, values) for v in node]
    if isinstance(node, dict):
        return {k: _fill(v, values) for k, v in node.items()}
    return node


def compute(project: Project, defn: dict, request: dict) -> dict:
    """Result of an own widget (or a draft) for the board in `request`: rows for the spec and the spec itself."""
    errors = validate(defn)
    if errors:
        return {"unavailable": "Widget kann nicht gezeichnet werden: " + "; ".join(errors)}
    values = {p["name"]: p["default"] for p in defn.get("params", [])}
    for k, v in (request.get("settings") or {}).items():
        param = next((p for p in defn.get("params", []) if p["name"] == k), None)
        if param and v in param["options"]:
            values[k] = v
    data = defn["data"]
    flt = _fill(data.get("filter", {}), values)
    try:
        rows = rows_for(project, data["source"], defn["scope"], request, flt)
    except LookupError as e:
        return {"unavailable": f"Widget kann nicht gezeichnet werden: {e}"}
    if not rows:
        return {"unavailable": "Widget kann nicht gezeichnet werden: keine Daten für diese Auswahl"}
    spec = _fill(copy.deepcopy(defn["spec"]), values)
    return {
        "title": defn.get("title") or defn["name"],
        "subtitle": defn.get("subtitle"),
        "note": None,
        "options": {p["name"]: p["options"] for p in defn.get("params", [])},
        "data": {"rows": rows, "spec": spec, "name": defn["name"], "values": values},
    }
