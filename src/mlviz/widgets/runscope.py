"""Widgets of the scope "one run" (feature G): they answer a question about all combinations of a run.
A combination in the request (`combo`) acts as a filter: the board shows only those cells."""

from __future__ import annotations

import pandas as pd

from ..aggregate import CHANNEL, _ordered_values, dimension_axes, has_channels, join_cells
from ..project import Metric, Project
from ..runs import Run, get_run
from .common import combo_cells, de, make_header, metric_text
from .registry import Widget, seg, select, widget

SCOPES = ("run",)


def _run(project: Project, req: dict) -> Run:
    run = get_run(project, req.get("run", ""))
    if run is None:
        raise LookupError("run not found")
    return run


def real_metrics(project: Project, run: Run) -> list[Metric]:
    """Metrics of the real family that the run has (all of its metrics if there is none)."""
    have = [m for m in project.metrics if m.key in run.cells.columns]
    real = [m for m in have if m.family == "real"]
    return real or have


def pick_metric(project: Project, run: Run, key: str | None) -> Metric | None:
    metrics = [m for m in project.metrics if m.key in run.cells.columns]
    if key:
        found = next((m for m in metrics if m.key == key), None)
        if found:
            return found
    return (real_metrics(project, run) or [None])[0]


def best_of(values: pd.Series, metric: Metric):
    return values.idxmax() if metric.direction == "max" else values.idxmin()


def better(metric: Metric):
    return max if metric.direction == "max" else min


def default_axis(run: Run, axes: list[str]) -> str | None:
    """The axis named `forecaster` if present, else the first axis."""
    return "forecaster" if "forecaster" in axes else (axes[0] if axes else None)


def best_combo(run: Run, frame: pd.DataFrame, axes: list[str], metric: Metric) -> dict[str, str]:
    """Axis values of the best combination (best group mean over all axes) of the given cells."""
    if frame.empty or not axes or metric.key not in frame.columns:
        return {}
    means = frame.groupby(axes, sort=False)[metric.key].mean().dropna()
    if means.empty:
        return {}
    idx = best_of(means, metric)
    idx = idx if isinstance(idx, tuple) else (idx,)
    return {a: str(v) for a, v in zip(axes, idx)}


def fixed_text(fixed: dict[str, str]) -> str:
    return " · fest: " + ", ".join(f"{k} = {v}" for k, v in fixed.items()) if fixed else ""


def _setup(project: Project, req: dict, key: str, want_axis: str = "rows"):
    """Common start of the widgets: run, filtered cells, axes, chosen axis. Returns (…, error)."""
    run = _run(project, req)
    axes = dimension_axes(run)
    frame = combo_cells(run, req.get("combo"))
    if frame.empty:
        return run, None, axes, None, {"unavailable": "Keine Zellen unter diesem Filter"}
    if not axes:
        return run, frame, axes, None, {"unavailable": "Dieser Lauf hat keine Achsen"}
    chosen = req["settings"].get(want_axis)
    axis = chosen if chosen in axes else default_axis(run, axes)
    return run, frame, axes, axis, None


def _filtered(req: dict, axes: list[str], axis: str, extra: list[str] | None = None) -> tuple[list[str], dict]:
    """Axes that are not shown (fixed to the best value) and the options for the axis settings."""
    others = [a for a in axes if a != axis and a not in (extra or [])]
    return others, {}


