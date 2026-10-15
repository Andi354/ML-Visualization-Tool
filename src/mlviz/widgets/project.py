"""Widgets of the scope "project" (feature E): all runs of the project over time."""

from __future__ import annotations

from ..aggregate import _ordered_values, dimension_axes
from ..listing import flat_config, group_best, merkmal_candidates
from ..project import Project
from ..runs import Run, list_runs
from .common import de, metric_text
from .compare import _means
from .registry import Widget, select, widget
from .runscope import real_metrics

SCOPES = ("project",)
NO_COLOR = "none"


def _color_key(runs: list[Run], params: dict) -> str | None:
    """The Lauf-Merkmal that colours the runs: chosen in the header, default the first candidate."""
    cands = merkmal_candidates(runs)
    chosen = (params or {}).get("color_by")
    if chosen == NO_COLOR:
        return None
    return chosen if chosen in cands else (cands[0] if cands else None)


def _value_of(run: Run, key: str | None) -> str | None:
    return flat_config(run).get(key) if key else None


def _numeric_first(values: list[str]) -> list[str]:
    def k(v: str):
        try:
            return (0, float(v), v)
        except ValueError:
            return (1, 0.0, v)

    return sorted(set(values), key=k)


def _current_epoch(project: Project) -> str | None:
    return project.epochs[-1].get("name") if project.epochs else None


def default_selection(project: Project, runs: list[Run]) -> list[str]:
    """Runs for the parameter map before anything was picked: finished runs of the current epoch with axes."""
    cur = _current_epoch(project)
    return [r.id for r in runs if (not cur or r.epoch == cur) and not r.running and dimension_axes(r)]


def project_options(project: Project, runs: list[Run]) -> dict:
    return {"color_by": [{"value": NO_COLOR, "label": "keins"}] + [{"value": c, "label": c.split(".", 1)[1]} for c in merkmal_candidates(runs)]}


# --- Bester Wert je Lauf ------------------------------------------------------------------------------
@widget(Widget(key="project-best", label="Bester Wert je Lauf", question="Wird das beste Ergebnis über die Läufe besser?", scopes=SCOPES))
def project_best(project: Project, req: dict) -> dict:
    runs = list_runs(project)
    metrics = real_metrics_of(project)
    if not metrics or not runs:
        return {"unavailable": "Noch keine Läufe mit Bestwert"}
    metric = metrics[0]
    key = _color_key(runs, req.get("params") or {})
    cur = _current_epoch(project)
    selected = set(req.get("runs") or [])
    points = []
    for r in runs:
        best = group_best(r, metric)
        if best is None or r.started is None:
            continue
        points.append(
            {
                "id": r.id,
                "label": r.issue or r.name,
                "date": r.started.isoformat(),
                "value": best,
                "series": _value_of(r, key),
                "epoch": r.epoch,
                "older": bool(cur and r.epoch and r.epoch != cur),
                "running": r.running,
                "selected": r.id in selected,
            }
        )
    if not points:
        return {"unavailable": "Noch keine Läufe mit Bestwert"}
    points.sort(key=lambda p: p["date"])
    values = _numeric_first([p["series"] for p in points if p["series"] is not None])
    series = [{"value": v, "index": i if i < 6 else -1} for i, v in enumerate(values)]
    lines = []
    pick = max if metric.direction == "max" else min
    for v in values[:6] or [None]:
        best = None
        pts = []
        for p in points:
            if p["series"] != v or p["older"]:
                continue
            best = p["value"] if best is None else pick(best, p["value"])
            pts.append({"date": p["date"], "value": best})
        if pts:
            lines.append({"series": v, "points": pts})
    current = [p for p in points if not p["older"]] or points
    top = (max if metric.direction == "max" else min)(current, key=lambda p: p["value"])
    where = f", {key.split('.', 1)[1]} {top['series']}" if key and top["series"] is not None else ""
    return {
        "title": f"Bestes Ergebnis{' der aktuellen Epoche' if cur else ''}: {metric_text(metric, top['value'])} ({top['label']}{where})",
        "subtitle": f"Bester {metric.label} je Lauf" + (f" · gefärbt nach {key.split('.', 1)[1]}" if key else ""),
        "note": "Linie = bester Wert bisher je Serie · hohle Punkte = andere Epoche, nicht in der Linie · Klick wählt den Lauf für die Landkarte"
        + (" · vorläufig = Lauf läuft noch" if any(p["running"] for p in points) else ""),
        "options": project_options(project, runs),
        "data": {
            "metric": {"key": metric.key, "label": metric.label, "unit": metric.unit, "scale": metric.scale, "direction": metric.direction},
            "points": points,
            "series": series,
            "lines": lines,
            "color_label": key.split(".", 1)[1] if key else None,
            "default_runs": default_selection(project, runs),
            "epoch": cur,
            "epoch_since": project.epochs[-1].get("since") if project.epochs else None,
        },
    }


