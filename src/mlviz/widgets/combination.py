"""Widgets of the detail of one combination (feature F): curves, forecast, replicates, config."""

from __future__ import annotations

import pandas as pd

from ..aggregate import CHANNEL, _ordered_values, dimension_axes, has_channels
from ..configview import run_config
from ..runs import Run, get_run
from .common import combo_cells, de, first_value, metric_text, seed_label
from .registry import Widget, seg, select, widget

NO_CURVES = "Dieser Lauf hat keine Lernkurven gespeichert"
NO_PREDICTIONS = "Dieser Lauf hat keine Vorhersagen gespeichert"


def _run(project, request) -> Run:
    run = get_run(project, request.get("run", ""))
    if run is None:
        raise LookupError("run not found")
    return run


def _of_cells(run: Run, table: str, cells: pd.DataFrame) -> pd.DataFrame | None:
    """Rows of a flat run table (`curves`, `predictions`) that belong to the given cells.

    These tables exist once per `cell_id` and carry no replicate columns; duplicates of a cell
    share its rows, so each `cell_id` is taken once."""
    df = run.table(table)
    if df is None or df.empty:
        return None
    ids = list(dict.fromkeys(cells["cell_id"]))
    sub = df[df["cell_id"].isin(ids)]
    return sub if not sub.empty else None


# --- Loss-Kurven ---------------------------------------------------------------------------------
@widget(
    Widget(
        key="curves",
        label="Loss-Kurven",
        question="Wann lernt das Modell, wann beginnt es zu überanpassen?",
        scopes=("combination",),
        settings=[seg("mode", "Seeds", [("single", "einzeln"), ("mean", "nur Mittel")], "single")],
        requires="curves",
    )
)
def curves(project, req: dict) -> dict:
    run = _run(project, req)
    if not run.has_curves:
        return {"unavailable": NO_CURVES}
    cells = combo_cells(run, req.get("combo"))
    fold = first_value(run, "cv_fold", cells)
    if fold is not None:  # one fold (the first) keeps the plot readable
        cells = cells[cells["cv_fold"] == fold]
    seeds: list[dict] = []
    long = _of_cells(run, "curves", cells)
    if long is not None:
        wide = long.pivot_table(index=["cell_id", "epoch"], columns="metric", values="value").reset_index()
        for _, row in cells.drop_duplicates("cell_id").iterrows():
            df = wide[wide["cell_id"] == row["cell_id"]].sort_values("epoch")
            if df.empty or "train_loss" not in df or "val_loss" not in df:
                continue
            seeds.append(
                {
                    "label": seed_label(row, run),
                    "epochs": [int(e) for e in df["epoch"]],
                    "train": [float(v) for v in df["train_loss"]],
                    "val": [float(v) for v in df["val_loss"]],
                }
            )
    if not seeds:
        return {"unavailable": "Für diese Kombination liegen keine Lernkurven vor"}
    n = min(len(s["epochs"]) for s in seeds)
    epochs = seeds[0]["epochs"][:n]
    mean = {
        k: [sum(s[k][i] for s in seeds) / len(seeds) for i in range(n)] for k in ("train", "val")
    }
    best_i = min(range(n), key=lambda i: mean["val"][i])
    best_epoch = epochs[best_i]
    return {
        "title": f"val_loss am niedrigsten in Epoche {best_epoch} von {epochs[-1]}",
        "subtitle": "train_loss und val_loss je Epoche"
        + (f" · Fold {fold}" if fold is not None else "")
        + f" · {len(seeds)} {'Seed' if len(seeds) == 1 else 'Seeds'}",
        "note": "gestrichelt = Epoche mit niedrigstem val_loss"
        + (" · dünn = einzelne Seeds" if req["settings"]["mode"] == "single" else ""),
        "data": {
            "epochs": epochs,
            "mean": mean,
            "seeds": [{"label": s["label"], "train": s["train"][:n], "val": s["val"][:n]} for s in seeds],
            "best_epoch": best_epoch,
            "last_epoch": epochs[-1],
            "mode": req["settings"]["mode"],
        },
    }


# --- Vorhersage ----------------------------------------------------------------------------------
def _predictions(run: Run, cells: pd.DataFrame, fold: str | None) -> pd.DataFrame | None:
    """Predictions of the given cells, one cell per `cell_id`; `__cell` names the cell of each row.
    `fold` is already applied to `cells`, the table itself has no replicate columns."""
    df = _of_cells(run, "predictions", cells)
    return None if df is None else df.assign(__cell=df["cell_id"])


def _pred_len(run: Run) -> int | None:
    v = (run.config.get("data") or {}).get("pred_len")
    return int(v) if isinstance(v, (int, float)) else None


def compare_options(run: Run, combo: dict[str, str]) -> list[dict]:
    """Other combinations of the run that differ from this one in exactly one axis."""
    out = []
    for axis in dimension_axes(run):
        for v in _ordered_values(run, axis):
            if v == combo.get(axis):
                continue
            out.append({"value": f"{axis}={v}", "label": f"{axis} = {v}"})
    return out