# --- Vergleichstabelle -----------------------------------------------------------------------------
@widget(
    Widget(
        key="compare-table",
        label="Vergleichstabelle",
        question="Welcher Wert einer Achse ist bei welcher Metrik am besten?",
        scopes=SCOPES,
        settings=[select("rows", "Zeilen"), select("groups", "Spaltengruppen", "none")],
        width="full",
    )
)
def compare_table(project: Project, req: dict) -> dict:
    run, frame, axes, axis, err = _setup(project, req, "compare-table", "rows")
    if err:
        return err
    metrics = real_metrics(project, run)
    if not metrics:
        return {"unavailable": "Der Lauf hat keine Metriken"}
    groups_axis = req["settings"].get("groups")
    groups_axis = groups_axis if groups_axis in axes and groups_axis != axis else None
    others = [a for a in axes if a not in (axis, groups_axis)]
    fixed = best_combo(run, frame, axes, metrics[0])
    fixed = {a: fixed[a] for a in others if a in fixed}
    sub = frame
    for a, v in fixed.items():
        sub = sub[sub[a] == v]
    rows = [v for v in _ordered_values(run, axis) if v in set(sub[axis])]
    groups = [v for v in _ordered_values(run, groups_axis) if v in set(sub[groups_axis])] if groups_axis else [None]
    cells: list[list[dict]] = []
    wins: dict[str, int] = {}
    n_cols = 0
    best: dict[tuple, str] = {}
    for gi, g in enumerate(groups):
        gsub = sub if g is None else sub[sub[groups_axis] == g]
        means = gsub.groupby(axis, sort=False)[[m.key for m in metrics]].mean()
        for m in metrics:
            col = means[m.key].dropna()
            if col.empty:
                continue
            n_cols += 1
            w = str(best_of(col, m))
            best[(gi, m.key)] = w
            wins[w] = wins.get(w, 0) + 1
    for r in rows:
        line = []
        for gi, g in enumerate(groups):
            gsub = sub if g is None else sub[sub[groups_axis] == g]
            part = gsub[gsub[axis] == r]
            block = {}
            for m in metrics:
                v = float(part[m.key].mean()) if len(part) and part[m.key].notna().any() else None
                block[m.key] = {"value": v, "best": best.get((gi, m.key)) == r}
            line.append(block)
        cells.append(line)
    top = max(wins, key=lambda k: (wins[k], -rows.index(k) if k in rows else 0)) if wins else None
    if top is None:
        return {"unavailable": "Keine Werte zum Vergleichen"}
    k = wins[top]
    title = f"{top} ist in allen {n_cols} Spalten am besten" if k == n_cols else f"{top} ist in {k} von {n_cols} Spalten am besten"
    own = project.own_model or {}
    direction = metrics[0].direction
    return {
        "title": title,
        "subtitle": f"{axis} × {', '.join(m.label for m in metrics)}"
        + (f" · Spalten nach {groups_axis}" if groups_axis else "")
        + fixed_text(fixed)
        + " · Replikate gemittelt",
        "header": make_header(
            [(axis, True), (" × ", False), (", ".join(m.label for m in metrics), True)]
            + ([(" · Spalten nach ", False), (groups_axis, True)] if groups_axis else []),
            "Replikate gemittelt",
            fixed,
        ),
        "options": {"rows": axes, "groups": [{"value": "none", "label": "keine"}] + [{"value": a, "label": a} for a in axes if a != axis]},
        "data": {
            "row_key": axis,
            "rows": rows,
            "groups_key": groups_axis,
            "groups": groups,
            "columns": [{"key": m.key, "label": m.label, "unit": m.unit, "scale": m.scale} for m in metrics],
            "cells": cells,
            "fixed": fixed,
            "own_row": own.get("value") if own.get("axis") == axis and own.get("value") in rows else None,
            "winner": top,
        },
    }


# --- Je Region ---------------------------------------------------------------------------------
@widget(
    Widget(
        key="per-region",
        label="Je Region",
        question="Wo gewinnt welcher Wert, Region für Region?",
        scopes=SCOPES,
        settings=[
            select("rows", "Serien"),
            select("metric", "Metrik"),
            seg("format", "Format", [("table", "Tabelle"), ("bars", "Balken")], "table"),
        ],
    )
)
def per_region(project: Project, req: dict) -> dict:
    run, frame, axes, axis, err = _setup(project, req, "per-region", "rows")
    if err:
        return err
    if not has_channels(run):
        return {"unavailable": "Dieser Lauf hat keine Kanäle"}
    metric = pick_metric(project, run, req["settings"].get("metric"))
    ch = run.channels
    if metric is None or metric.key not in ch.columns:
        return {"unavailable": "Der Lauf hat keine Metriken je Kanal"}
    others = [a for a in axes if a != axis]
    fixed = best_combo(run, frame, axes, metric)
    fixed = {a: fixed[a] for a in others if a in fixed}
    sub = frame
    for a, v in fixed.items():
        sub = sub[sub[a] == v]
    joined = join_cells(ch.assign(**{CHANNEL: ch[CHANNEL].map(str)}), sub, [axis])
    if joined.empty:
        return {"unavailable": "Keine Werte je Region"}
    series = [v for v in _ordered_values(run, axis) if v in set(joined[axis])]
    channels = list(dict.fromkeys(joined[CHANNEL]))
    means = joined.groupby([CHANNEL, axis], sort=False)[metric.key].mean()
    grid: list[list[dict]] = []
    wins: dict[str, int] = {}
    for c in channels:
        vals = {s: float(means[(c, s)]) for s in series if (c, s) in means.index}
        w = str(best_of(pd.Series(vals), metric)) if vals else None
        if w:
            wins[w] = wins.get(w, 0) + 1
        grid.append([{"value": vals.get(s), "best": s == w} for s in series])
    top = max(wins, key=lambda k: (wins[k], -series.index(k)))
    verb = "besser" if len(series) == 2 else "am besten"
    return {
        "title": f"{top} ist in {wins[top]} von {len(channels)} Regionen {verb}",
        "subtitle": f"{metric.label} je Region × {axis}" + fixed_text(fixed) + " · Replikate gemittelt",
        "header": make_header([(metric.label, True), (" je Region × ", False), (axis, True)], "Replikate gemittelt", fixed),
        "options": {"rows": axes, "metric": [{"value": m.key, "label": m.label} for m in project.metrics if m.key in ch.columns]},
        "data": {
            "series_key": axis,
            "series": series,
            "channels": channels,
            "grid": grid,
            "metric": {"key": metric.key, "label": metric.label, "unit": metric.unit, "scale": metric.scale, "direction": metric.direction},
            "format": req["settings"]["format"],
            "winner": top,
        },
    }


