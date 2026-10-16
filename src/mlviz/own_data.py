"""The datasets that own widgets draw from (feature E).

Every source is already aggregated over the replicates (mean; `_sd` is the standard deviation over them) and
keyed by the grid axes of the run, so a widget describes only how to draw it. In the scope "two" every row
carries `run` = "A" | "B", in "project" the id of its run.

| source        | one row per                                             | columns                                   |
|---------------|---------------------------------------------------------|-------------------------------------------|
| `cells`       | combination (the axes with more than one value)         | axes, each metric, `<metric>_sd`, `n`     |
| `channels`    | combination and channel                                 | axes, `channel`, each metric              |
| `curves`      | combination, epoch and loss                             | axes, `epoch`, `metric`, `value`          |
| `predictions` | combination, channel and date                           | axes, `channel`, `date`, `y_pred`, `y_true` |
| `runs`        | run                                                     | `id`, `name`, `issue`, `started`, `epoch`, `state`, `cells`, `errors`, the Lauf-Merkmale |
"""

from __future__ import annotations

import math
from typing import Any

import pandas as pd

from .aggregate import CHANNEL, _cells, dimension_axes, join_cells
from .listing import flat_config, merkmal_candidates
from .project import Project
from .runs import Run, dim_str, get_run, readable_runs

SOURCES = ("cells", "channels", "curves", "predictions", "runs")
#: Scope of a description (`one`, `two`, `project`) -> scope of the widget catalog.
SCOPE_OF = {"one": "run", "two": "two-runs", "project": "project"}
ROW_CAP = 20_000


def _axes(run: Run, df: pd.DataFrame) -> list[str]:
    return [a for a in dimension_axes(run) if a in df.columns]


def _metric_cols(project: Project, df: pd.DataFrame) -> list[str]:
    return [m.key for m in project.metrics if m.key in df.columns]


def _grouped(df: pd.DataFrame, by: list[str], agg: dict[str, str]) -> pd.DataFrame:
    if not by:
        return df.agg(agg).to_frame().T
    return df.groupby(by, sort=False, dropna=False).agg(agg).reset_index()


def _frame(project: Project, run: Run, source: str) -> pd.DataFrame:
    cells = _cells(run)
    if cells.empty:
        raise LookupError("Dieser Lauf hat noch keine Zellen")
    ok = cells[cells["status"] != "error"]
    axes = _axes(run, ok)
    if source == "cells":
        metrics = _metric_cols(project, ok)
        mean = _grouped(ok, axes, {m: "mean" for m in metrics})
        if not axes:
            mean["n"] = len(ok)
            return mean.join(ok[metrics].std(ddof=1).add_suffix("_sd").to_frame().T.reset_index(drop=True))
        grouped = ok.groupby(axes, sort=False, dropna=False)
        sd = grouped[metrics].std(ddof=1).add_suffix("_sd").reset_index(drop=True)
        n = grouped.size().reset_index(drop=True).rename("n")
        return pd.concat([mean, sd, n], axis=1)
    if source == "channels":
        ch = run.channels
        if ch is None or ch.empty:
            raise LookupError("Dieser Lauf hat keine Kanäle")
        key = "row" if "row" in ch.columns and "row" in ok.columns else "cell_id"
        metrics = _metric_cols(project, ch)
        j = join_cells(ch, ok, [key, *axes])
        j[CHANNEL] = j[CHANNEL].astype(str)
        return _grouped(j, [*axes, CHANNEL], {m: "mean" for m in metrics})
    table = "curves" if source == "curves" else "predictions"
    df = run.table(table, with_cells=True)
    if df is None or df.empty:
        raise LookupError("Dieser Lauf hat keine Lernkurven gespeichert" if source == "curves" else "Dieser Lauf hat keine Vorhersagen gespeichert")
    for a in axes:
        df[a] = dim_str(df[a])
    if source == "curves":
        return _grouped(df, [*axes, "epoch", "metric"], {"value": "mean"})
    df[CHANNEL] = df[CHANNEL].astype(str)
    df["date"] = df["date"].astype(str)
    return _grouped(df, [*axes, CHANNEL, "date"], {"y_pred": "mean", "y_true": "mean"})


def _run_rows(project: Project, runs: list[Run], label: dict[str, str] | None = None) -> pd.DataFrame:
    everyone = readable_runs(project)
    keys = merkmal_candidates(everyone)
    rows = []
    for r in runs:
        flat = flat_config(r)
        row: dict[str, Any] = {
            "id": r.id,
            "name": r.name,
            "issue": r.issue,
            "started": r.started.date().isoformat() if r.started else None,
            "epoch": r.epoch,
            "state": r.state,
            "cells": r.done_cells,
            "errors": r.error_count(),
        }
        for k in keys:
            row[k.split(".", 1)[1]] = flat.get(k)
        if label:
            row["run"] = label[r.id]
        rows.append(row)
    return pd.DataFrame(rows)


def _apply(df: pd.DataFrame, flt: dict[str, Any], strict: bool, source: str) -> pd.DataFrame:
    for col, value in flt.items():
        if col not in df.columns:
            if strict:
                raise LookupError(f"Die Spalte {col!r} gibt es in {source} nicht")
            continue
        wanted = [str(v) for v in value] if isinstance(value, list) else [str(value)]
        df = df[df[col].astype(str).isin(wanted)]
    return df


def _json_rows(df: pd.DataFrame) -> list[dict]:
    out = []
    for rec in df.to_dict("records"):
        out.append({k: (None if isinstance(v, float) and math.isnan(v) else (v.item() if hasattr(v, "item") else v)) for k, v in rec.items()})
    return out


def rows_for(project: Project, source: str, scope: str, request: dict, flt: dict[str, Any]) -> list[dict]:
    """Rows of a source for the board in `request` (run, runs, combo), filtered by the description's `filter`."""
    if scope == "one":
        run = get_run(project, request.get("run", ""))
        if run is None:
            raise LookupError("Der Lauf ist nicht da")
        frames = [(run, None)]
    elif scope == "two":
        ids = (request.get("runs") or [])[:2]
        loaded = [get_run(project, i) for i in ids]
        if len(loaded) < 2 or any(r is None for r in loaded):
            raise LookupError("Es fehlen zwei Läufe")
        frames = [(loaded[0], "A"), (loaded[1], "B")]
    else:
        ids = request.get("runs") or []
        pool = [get_run(project, i) for i in ids] if ids else [r for r in readable_runs(project) if not r.running]
        frames = [(r, r.id) for r in pool if r is not None and not r.problem]
        if not frames:
            raise LookupError("Es sind keine Läufe gewählt")
    if source == "runs":
        df = _run_rows(project, [r for r, _ in frames], {r.id: tag for r, tag in frames} if scope != "one" else None)
    else:
        parts = []
        for run, tag in frames:
            part = _frame(project, run, source)
            if tag is not None:
                part.insert(0, "run", tag)
            parts.append(part)
        df = pd.concat(parts, ignore_index=True)
    df = _apply(df, flt, True, source)
    if scope == "one":
        df = _apply(df, request.get("combo") or {}, False, source)  # the combination chips of the board
    if len(df) > ROW_CAP:
        raise LookupError(f"zu viele Zeilen ({len(df)}), bitte mit filter einschränken")
    return _json_rows(df)
