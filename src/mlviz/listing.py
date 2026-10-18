"""Facts about runs shown in the run list (feature C): counts, best value, Lauf-Merkmal."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from . import store
from .project import Metric, Project
from .runs import Run

#: Config blocks whose constant entries can distinguish runs from one another (Lauf-Merkmale).
#: `run`, `report` and `base` describe how a run was executed, not what it compares.
MERKMAL_BLOCKS = ("data", "model", "train")
#: An entry counts as candidate when it has between 2 and this many distinct values across runs.
MERKMAL_MAX_VALUES = 6


def flat_config(run: Run) -> dict[str, str]:
    """Constant config entries of a run as `block.key -> text`; swept and replicate keys are left out."""
    cfg = run.config
    varied = set(run.axes) | set(run.replicates)
    out: dict[str, str] = {}
    for block in MERKMAL_BLOCKS:
        entries = cfg.get(block)
        if not isinstance(entries, dict):
            continue
        for key, value in entries.items():
            if key in varied:
                continue
            out[f"{block}.{key}"] = value if isinstance(value, str) else json.dumps(value)
    return out


def merkmal_candidates(runs: list[Run]) -> list[str]:
    """Config entries that are constant inside a run but differ between runs, in config order."""
    values: dict[str, set[str]] = {}
    order: list[str] = []
    for run in runs:
        for key, value in flat_config(run).items():
            if key not in values:
                order.append(key)
            values.setdefault(key, set()).add(value)
    keep = [k for k in order if 2 <= len(values[k]) <= MERKMAL_MAX_VALUES]
    block_rank = {b: i for i, b in enumerate(MERKMAL_BLOCKS)}
    return sorted(keep, key=lambda k: block_rank[k.split(".", 1)[0]])  # stable within a block


@lru_cache(maxsize=512)
def _best(path: str, version: tuple, metric: str, direction: str, axes: tuple[str, ...]) -> float | None:
    run = Run(Path(path))
    ok = run.ok_cells()
    if ok.empty or metric not in ok.columns:
        return None
    cols = [a for a in axes if a in ok.columns]
    means = ok.groupby(cols, dropna=False)[metric].mean() if cols else ok[[metric]].mean()
    means = means.dropna()
    if means.empty:
        return None
    return float(means.max() if direction == "max" else means.min())


def group_best(run: Run, metric: Metric) -> float | None:
    """Best group mean (replicates averaged) of a metric over the successful cells of a run."""
    return _best(str(run.path), store.version(run.path), metric.key, metric.direction, tuple(run.axes))


def pick_merkmal(candidates: list[str], setting: str) -> str | None:
    """The Lauf-Merkmal by the setting `runs.feature`: `auto` the first candidate, `none` none, else the candidate named
    (`block.name` or just `name`); a name that is no candidate falls back to `auto`."""
    if setting == "none":
        return None
    for key in candidates:
        if setting in (key, key.split(".", 1)[-1]):
            return key
    return candidates[0] if candidates else None


def run_listing(project: Project, run: Run, candidates: list[str], feature: str = "auto", metric_key: str = "yaml") -> dict[str, Any]:
    if run.problem:  # a store_version this package does not know: no numbers, only the reason
        return {**run.info(), "cells": 0, "planned": 0, "errors": 0, "best": None, "merkmal": None, "config_values": {}}
    metric = project.metric(metric_key) if metric_key != "yaml" else None  # a metric the project does not know: the default
    metric = metric or project.first_real_metric() or (project.metric(project.primary_metric or "") if project.primary_metric else None)
    best = None
    if metric is not None:
        value = group_best(run, metric)
        if value is not None:
            best = {
                "metric": metric.key,
                "label": metric.label,
                "unit": metric.unit,
                "scale": metric.scale,
                "value": value,
            }
    flat = flat_config(run)
    merkmal = None
    key = pick_merkmal(candidates, feature)
    if key is not None:
        if key in flat:
            merkmal = {"key": key, "label": key.split(".", 1)[1], "value": flat[key]}
    return {
        **run.info(),
        "cells": run.done_cells,
        "planned": run.planned_cells if run.planned_cells is not None else run.done_cells,
        "errors": run.error_count(),
        "best": best,
        "merkmal": merkmal,
        "config_values": {k: flat[k] for k in candidates if k in flat},
    }