# --- Wirkung je Achse ----------------------------------------------------------------------------
@widget(
    Widget(
        key="axis-effect",
        label="Wirkung je Achse",
        question="Welche Achse verändert das Ergebnis am stärksten?",
        scopes=SCOPES,
        settings=[select("metric", "Metrik")],
    )
)
def axis_effect(project: Project, req: dict) -> dict:
    run, frame, axes, _axis, err = _setup(project, req, "axis-effect")
    if err:
        return err
    metric = pick_metric(project, run, req["settings"].get("metric"))
    if metric is None:
        return {"unavailable": "Der Lauf hat keine Metriken"}
    overall = float(frame[metric.key].mean())
    if not overall:
        return {"unavailable": "Das Lauf-Mittel ist 0"}
    out = []
    for a in axes:
        means = frame.groupby(a, sort=False)[metric.key].mean().dropna()
        if len(means) < 2:
            continue
        order = [v for v in _ordered_values(run, a) if v in means.index]
        out.append(
            {
                "axis": a,
                "spread": float((means.max() - means.min()) / abs(overall) * 100),
                "best": str(best_of(means, metric)),
                "worst": str((means.idxmin() if metric.direction == "max" else means.idxmax())),
                "values": [{"value": v, "mean": float(means[v]), "rel": float((means[v] - overall) / abs(overall) * 100)} for v in order],
            }
        )
    if not out:
        return {"unavailable": "Keine Achse mit mehr als einem Wert"}
    out.sort(key=lambda x: -x["spread"])
    top = out[0]
    return {
        "title": f"{top['axis']} wirkt am stärksten: {de(top['spread'])} % Spanne, am besten bei {top['best']}",
        "subtitle": f"{metric.label}: Abstand zwischen bestem und schlechtestem Wert je Achse, relativ zum Lauf-Mittel",
        "options": {"metric": [{"value": m.key, "label": m.label} for m in project.metrics if m.key in run.cells.columns]},
        "data": {
            "axes": out,
            "overall": overall,
            "metric": {"key": metric.key, "label": metric.label, "unit": metric.unit, "scale": metric.scale, "direction": metric.direction},
        },
    }


# --- Stabilität ---------------------------------------------------------------------------------
@widget(
    Widget(
        key="stability",
        label="Stabilität",
        question="Wie stark streut jeder Wert über die Wiederholungen?",
        scopes=SCOPES,
        settings=[select("rows", "Zeilen"), select("metric", "Metrik")],
    )
)
def stability(project: Project, req: dict) -> dict:
    run, frame, axes, axis, err = _setup(project, req, "stability", "rows")
    if err:
        return err
    metric = pick_metric(project, run, req["settings"].get("metric"))
    if metric is None:
        return {"unavailable": "Der Lauf hat keine Metriken"}
    others = [a for a in axes if a != axis]
    fixed = best_combo(run, frame, axes, metric)
    fixed = {a: fixed[a] for a in others if a in fixed}
    sub = frame
    for a, v in fixed.items():
        sub = sub[sub[a] == v]
    rows = []
    reps = [r for r in run.replicates if r in sub.columns]
    for v in [v for v in _ordered_values(run, axis) if v in set(sub[axis])]:
        part = sub[sub[axis] == v].dropna(subset=[metric.key])
        if part.empty:
            continue
        pts = [
            {"label": ", ".join(f"{r} {row[r]}" for r in reps) or str(row["cell_id"])[:6], "value": float(row[metric.key])}
            for _, row in part.iterrows()
        ]
        sd = float(part[metric.key].std()) if len(part) > 1 else None
        rows.append({"value": v, "points": pts, "mean": float(part[metric.key].mean()), "sd": None if sd is None or sd != sd else sd})
    if not rows:
        return {"unavailable": "Keine Werte"}
    with_sd = [r for r in rows if r["sd"] is not None]
    if with_sd:
        calm = min(with_sd, key=lambda r: r["sd"])
        title = f"{calm['value']} schwankt am wenigsten (sd {metric_text(metric, calm['sd'], None)})"
    else:
        title = "Es gibt keine Wiederholungen zum Vergleichen"
    return {
        "title": title,
        "subtitle": f"{metric.label} je Wiederholung × {axis}" + fixed_text(fixed),
        "header": make_header([(metric.label, True), (" je Wiederholung × ", False), (axis, True)], None, fixed),
        "options": {"rows": axes, "metric": [{"value": m.key, "label": m.label} for m in project.metrics if m.key in run.cells.columns]},
        "data": {
            "row_key": axis,
            "rows": rows,
            "metric": {"key": metric.key, "label": metric.label, "unit": metric.unit, "scale": metric.scale, "direction": metric.direction},
        },
    }
