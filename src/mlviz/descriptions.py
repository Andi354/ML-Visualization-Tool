"""The description of a run for the run tab (feature H): `ds-store` reads `description.yaml`, this module
puts it into the shape the screen shows.

Fields in the order of the screen: `purpose` (paragraphs), `shows` (list), `expectation` (paragraph), `notes`
(list) and `compare_to` (run names, each resolved to a run of the project or marked as unknown). Plain text,
nothing is interpreted. A field that is empty is left out; a description with `problems` still shows what is
readable.
"""

from __future__ import annotations

from typing import Any

from . import store
from .project import Project
from .runs import Run, list_runs


def _text(value: Any) -> str | None:
    text = "\n".join(line.rstrip() for line in str(value).strip().splitlines()) if value is not None else ""
    return text or None


def _items(value: Any) -> list[str]:
    values = value if isinstance(value, (list, tuple)) else ([value] if value not in (None, "") else [])
    return [t for t in (_text(v) for v in values) if t]


def resolve_compare(project: Project, names: list[str]) -> list[dict]:
    """Each name of `compare_to` as `{name, run}`: `run` is the folder of the run it names (the folder name, else
    the newest run of that name), None when the project has no such run."""
    runs = list_runs(project)
    by_id = {r.id: r.id for r in runs}
    by_name: dict[str, str] = {}
    for r in runs:  # newest first: the first run of a name wins
        by_name.setdefault(r.name, r.id)
    return [{"name": n, "run": by_id.get(n) or by_name.get(n)} for n in names]


def describe(project: Project, run: Run) -> dict | None:
    """None for a run without description, else `{short, purpose, shows, expectation, notes, compare_to, problems}`."""
    raw = store.read_description(run.path)
    if raw is None:
        return None
    problems = _items(raw.get("problems"))
    return {
        "short": store.cut_short(raw.get("short")),
        "purpose": _text(raw.get("purpose")),
        "shows": _items(raw.get("shows")),
        "expectation": _text(raw.get("expectation")),
        "notes": _items(raw.get("notes")),
        "compare_to": resolve_compare(project, _items(raw.get("compare_to"))),
        "problems": problems,
    }
