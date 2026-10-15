"""Group table of one run (feature D): dimensions, filters, averaging, sorting, overview.

Terms: *axis* = `sweep:` key, *replicate* = `replicates:` key, *channel* = output dimension.
A *group* is a set of cells that differ only in the dimensions that are currently averaged.
Metrics come from `cells.parquet` ("gesamt") or, per channel, from `channels.parquet`.
"""

from __future__ import annotations

import json
import math
from typing import Any

import numpy as np
import pandas as pd

from .project import Project
from .runs import Run, dim_str

CHANNEL = "channel"
#: Config blocks that describe the grid itself, not parameters.
GRID_BLOCKS = {"sweep", "replicates", "report", "base"}
MAX_ROWS = 1000
DEFAULT_ROWS = 200
HIST_BINS = 14


# --- helpers ---------------------------------------------------------------------------------
def _num(v) -> float | None:
    if v is None:
        return None
    f = float(v)
    return None if math.isnan(f) or math.isinf(f) else f


def display_value(v: Any) -> str:
    """Config value as shown in 'Konstante Werte'."""
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return "null"
    if isinstance(v, (list, dict)):
        return json.dumps(v)
    return str(v)


def _blocks(run: Run) -> dict[str, dict]:
    return {k: v for k, v in run.config.items() if isinstance(v, dict) and k not in GRID_BLOCKS}


def _paired_members(run: Run, axis: str) -> list[str]:
    values = (run.config.get("sweep") or {}).get(axis)
    if isinstance(values, list) and values and isinstance(values[0], dict):
        return list(values[0])
    return []


def axis_block(run: Run, axis: str) -> str:
    """Config block an axis belongs to; paired axes belong to the block of their first member."""
    blocks = _blocks(run)
    for name, entries in blocks.items():
        if axis in entries:
            return name
    for member in _paired_members(run, axis):
        for name, entries in blocks.items():
            if member in entries:
                return name
    return "sweep"


def _ordered_values(run: Run, column: str) -> list[str]:
    """Values of a dimension in grid order (first appearance in the plan, else in the cells)."""
    for table in (run.plan, run.cells):
        if table is not None and column in table.columns:
            return list(dict.fromkeys(dim_str(table[column])))
    return []


def _cells(run: Run) -> pd.DataFrame:
    c = run.cells.copy()
    if c.empty:
        return c
    for col in run.axes + run.replicates:
        if col in c.columns:
            c[col] = dim_str(c[col])
    if "status" not in c.columns:
        c["status"] = "ok"
    return c


def _counts(cells: pd.DataFrame, column: str) -> dict[str, int]:
    if cells.empty or column not in cells.columns:
        return {}
    return {str(k): int(v) for k, v in cells[column].value_counts().items()}


# --- dimensions (sidebar) --------------------------------------------------------------------
def dimension_axes(run: Run) -> list[str]:
    """Axes with more than one value; a single-valued axis is a constant."""
    return [a for a in run.axes if len(_ordered_values(run, a)) > 1]


def has_channels(run: Run) -> bool:
    ch = run.channels
    return ch is not None and CHANNEL in ch.columns and ch[CHANNEL].nunique() > 1


def run_dims(run: Run) -> dict:
    """Everything the sidebar of the experiment view needs."""
    cells = _cells(run)
    dims: list[dict] = []
    for axis in dimension_axes(run):
        counts = _counts(cells, axis)
        dims.append(
            {
                "key": axis,
                "kind": "axis",
                "section": axis_block(run, axis),
                "values": [{"value": v, "n": counts.get(v, 0)} for v in _ordered_values(run, axis)],
            }
        )
    for rep in run.replicates:
        values = _ordered_values(run, rep)
        if len(values) < 1:
            continue
        counts = _counts(cells, rep)
        dims.append(
            {
                "key": rep,
                "kind": "replicate",
                "section": "Wiederholungen",
                "values": [{"value": v, "n": counts.get(v, 0)} for v in values],
            }
        )
    if has_channels(run):
        ch = run.channels
        counts = _counts(ch, CHANNEL)
        dims.append(
            {
                "key": CHANNEL,
                "kind": "channel",
                "section": "Kanäle",
                "values": [{"value": str(v), "n": counts.get(str(v), 0)} for v in dict.fromkeys(ch[CHANNEL].map(str))],
            }
        )
    return {
        "dims": dims,
        "sections": _sections(run, dims),
        "constants": constants(run),
        "cells": int(len(cells)),
        "errors": run.error_count(),
        "primary_metric": run.meta.get("primary_metric"),
    }


