"""Widget catalog: every widget has a key, the scopes it works on, its settings and the question it
answers. The tool renders boards (scope, runs, widgets with settings) from this catalog; boards are
created in the UI in v0.1 and, later, by the agent the same way."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

SCOPES = ("combination", "run", "two-runs", "project")


@dataclass
class Widget:
    key: str
    label: str
    question: str
    scopes: tuple[str, ...]
    #: Settings with their defaults. `type` is `seg` (few options) or `select` (options depend on the run
    #: and come with the data in `options`).
    settings: list[dict] = field(default_factory=list)
    #: What the run must provide (`curves`, `predictions`), else the widget says so instead of drawing.
    requires: str | None = None
    #: A widget that can be saved as an image (all but the YAML view of the config).
    exportable: bool = True
    #: Optional widgets are off in a new board and can be added from the catalog.
    optional: bool = False
    #: Width of a new tile in a board: `half` of the row or `full` (a full tile starts a new row).
    width: str = "half"

    def to_json(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "question": self.question,
            "scopes": list(self.scopes),
            "settings": self.settings,
            "requires": self.requires,
            "exportable": self.exportable,
            "optional": self.optional,
            "width": self.width,
        }


REGISTRY: dict[str, tuple[Widget, Callable[..., dict]]] = {}


def widget(defn: Widget):
    def deco(fn: Callable[..., dict]):
        REGISTRY[defn.key] = (defn, fn)
        return fn

    return deco


#: Order of the widgets in a board of a scope (the catalog and "+ Widget" follow it).
ORDER = {
    "combination": ["curves", "forecast", "replicates", "config"],
    "run": ["compare-table", "per-region", "config", "axis-effect", "stability"],
    "two-runs": [
        "config-diff", "who-wins", "best-config", "all-combos", "regions-ab", "scope-errors",
        "param-effect", "rank-stability", "rank-jumps",
    ],
    "project": ["project-best", "param-map"],
}


def catalog(scope: str | None = None) -> list[dict]:
    items = [w for w, _ in REGISTRY.values() if scope is None or scope in w.scopes]
    order = ORDER.get(scope or "", [])
    items.sort(key=lambda w: order.index(w.key) if w.key in order else len(order))
    return [w.to_json() for w in items]


def seg(key: str, label: str, options: list[tuple[str, str]], default: str) -> dict:
    return {
        "key": key,
        "label": label,
        "type": "seg",
        "options": [{"value": v, "label": l} for v, l in options],
        "default": default,
    }


def select(key: str, label: str, default: str | None = None) -> dict:
    return {"key": key, "label": label, "type": "select", "default": default}


def compute(project, key: str, request: dict) -> dict:
    """Data of one widget for a board scope. Unknown settings are ignored, missing ones defaulted."""
    if key not in REGISTRY:
        raise KeyError(key)
    defn, fn = REGISTRY[key]
    settings: dict[str, Any] = {s["key"]: s.get("default") for s in defn.settings}
    for k, v in (request.get("settings") or {}).items():
        if k in settings:
            settings[k] = v
    out = fn(project, {**request, "settings": settings})
    return {"key": key, "exportable": defn.exportable, **out}
