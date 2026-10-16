"""Templates (Vorlagen) of analysis boards (feature D): a board without runs.

A template is `{ name, scope: "one" | "two" | "project", widgets: [{ type, settings, width }], last_used: { runs, at } }`:
the visible widgets in order with their settings and width, and the runs it was last used on (the agent can
use them for "wie letzte Woche"). They are stored per project in `<project>/.mlviz/templates.json`. The built-in
template "Standard" of each scope is the default board of v0.1; it is not stored and cannot be overwritten or deleted.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .project import Project, now

BUILTIN = "Standard"
SCOPES = ("one", "two", "project")
WIDTHS = ("half", "full")
MAX_NAME = 60


class TemplateError(ValueError):
    pass


def _clean_widgets(widgets: Any) -> list[dict]:
    if not isinstance(widgets, list):
        raise TemplateError("widgets ist keine Liste")
    out = []
    for i, w in enumerate(widgets):
        if not isinstance(w, dict) or not isinstance(w.get("type"), str) or not w["type"]:
            raise TemplateError(f"widgets[{i}].type fehlt")
        settings = w.get("settings") or {}
        if not isinstance(settings, dict):
            raise TemplateError(f"widgets[{i}].settings ist keine Zuordnung")
        width = w.get("width", "half")
        if width not in WIDTHS:
            raise TemplateError(f"widgets[{i}].width muss half oder full sein")
        out.append({"type": w["type"], "settings": {str(k): v for k, v in settings.items() if v is None or isinstance(v, str)}, "width": width})
    return out


class TemplateStore:
    def __init__(self, project: Project):
        self.file = project.root / ".mlviz" / "templates.json"

    def _read(self) -> list[dict]:
        try:
            data = json.loads(self.file.read_text())
        except (OSError, ValueError):
            return []
        items = data.get("templates") if isinstance(data, dict) else None
        return [t for t in items if isinstance(t, dict) and t.get("scope") in SCOPES and isinstance(t.get("name"), str)] if isinstance(items, list) else []

    def _write(self, templates: list[dict]) -> None:
        self.file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.file.with_suffix(".tmp")
        tmp.write_text(json.dumps({"templates": templates}, ensure_ascii=False, indent=2))
        os.replace(tmp, self.file)

    def list(self, scope: str | None = None) -> list[dict]:
        items = [t for t in self._read() if scope is None or t["scope"] == scope]
        return sorted(items, key=lambda t: t["name"].lower())

    def get(self, scope: str, name: str) -> dict | None:
        return next((t for t in self._read() if t["scope"] == scope and t["name"].lower() == name.strip().lower()), None)

    def save(self, scope: str, name: str, widgets: Any) -> dict:
        """Saves a template for a scope; the same name (any case) overwrites and keeps `last_used`."""
        if scope not in SCOPES:
            raise TemplateError(f"scope muss {', '.join(SCOPES)} sein")
        name = (name or "").strip() or "Neue Vorlage"
        if len(name) > MAX_NAME:
            raise TemplateError(f"Der Name ist länger als {MAX_NAME} Zeichen")
        if name.lower() == BUILTIN.lower():
            raise TemplateError(f"„{BUILTIN}“ ist eingebaut und lässt sich nicht überschreiben")
        clean = _clean_widgets(widgets)
        existing = self.get(scope, name)
        template = {"name": name, "scope": scope, "widgets": clean, "last_used": (existing or {}).get("last_used")}
        rest = [t for t in self._read() if not (t["scope"] == scope and t["name"].lower() == name.lower())]
        self._write([*rest, template])
        return template

    def mark_used(self, scope: str, name: str, runs: list[str]) -> dict:
        template = self.get(scope, name)
        if template is None:
            raise KeyError(name)
        template["last_used"] = {"runs": [str(r) for r in runs], "at": now().isoformat()}
        rest = [t for t in self._read() if not (t["scope"] == scope and t["name"].lower() == name.strip().lower())]
        self._write([*rest, template])
        return template

    def delete(self, scope: str, name: str) -> None:
        if name.strip().lower() == BUILTIN.lower():
            raise TemplateError(f"„{BUILTIN}“ ist eingebaut und lässt sich nicht löschen")
        if self.get(scope, name) is None:
            raise KeyError(name)
        self._write([t for t in self._read() if not (t["scope"] == scope and t["name"].lower() == name.strip().lower())])