def _sections(run: Run, dims: list[dict]) -> list[str]:
    order = [b for b in _blocks(run)] + ["sweep"]
    present = {d["section"] for d in dims if d["kind"] == "axis"}
    out = [b for b in order if b in present]
    if any(d["kind"] == "replicate" for d in dims):
        out.append("Wiederholungen")
    if any(d["kind"] == "channel" for d in dims):
        out.append("Kanäle")
    return out


def constants(run: Run) -> list[dict]:
    """Non-swept entries of the resolved config and axes with a single value, grouped by block."""
    out: list[dict] = []
    swept = set(dimension_axes(run)) | set(run.replicates)
    swept_members = {m for a in dimension_axes(run) for m in _paired_members(run, a)}
    singles: dict[str, list[tuple[str, str]]] = {}
    for axis in run.axes:
        if axis in swept:
            continue
        vals = _ordered_values(run, axis)
        if len(vals) == 1:
            singles.setdefault(axis_block(run, axis), []).append((axis, vals[0]))
    names = list(_blocks(run))
    for extra in singles:
        if extra not in names:
            names.append(extra)
    for name in names:
        entries = _blocks(run).get(name, {})
        rows = [
            {"key": k, "value": display_value(v)}
            for k, v in entries.items()
            if k not in swept and k not in swept_members and k not in {a for a, _ in singles.get(name, [])}
        ]
        rows += [{"key": a, "value": v} for a, v in singles.get(name, [])]
        if rows:
            out.append({"block": name, "rows": rows})
    return out


# --- table -------------------------------------------------------------------------------------
def _metric_keys(run: Run, project: Project) -> list[str]:
    cols = set(run.cells.columns) if not run.cells.empty else set()
    ch = run.channels
    if ch is not None:
        cols |= set(ch.columns)
    return [m.key for m in project.metrics if m.key in cols]


def _apply_filters(frame: pd.DataFrame, sel: dict[str, list[str]]) -> pd.DataFrame:
    for col, values in sel.items():
        if values and col in frame.columns:
            frame = frame[frame[col].isin(values)]
    return frame


def _key_of(row_values: dict[str, str]) -> str:
    return "|".join(f"{k}={v}" for k, v in row_values.items())


