"""Helpers shared by the widgets."""

from __future__ import annotations

import pandas as pd

from ..aggregate import CHANNEL, _cells
from ..runs import Run

THIN = " "


def make_header(what: list[tuple[str, bool]], agg: str | None = None, fixed: dict | None = None, label: str = "FEST") -> dict:
    """The `header` of a widget result (v0.3.2, Q): the "what" line as parts (text, in mono), the aggregation note and the values
    line with the axes held at a value. `subtitle` stays for the plain-text readers (the agent)."""
    head: dict = {"what": [{"text": t, **({"mono": True} if m else {})} for t, m in what]}
    if agg:
        head["agg"] = agg
    if fixed:
        head["values"] = {"label": label, "style": "chips", "items": [[str(k), str(v)] for k, v in fixed.items()]}
    return head


def de(v: float | None, digits: int = 1) -> str:
    """German number format: decimal comma, narrow space as thousands separator."""
    if v is None or v != v:
        return "–"
    s = f"{abs(v):,.{digits}f}".replace(",", THIN).replace(".", ",")
    return ("−" if v < 0 and float(f"{abs(v):.{digits}f}") != 0 else "") + s


def metric_text(metric, v: float | None, digits: int | None = None) -> str:
    """Metric value with the unit and scale of the catalogue."""
    if v is None:
        return "–"
    x = v * (metric.scale if metric else 1.0)
    if digits is None:
        a = abs(x)
        digits = 0 if a >= 1000 else 1 if a >= 100 else 2 if a >= 10 else 3 if a >= 1 else 4
    return de(x, digits) + ((THIN + metric.unit) if metric and metric.unit else "")


def combo_cells(run: Run, combo: dict[str, str] | None, include_failed: bool = False) -> pd.DataFrame:
    """Cells of a combination (a table row): every dimension in `combo` must match. Replicates and
    axes that are not part of the combination stay free, so the cells are its replicates."""
    cells = _cells(run)
    if cells.empty:
        return cells
    if not include_failed:
        cells = cells[cells["status"] != "error"]
    for dim, value in (combo or {}).items():
        if dim in cells.columns:
            cells = cells[cells[dim] == str(value)]
    return cells


def first_value(run: Run, column: str, cells: pd.DataFrame) -> str | None:
    """First value of a replicate in grid order among the given cells."""
    if column not in cells.columns or cells.empty:
        return None
    present = set(cells[column])
    from ..aggregate import _ordered_values

    for v in _ordered_values(run, column):
        if v in present:
            return v
    return None


def seed_label(row: pd.Series, run: Run) -> str:
    keys = [r for r in run.replicates if r in row.index and r != "cv_fold"]
    return ", ".join(f"{k} {row[k]}" for k in keys) or str(row["cell_id"])[:6]


__all__ = ["CHANNEL", "combo_cells", "de", "first_value", "metric_text", "seed_label"]