def _window(df: pd.DataFrame, run: Run, want: str | None):
    """The window to plot: the stored window (column `origin`) nearest to `want`, else a slice of
    `pred_len` days of the test period. Default: the last window."""
    dates = sorted(df["date"].astype(str).unique())
    if "origin" in df.columns:
        origins = sorted(df["origin"].astype(str).unique())
        if want:
            w = pd.Timestamp(want)
            origin = min(origins, key=lambda o: abs((pd.Timestamp(o) - w).days))
        else:
            origin = origins[-1]
        sub = df[df["origin"].astype(str) == origin]
        wdates = sorted(sub["date"].astype(str).unique())
        return sub, wdates, {"origins": origins, "start": wdates[0], "end": wdates[-1]}
    wlen = _pred_len(run) or len(dates)
    wlen = min(wlen, len(dates))
    if want:
        w = pd.Timestamp(want)
        start = min(range(len(dates)), key=lambda i: abs((pd.Timestamp(dates[i]) - w).days))
        start = max(0, min(start, len(dates) - wlen))
    else:
        start = len(dates) - wlen
    wdates = dates[start : start + wlen]
    return df[df["date"].astype(str).isin(wdates)], wdates, {"origins": None, "start": wdates[0], "end": wdates[-1]}


def _series(sub: pd.DataFrame, channel: str, dates: list[str]) -> dict:
    sub = sub[sub["channel"].astype(str) == channel]
    g = sub.groupby(sub["date"].astype(str))
    pred = g["y_pred"].agg(["mean", "min", "max"])
    actual = g["y_true"].mean()
    out = {"dates": [], "actual": [], "mean": [], "min": [], "max": [], "error": []}
    for d in dates:
        if d not in pred.index:
            continue
        a, p = float(actual[d]), float(pred.loc[d, "mean"])
        out["dates"].append(d)
        out["actual"].append(a)
        out["mean"].append(p)
        out["min"].append(float(pred.loc[d, "min"]))
        out["max"].append(float(pred.loc[d, "max"]))
        out["error"].append((p - a) / abs(a) * 100 if a else 0.0)
    return out


def _mape(s: dict) -> float | None:
    if not s["dates"]:
        return None
    return sum(abs(e) for e in s["error"]) / len(s["error"])


@widget(
    Widget(
        key="forecast",
        label="Vorhersage",
        question="Wie nah liegt die Vorhersage an den echten Werten?",
        scopes=("combination",),
        settings=[select("channel", "Kanal"), select("compare", "Vergleichen mit", "none"), select("window", "Fenster")],
        requires="predictions",
    )
)
def forecast(project, req: dict) -> dict:
    run = _run(project, req)
    if not run.has_predictions:
        return {"unavailable": NO_PREDICTIONS}
    combo = req.get("combo") or {}
    cells = combo_cells(run, combo)
    fold = first_value(run, "cv_fold", cells)
    if fold is not None:
        cells = cells[cells["cv_fold"] == fold]
    df = _predictions(run, cells, fold)
    if df is None:
        return {"unavailable": "Für diese Kombination liegen keine Vorhersagen vor"}
    st = req["settings"]
    channels = list(dict.fromkeys(df["channel"].astype(str)))
    channel = st.get("channel") if st.get("channel") in channels else (combo.get(CHANNEL) if combo.get(CHANNEL) in channels else channels[0])
    sub, wdates, win = _window(df[df["channel"].astype(str) == channel], run, st.get("window"))
    main = _series(sub, channel, wdates)
    overview_df = df[df["channel"].astype(str) == channel]
    ov = overview_df.groupby(overview_df["date"].astype(str))["y_true"].mean()
    options = compare_options(run, combo)

    compare = None
    other_label = None
    choice = st.get("compare") or "none"
    if choice != "none" and "=" in choice:
        axis, value = choice.split("=", 1)
        other_combo = {**combo, axis: value}
        other_cells = combo_cells(run, other_combo)
        other_fold = first_value(run, "cv_fold", other_cells)
        if other_fold is not None:
            other_cells = other_cells[other_cells["cv_fold"] == other_fold]
        odf = _predictions(run, other_cells, other_fold)
        if odf is not None:
            osub = odf[(odf["channel"].astype(str) == channel) & odf["date"].astype(str).isin(wdates)]
            if "origin" in osub.columns and "origin" in sub.columns:
                osub = osub[osub["origin"].astype(str) == str(sub["origin"].iloc[0])]
            compare = _series(osub, channel, wdates)
            other_label = value
    mape = _mape(main)
    title = f"Region {channel}: MAPE {de(mape)} %"
    if compare is not None and _mape(compare) is not None:
        title += f" gegenüber {de(_mape(compare))} % bei {other_label}"
    return {
        "title": title,
        "subtitle": f"Kanal {channel} · Fenster {win['start']} bis {win['end']}"
        + (f" · Fold {fold}" if fold is not None else "")
        + " · Mittel über Seeds mit Min-Max-Band",
        "note": "durchgezogen = echt · Linie = Vorhersage"
        + (f" · gestrichelt = {other_label}" if compare is not None else ""),
        "options": {
            "channel": channels,
            "compare": [{"value": "none", "label": "keine"}] + options,
            "window": win,
        },
        "data": {
            "channel": channel,
            "window": {**win, "days": len(wdates)},
            "series": main,
            "compare": None if compare is None else {"label": other_label, **compare},
            "overview": {"dates": list(ov.index), "actual": [float(v) for v in ov.values]},
            "mape": mape,
            "compare_mape": None if compare is None else _mape(compare),
        },
    }