def run_table(run: Run, project: Project, query: dict) -> dict:
    cells = _cells(run)
    axes = dimension_axes(run)
    reps = list(run.replicates)
    chans = has_channels(run)
    state: dict[str, dict] = query.get("dims") or {}

    def mode(dim: str) -> str:
        default = "split" if dim in axes else "agg"
        m = (state.get(dim) or {}).get("mode", default)
        return m if m in ("split", "agg") else default

    def sel(dim: str) -> list[str]:
        return [str(v) for v in ((state.get(dim) or {}).get("sel") or [])]

    split_axes = [a for a in axes if mode(a) == "split"]
    split_reps = [r for r in reps if r in cells.columns and mode(r) == "split"]
    channel_split = chans and mode(CHANNEL) == "split"
    channel_sel = sel(CHANNEL) if chans else []
    keys = split_axes + split_reps + ([CHANNEL] if channel_split else [])

    metrics = _metric_keys(run, project)
    sort = query.get("sort") or {}
    sort_metric = sort.get("metric") or run.meta.get("primary_metric") or project.primary_metric
    if sort_metric not in metrics and metrics:
        sort_metric = metrics[0]
    sort_stat = sort.get("stat", "mean")
    direction_default = project.metric(sort_metric).direction if project.metric(sort_metric) else "min"
    sort_dir = sort.get("dir") or ("desc" if direction_default == "max" else "asc")
    limit = max(1, min(int(query.get("limit") or DEFAULT_ROWS), MAX_ROWS))

    if cells.empty:
        return _empty(keys, metrics, sort_metric)

    # filter on axes and replicates (the cell dimensions)
    cells_f = _apply_filters(cells, {d: sel(d) for d in axes + reps})
    failed = cells_f["status"] == "error"

    # metric source: cells (gesamt) or channels (per channel, or a channel selection)
    use_channels = chans and (channel_split or bool(channel_sel))
    ok_cells = cells_f[~failed]
    if use_channels:
        ch = run.channels.copy()
        ch[CHANNEL] = ch[CHANNEL].map(str)
        if channel_sel:
            ch = ch[ch[CHANNEL].isin(channel_sel)]
        dims_cols = ["cell_id"] + [c for c in axes + reps if c in ok_cells.columns]
        base = ch.merge(ok_cells[dims_cols], on="cell_id", how="inner")
        if not channel_split:
            # average the selected channels per cell first, so sd stays a sd over cells
            mcols = [m for m in metrics if m in base.columns]
            base = base.groupby(dims_cols, sort=False, dropna=False)[mcols].mean().reset_index()
        ok = base
    else:
        ok = ok_cells

    channel_values = (
        [c for c in dict.fromkeys(run.channels[CHANNEL].map(str)) if not channel_sel or c in channel_sel]
        if channel_split
        else []
    )

    # groups
    def group_frame(frame: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
        if not cols:
            return frame.assign(__g=0).groupby("__g")
        return frame.groupby(cols, sort=False, dropna=False)

    cell_keys = [k for k in keys if k != CHANNEL]
    # every group that exists in the filtered cells (also when all its cells failed)
    universe = cells_f[cell_keys].drop_duplicates() if cell_keys else pd.DataFrame({"__g": [0]})
    if channel_split:
        universe = universe.merge(pd.DataFrame({CHANNEL: channel_values}), how="cross")
    universe = universe.reset_index(drop=True)
    gcols = keys if keys else ["__g"]

    present_metrics = [m for m in metrics if m in ok.columns]
    agg_in = ok.assign(__g=0) if not keys else ok
    if len(agg_in):
        g = agg_in.groupby(gcols, sort=False, dropna=False)
        stats = pd.concat(
            {
                "n": g.size(),
                **{f"{m}|mean": g[m].mean() for m in present_metrics},
                **{f"{m}|std": g[m].std() for m in present_metrics},
                **{f"{m}|min": g[m].min() for m in present_metrics},
                **{f"{m}|max": g[m].max() for m in present_metrics},
            },
            axis=1,
        ).reset_index()
    else:
        stats = pd.DataFrame(columns=gcols + ["n"])
    table = universe.merge(stats, on=gcols, how="left")
    table["n"] = table["n"].fillna(0).astype(int)

    err = cells_f[failed]
    if len(err):
        e = err.groupby(cell_keys, sort=False, dropna=False).size().rename("errors").reset_index() if cell_keys else pd.DataFrame({"__g": [0], "errors": [len(err)]})
        table = table.merge(e, on=cell_keys or ["__g"], how="left")
    else:
        table["errors"] = 0
    table["errors"] = table["errors"].fillna(0).astype(int)

    # sort (globally, over all groups); missing values last in both directions
    if sort_stat == "n":
        sort_col = "n"
    else:
        sort_col = f"{sort_metric}|{sort_stat if sort_stat in ('mean', 'min', 'max') else 'mean'}"
    if sort_col not in table.columns:
        table[sort_col] = np.nan
    table = table.sort_values(sort_col, ascending=sort_dir == "asc", na_position="last", kind="mergesort")
    table = table.reset_index(drop=True)

    # best value of the sort metric (by its direction), over all groups
    mean_col = f"{sort_metric}|mean"
    best_key = None
    best_value = None
    if mean_col in table.columns and table[mean_col].notna().any():
        mdir = direction_default
        idx = table[mean_col].idxmax() if mdir == "max" else table[mean_col].idxmin()
        best_value = _num(table.loc[idx, mean_col])
        best_key = _key_of({k: str(table.loc[idx, k]) for k in keys})

    rows = []
    for _, r in table.head(limit).iterrows():
        params = {k: str(r[k]) for k in keys}
        rows.append(
            {
                "key": _key_of(params),
                "params": params,
                "n": int(r["n"]),
                "errors": int(r["errors"]),
                "metrics": {
                    m: {
                        "mean": _num(r.get(f"{m}|mean")),
                        "std": _num(r.get(f"{m}|std")),
                        "min": _num(r.get(f"{m}|min")),
                        "max": _num(r.get(f"{m}|max")),
                    }
                    for m in present_metrics
                },
            }
        )

    result = {
        "params": keys,
        "metrics": metrics,
        "sort": {"metric": sort_metric, "stat": sort_stat, "dir": sort_dir},
        "groups": int(len(table)),
        "cells": int(len(cells_f)),
        "shown": len(rows),
        "best": {"key": best_key, "value": best_value, "metric": sort_metric},
        "rows": rows,
        "histogram": _histogram(table[mean_col].dropna().to_numpy() if mean_col in table.columns else np.array([]), best_value),
    }
    if query.get("overview", True):
        result["overview"] = _overview(run, project, cells_f, axes, sort_metric, state, chans, channel_sel)
    return result


def _empty(keys: list[str], metrics: list[str], sort_metric: str | None) -> dict:
    return {
        "params": keys,
        "metrics": metrics,
        "sort": {"metric": sort_metric, "stat": "mean", "dir": "asc"},
        "groups": 0,
        "cells": 0,
        "shown": 0,
        "best": {"key": None, "value": None, "metric": sort_metric},
        "rows": [],
        "histogram": {"counts": [], "lo": None, "hi": None, "best_bin": None},
        "overview": {"cards": []},
    }


def _histogram(values: np.ndarray, best: float | None) -> dict:
    if values.size == 0:
        return {"counts": [], "lo": None, "hi": None, "best_bin": None}
    lo, hi = float(values.min()), float(values.max())
    if lo == hi:
        return {"counts": [int(values.size)], "lo": lo, "hi": hi, "best_bin": 0}
    counts, edges = np.histogram(values, bins=HIST_BINS, range=(lo, hi))
    best_bin = None
    if best is not None:
        best_bin = int(min(np.searchsorted(edges, best, side="right") - 1, HIST_BINS - 1))
    return {"counts": [int(c) for c in counts], "lo": lo, "hi": hi, "best_bin": best_bin}


def _overview(
    run: Run,
    project: Project,
    cells_f: pd.DataFrame,
    axes: list[str],
    metric: str | None,
    state: dict,
    chans: bool,
    channel_sel: list[str],
) -> dict:
    """One card per axis and one for the channel: mean and sd of the sort metric over the successful
    cells with that value (all other dimensions averaged), under the current filters, by spread."""
    cards: list[dict] = []
    if metric is None or cells_f.empty or metric not in cells_f.columns:
        return {"cards": cards}
    ok = cells_f[cells_f["status"] != "error"]
    present = [a for a in axes if a in ok.columns]

    def stats(frame: pd.DataFrame, col: str, order: list[str]) -> list[dict]:
        g = frame.groupby(col, sort=False)[metric].agg(["mean", "std", "count"])
        return [
            {"value": v, "mean": _num(g.loc[v, "mean"]), "std": _num(g.loc[v, "std"]), "n": int(g.loc[v, "count"])}
            for v in order
            if v in g.index
        ]

    for axis in present:
        cards.append(_card(axis, "axis", stats(ok, axis, _ordered_values(run, axis))))
    if chans and len(ok):
        ch = run.channels.copy()
        ch[CHANNEL] = ch[CHANNEL].map(str)
        if channel_sel:
            ch = ch[ch[CHANNEL].isin(channel_sel)]
        joined = ch.merge(ok[["cell_id"]], on="cell_id", how="inner")
        if metric in joined.columns and len(joined):
            cards.append(_card(CHANNEL, "channel", stats(joined, CHANNEL, list(dict.fromkeys(joined[CHANNEL])))))
    cards = [c for c in cards if len(c["values"]) > 1]
    cards.sort(key=lambda c: -(c["spread"] or 0))
    mdef = project.metric(metric)
    for c in cards:
        means = [v["mean"] for v in c["values"] if v["mean"] is not None]
        pick = max if (mdef and mdef.direction == "max") else min
        c["best_value"] = next((v["value"] for v in c["values"] if v["mean"] == pick(means)), None) if means else None
    return {"cards": cards, "metric": metric}


def _card(key: str, kind: str, values: list[dict]) -> dict:
    means = [v["mean"] for v in values if v["mean"] is not None]
    return {"key": key, "kind": kind, "values": values, "spread": _num(max(means) - min(means)) if means else None}