def real_metrics_of(project: Project):
    return [m for m in project.metrics if m.family == "real"] or list(project.metrics)


# --- Parameter-Landkarte (optional) ---------------------------------------------------------------------
def _run_effects(run: Run, metric) -> dict[tuple[str, str], float]:
    """Effect of every axis value in a run: mean of the combinations with the value against the run mean."""
    axes = dimension_axes(run)
    full = _means(run, axes, metric)
    out: dict[tuple[str, str], float] = {}
    if full.empty or not axes:
        return out
    total = float(full.mean())
    if not total:
        return out
    for i, axis in enumerate(axes):
        for v in _ordered_values(run, axis):
            sel = full[[k[i] == v for k in full.index]]
            if len(sel):
                out[(axis, v)] = float((sel.mean() - total) / abs(total) * 100)
    return out


@widget(
    Widget(
        key="param-map",
        label="Parameter-Landkarte",
        question="Wirkt ein Parameterwert über die Läufe hinweg gleich?",
        scopes=SCOPES,
        optional=True,
    )
)
def param_map(project: Project, req: dict) -> dict:
    runs = list_runs(project)
    metrics = real_metrics_of(project)
    if not metrics or not runs:
        return {"unavailable": "Noch keine Läufe"}
    metric = metrics[0]
    key = _color_key(runs, req.get("params") or {})
    cur = _current_epoch(project)
    chosen = req.get("runs") or []
    if chosen:
        picked = [r for r in runs if r.id in chosen]
    else:
        default = set(default_selection(project, runs))
        picked = [r for r in runs if r.id in default]
    picked = [r for r in picked if dimension_axes(r)]
    if not picked:
        return {"unavailable": "Keine Läufe mit variierten Achsen ausgewählt"}
    groups = _numeric_first([g for g in (_value_of(r, key) for r in picked) if g is not None]) or [None]
    picked.sort(key=lambda r: ((groups.index(_value_of(r, key)) if _value_of(r, key) in groups else 0), r.started or 0))
    effects = {r.id: _run_effects(r, metric) for r in picked}
    rows_keys: list[tuple[str, str]] = []
    for r in picked:
        for k in effects[r.id]:
            if k not in rows_keys:
                rows_keys.append(k)
    better_is_negative = metric.direction != "max"
    rows = []
    flips = 0
    for axis, value in rows_keys:
        cells = [effects[r.id].get((axis, value)) for r in picked]
        cons = []
        directions = []
        for g in groups:
            vals = [effects[r.id].get((axis, value)) for r in picked if _value_of(r, key) == g and effects[r.id].get((axis, value)) is not None]
            nb = sum(1 for v in vals if (v < 0) == better_is_negative and v != 0)
            nw = sum(1 for v in vals if (v < 0) != better_is_negative and v != 0)
            if not vals:
                cons.append({"group": g, "text": None, "direction": None})
                continue
            text = "immer besser" if nw == 0 and nb else "immer schlechter" if nb == 0 and nw else f"{nb}× besser, {nw}× schlechter"
            direction = "better" if nb > nw else "worse" if nw > nb else None
            directions.append(direction)
            cons.append({"group": g, "text": text, "direction": direction})
        flip = "better" in directions and "worse" in directions
        flips += flip
        rows.append({"axis": axis, "value": value, "cells": cells, "consistency": cons, "flips": flip})
    if len(groups) > 1:
        title = f"{flips} von {len(rows)} Parameterwerten wirken je nach {key.split('.', 1)[1]} verschieden" if flips else f"Kein Parameterwert wirkt je nach {key.split('.', 1)[1]} verschieden"
    else:
        same = sum(1 for r in rows if len({c is not None and (c < 0) for c in r["cells"] if c is not None}) == 1)
        title = f"{same} von {len(rows)} Parameterwerten wirken in allen Läufen gleich"
    return {
        "title": title,
        "subtitle": f"Wirkung = Mittel der Kombinationen mit dem Wert gegenüber dem Lauf-Mittel, {metric.label}, in Prozent",
        "note": "türkis = besser · bernstein = schlechter · gestrichelt = Achse im Lauf nicht variiert · Deckelung bei ±6 %",
        "options": project_options(project, list_runs(project)),
        "data": {
            "metric": {"key": metric.key, "label": metric.label, "direction": metric.direction},
            "runs": [{"id": r.id, "label": r.issue or r.name, "group": _value_of(r, key)} for r in picked],
            "groups": groups,
            "color_label": key.split(".", 1)[1] if key else None,
            "rows": rows,
            "cap": 6,
        },
    }