# --- Wiederholungen ----------------------------------------------------------------------------
@widget(
    Widget(
        key="replicates",
        label="Wiederholungen",
        question="Wie stark streut das Ergebnis über Seeds und Folds?",
        scopes=("combination",),
        settings=[select("metric", "Metrik")],
    )
)
def replicates(project, req: dict) -> dict:
    run = _run(project, req)
    reps = [r for r in run.replicates if r in run.cells.columns]
    if not reps:
        return {"unavailable": "Dieser Lauf hat keine Wiederholungen"}
    metrics = [m for m in project.metrics if m.key in run.cells.columns]
    chosen = req["settings"].get("metric") or project.primary_for(run.meta)
    metric = next((m for m in metrics if m.key == chosen), metrics[0] if metrics else None)
    if metric is None:
        return {"unavailable": "Der Lauf hat keine Metriken"}
    cells = combo_cells(run, req.get("combo"), include_failed=True)
    row_key = reps[0]
    col_key = reps[1] if len(reps) > 1 else None
    rows = [v for v in _ordered_values(run, row_key) if v in set(cells[row_key])]
    cols = [v for v in _ordered_values(run, col_key) if v in set(cells[col_key])] if col_key else [""]
    grid: list[list[dict]] = []
    vals = []
    for r in rows:
        line = []
        for c in cols:
            sub = cells[cells[row_key] == r]
            if col_key:
                sub = sub[sub[col_key] == c]
            ok = sub[sub["status"] != "error"]
            if len(sub) == 0:
                line.append({"value": None, "failed": False, "missing": True})
            elif ok.empty:
                line.append({"value": None, "failed": True, "missing": False})
            else:
                v = float(ok[metric.key].mean())
                vals.append((v, r, c))
                line.append({"value": v, "failed": False, "missing": False})
        grid.append(line)
    if not vals:
        return {"unavailable": "Alle Zellen dieser Kombination sind fehlgeschlagen"}
    pick = max if metric.direction == "max" else min
    best = pick(vals, key=lambda x: x[0])
    lo, hi = min(v for v, _, _ in vals), max(v for v, _, _ in vals)
    where = f"{row_key} {best[1]}" + (f", {col_key} {best[2]}" if col_key else "")
    return {
        "title": f"Beste Wiederholung: {where} ({metric_text(metric, best[0])})",
        "subtitle": f"{metric.label} je {row_key}" + (f" und {col_key}" if col_key else "") + f" · Spanne {metric_text(metric, hi - lo)}",
        "note": "heller = besser · leer = fehlgeschlagen",
        "options": {"metric": [{"value": m.key, "label": m.label} for m in metrics]},
        "data": {
            "metric": {"key": metric.key, "label": metric.label, "unit": metric.unit, "scale": metric.scale, "direction": metric.direction},
            "row_key": row_key,
            "col_key": col_key,
            "rows": rows,
            "cols": cols,
            "grid": grid,
            "lo": lo,
            "hi": hi,
            "best": {"row": best[1], "col": best[2]},
        },
    }


# --- Config --------------------------------------------------------------------------------------
@widget(
    Widget(
        key="config",
        label="Config",
        question="Mit welcher Config wurde diese Kombination gerechnet?",
        scopes=("combination", "run"),
        settings=[seg("view", "Ansicht", [("blocks", "Blöcke"), ("yaml", "YAML")], "blocks")],
    )
)
def config(project, req: dict) -> dict:
    """The resolved config of a combination. In the scope "one run" it is the best combination
    (best group mean of the first real metric) within the filter."""
    run = _run(project, req)
    combo = {k: v for k, v in (req.get("combo") or {}).items() if k in run.axes}
    if req.get("scope") == "run":
        from .runscope import best_combo, real_metrics

        axes = dimension_axes(run)
        frame = combo_cells(run, combo)
        metrics = real_metrics(project, run)
        if metrics and not frame.empty:
            combo = {**best_combo(run, frame, axes, metrics[0]), **combo}
    cfg = run_config(project, run, combo)
    diff = sum(b["differs"] for b in cfg["blocks"])
    n_axes = len(cfg["grid"]["axes"])
    title = f"Config: {n_axes} {'Achse' if n_axes == 1 else 'Achsen'} im Grid" + (
        f", {diff} {'Abweichung' if diff == 1 else 'Abweichungen'} von base" if cfg["base_known"] else ""
    )
    if req.get("scope") == "run" and combo:
        title = "Beste Config: " + ", ".join(f"{k} = {v}" for k, v in combo.items())
    return {
        "title": title,
        "subtitle": run.name,
        "note": None,
        "data": {"view": req["settings"]["view"], "combo": combo},
    }
