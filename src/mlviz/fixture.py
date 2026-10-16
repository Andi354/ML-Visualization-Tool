"""Synthetic demo project in the layout of a ds-init project.

Used by the tests and by `mlviz demo <dir>` to try the tool without real results. All numbers are
made up and deterministic. The tables are written with the writers of `ds-store`, so the layout is the
run format of ds-init (store_version 1): `plan`, `cells`, `channels`, `curves`, `predictions`, the last
two flat with `cell_id`; `config.base.yaml` sits next to `config.yaml`. A finished run is compacted
(one file per table), a running one keeps its part files.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import math
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import yaml
from ds_store import compact, write_part, write_plan

SCALED = ["test_mse_missing", "test_mae_missing", "test_rmse_missing", "test_mape_missing"]
REAL = [
    "test_mape",
    "test_mae",
    "test_mse",
    "test_rmse",
    "test_commitment_cost",
    "test_asymmetric_cost_real",
]
CHANNELS = ["us", "eu", "asia", "latam"]

PROJECT = {
    "name": "Demo Bench",
    "paths": {"runs": "runs", "configs": "configs"},
    "outputs": {"analysis": "analysis", "research": "research", "deliverables": "deliverables"},
    "primary_metric": "test_mse_missing",
    "metrics": [
        {"key": "test_mse_missing", "label": "MSE skaliert", "direction": "min", "viz": {"family": "scaled"}},
        {"key": "test_mae_missing", "label": "MAE skaliert", "direction": "min", "viz": {"family": "scaled"}},
        {"key": "test_rmse_missing", "label": "RMSE skaliert", "direction": "min", "viz": {"family": "scaled"}},
        {"key": "test_mape_missing", "label": "MAPE skaliert", "direction": "min", "viz": {"family": "scaled"}},
        {
            "key": "test_mape",
            "label": "MAPE",
            "direction": "min",
            "viz": {"family": "real"},
            "unit": "%",
            "scale": 100,
        },
        {"key": "test_mae", "label": "MAE", "direction": "min", "viz": {"family": "real"}},
        {"key": "test_mse", "label": "MSE", "direction": "min", "viz": {"family": "real"}},
        {"key": "test_rmse", "label": "RMSE", "direction": "min", "viz": {"family": "real"}},
        {"key": "test_commitment_cost", "label": "Commitment Cost", "direction": "min", "viz": {"family": "real"}},
        {
            "key": "test_asymmetric_cost_real",
            "label": "Asymmetrische Kosten",
            "direction": "min",
            "viz": {"family": "real"},
        },
    ],
    "viz": {"short": "DB", "own_model": {"axis": "forecaster", "value": "rep-net"}},
}

EPOCHS = {
    "epochs": [
        {"name": "tsrm6", "since": "2026-09-01", "description": "TSRM v6 encoder"},
        {
            "name": "eval-all-windows",
            "since": "2026-10-05",
            "description": "evaluation over all windows",
        },
    ]
}

BASE_CONFIG = {
    "data": {
        "data_path": "data/demo_daily.csv",
        "seq_len": 90,
        "pred_len": 30,
        "target": "usage",
        "test_quarters": 3,
        "calendar_mode": "full",
    },
    "model": {
        "encoding_size": 64,
        "lstm_layer": 1,
        "conv_dims": [16, 32],
        "representation_module": "tsrm",
        "time_embedding": "calendar",
        "forecaster": "rep-net",
    },
    "train": {
        "learning_rate": 1.0e-3,
        "max_epochs": 40,
        "weight_decay": 0.0,
        "loss_function_forecasting": "mse",
        "calc_real": True,
        "calc_per_channel": True,
    },
    "replicates": {"cv_fold": [0, 1]},
    "run": {"keep_checkpoints": "best", "predictions": "none"},
}

NOW = datetime(2026, 10, 15, 12, 0, 0)


def _unit(*parts) -> float:
    """Deterministic value in [-1, 1] from the given parts."""
    h = hashlib.sha256("|".join(str(p) for p in parts).encode()).digest()
    return int.from_bytes(h[:4], "big") / 2**31 - 1


def label(value) -> str:
    """Cell value of an axis as stored in the tables (lists as JSON, pairs as label)."""
    if isinstance(value, dict):
        return ", ".join(f"{k}={v}" for k, v in value.items())
    if isinstance(value, list):
        return json.dumps(value)
    return str(value)


def _deep_merge(a: dict, b: dict) -> dict:
    out = dict(a)
    for k, v in b.items():
        out[k] = _deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


# Each run: (experiment, timestamp, overrides, sweep, replicates, flags)
RUNS = [
    dict(
        experiment="TIM-30_baselines_30",
        issue="TIM-30",
        ts=datetime(2026, 9, 12, 9, 30, 0),
        epoch="tsrm6",
        migrated=True,
        config={"data": {"pred_len": 30}},
        sweep={"forecaster": ["rep-net", "sarima", "ets", "prophet", "snaive"]},
        replicates={"shuffle_seed": [1, 2, 3]},
    ),
    dict(
        experiment="TIM-39_grid_multivariate_30",
        issue="TIM-39",
        ts=datetime(2026, 9, 18, 14, 5, 0),
        epoch="tsrm6",
        migrated=True,
        config={"data": {"pred_len": 30}},
        sweep={
            "conv_dims": [[8], [16], [16, 32], [32, 64], [64], [8, 16], [32]],
            "representation_module": ["tsrm", "cnn", "lstm", "mlp", "tcn", "gru", "attn"],
            "lstm_layer": [0, 1],
            "time_embedding": ["calendar", "none", "learned"],
        },
        replicates={"shuffle_seed": [1]},
        error_rate=0.04,
    ),
    dict(
        experiment="TIM-45_g6_combined",
        issue="TIM-45",
        ts=datetime(2026, 9, 25, 16, 40, 0),
        epoch="tsrm6",
        migrated=True,
        config={"data": {"pred_len": 30}},
        sweep={
            "lr_epochs": [
                {"learning_rate": 5.0e-4, "max_epochs": 20},
                {"learning_rate": 5.0e-4, "max_epochs": 60},
                {"learning_rate": 1.0e-3, "max_epochs": 20},
            ],
            "lstm_layer": [0, 1],
            "time_embedding": ["calendar", "none"],
        },
        replicates={"shuffle_seed": [1, 2, 3]},
    ),
    dict(
        experiment="TIM-52_best_30",
        issue="TIM-52",
        ts=datetime(2026, 10, 6, 10, 0, 0),
        epoch="eval-all-windows",
        config={"data": {"pred_len": 30}},
        sweep={"forecaster": ["rep-net", "sarima", "ets", "prophet", "snaive"]},
        replicates={"shuffle_seed": [1, 2, 3], "cv_fold": [0, 1]},
    ),
    dict(
        experiment="TIM-52_best_30",
        issue="TIM-52",
        ts=datetime(2026, 10, 8, 11, 20, 0),
        epoch="eval-all-windows",
        config={"data": {"pred_len": 30}},
        sweep={"forecaster": ["rep-net", "sarima", "ets", "prophet", "snaive"]},
        replicates={"shuffle_seed": [1, 2, 3], "cv_fold": [0, 1]},
    ),
    dict(
        experiment="TIM-52_best_90",
        issue="TIM-52",
        ts=datetime(2026, 10, 9, 8, 45, 0),
        epoch="eval-all-windows",
        config={"data": {"pred_len": 90}},
        sweep={"forecaster": ["rep-net", "sarima", "ets", "prophet", "snaive"]},
        replicates={"shuffle_seed": [1, 2, 3], "cv_fold": [0, 1]},
    ),
    dict(
        experiment="TIM-71_example",
        issue="TIM-71",
        ts=datetime(2026, 10, 13, 15, 10, 0),
        epoch="eval-all-windows",
        config={"data": {"pred_len": 30}, "run": {"keep_checkpoints": "best", "predictions": "all"}},
        sweep={"forecaster": ["rep-net", "ets"], "lstm_layer": [0, 1]},
        replicates={"shuffle_seed": [1, 2], "cv_fold": [0, 1]},
        extras=True,
    ),
    dict(
        experiment="TIM-83_running_sweep",
        issue="TIM-83",
        ts=datetime(2026, 10, 15, 11, 0, 0),
        epoch="eval-all-windows",
        config={"data": {"pred_len": 30}},
        sweep={"encoding_size": [16, 32, 64, 128], "lstm_layer": [0, 1, 2]},
        replicates={"shuffle_seed": [1, 2]},
        running=0.4,
    ),
    dict(
        experiment="sweep_check",
        issue=None,
        ts=datetime(2026, 10, 14, 9, 0, 0),
        epoch="eval-all-windows",
        config={"data": {"pred_len": 30}},
        sweep={"time_embedding": ["calendar", "none"]},
        replicates={"shuffle_seed": [1, 2]},
    ),
]


def run_folder(r: dict) -> str:
    return f"{r['ts']:%Y-%m-%d_%H%M}_{r['experiment']}"


def _seed(r: dict) -> str:
    """Seed text of a run for the made-up numbers (independent of the folder name format)."""
    return f"{r['ts']:%Y-%m-%d_%H%M%S}_{r['experiment']}"


def _metrics(r: dict, combo: dict, rep: dict, channel: str | None = None) -> dict[str, float]:
    key = tuple(sorted((k, label(v)) for k, v in combo.items()))
    eff = 0.0
    for k, v in key:
        e = _unit(r["experiment"], k, v)
        if k == "forecaster":
            e = {"rep-net": -0.12, "ets": 0.0, "prophet": 0.1, "sarima": 0.06, "snaive": 0.25}.get(v, e)
        else:
            e *= 0.08
        eff += e
    pred_len = r["config"]["data"]["pred_len"]
    noise = _unit(_seed(r), key, tuple(sorted(rep.items())), channel) * 0.04
    ch = 0.0 if channel is None else _unit(channel, key) * 0.05 + CHANNELS.index(channel) * 0.04
    mse = 0.8 * (1 + eff) * (1 + 0.004 * pred_len) * (1 + noise) * (1 + ch)
    mape = 0.025 * math.sqrt(mse / 0.8) * (1 + 0.003 * pred_len)
    mae = 7.0 * math.sqrt(mse) / 1.0
    return {
        "test_mse_missing": mse,
        "test_mae_missing": math.sqrt(mse) * 0.8,
        "test_rmse_missing": math.sqrt(mse),
        "test_mape_missing": mape * 3.0,
        "test_mape": mape,
        "test_mae": mae,
        "test_mse": mae**2,
        "test_rmse": mae * 1.1,
        "test_commitment_cost": 2000 * (1 + eff) * (1 + noise),
        "test_asymmetric_cost_real": 90 * (1 + eff + noise),
    }


def _combos(sweep: dict) -> list[dict]:
    keys = list(sweep)
    return [dict(zip(keys, vals)) for vals in itertools.product(*(sweep[k] for k in keys))]


def _write_run(root: Path, r: dict) -> None:
    folder = root / "runs" / run_folder(r)
    folder.mkdir(parents=True, exist_ok=True)
    config = _deep_merge(BASE_CONFIG, r["config"])
    config["sweep"] = r["sweep"]
    config["replicates"] = r["replicates"]
    config["report"] = {"groups": [list(r["sweep"])[0]]}
    if r.get("migrated"):
        config["run"] = {"keep_checkpoints": "all", "predictions": "none"}
    (folder / "config.yaml").write_text(yaml.safe_dump(config, sort_keys=False, allow_unicode=True))

    combos = _combos(r["sweep"])
    rep_keys = list(r["replicates"])
    reps = [dict(zip(rep_keys, v)) for v in itertools.product(*(r["replicates"][k] for k in rep_keys))]
    planned: list[dict] = []
    for c in combos:
        for rep in reps:
            planned.append({"combo": c, "rep": rep})

    rng = np.random.default_rng(abs(hash_int(_seed(r))))
    n_written = len(planned)
    if r.get("running"):
        n_written = int(len(planned) * r["running"])
    error_rate = r.get("error_rate", 0.0)
    started = r["ts"]
    n_dup = r.get("duplicates", 0)

    cells, chans, plan_rows = [], [], []
    first_row: dict[str, int] = {}
    for i, p in enumerate(planned):
        eff_key = json.dumps([label(v) for v in p["combo"].values()] + [str(sorted(p["rep"].items()))])
        if n_dup and i >= len(planned) - n_dup:  # the last cells repeat the first ones
            eff_key = json.dumps([label(v) for v in planned[i - (len(planned) - n_dup)]["combo"].values()]
                                 + [str(sorted(planned[i - (len(planned) - n_dup)]["rep"].items()))])
        cid = hashlib.sha256((r["experiment"] + eff_key).encode()).hexdigest()[:16]
        duplicate_of = first_row.get(cid)
        first_row.setdefault(cid, i)
        axes_row = {k: label(v) for k, v in p["combo"].items()}
        plan_rows.append({"row": i, "cell_id": cid, "duplicate_of": duplicate_of, **axes_row, **p["rep"]})
        if i >= n_written:
            continue
        finished = started + timedelta(seconds=40 * (i + 1))
        row = {
            "row": i,
            "cell_id": cid,
            **axes_row,
            **p["rep"],
            "is_duplicate": duplicate_of is not None,
            "duplicate_of": duplicate_of,
        }
        if duplicate_of is not None:  # a duplicate carries the values of its original
            orig = next(c for c in cells if c["row"] == duplicate_of)
            cells.append({**orig, **row, "finished_at": finished.isoformat(), "shard": 0})
            for ch in [c for c in chans if c["row"] == duplicate_of]:
                chans.append({**ch, "row": i, "is_duplicate": True, "duplicate_of": duplicate_of, "finished_at": finished.isoformat()})
            continue
        failed = rng.random() < error_rate
        row["status"] = "error" if failed else "ok"
        row["error"] = "CUDA out of memory" if failed else None
        row["duration_s"] = float(30 + 20 * rng.random())
        row["finished_at"] = finished.isoformat()
        row["shard"] = i % 2
        row["n_params"] = 40_000 + 1_000 * (i % 7)
        m = _metrics(r, p["combo"], p["rep"])
        for k in SCALED + REAL:
            row[k] = None if failed else m[k]
        cells.append(row)
        if not failed:
            for ch in CHANNELS:
                cm = _metrics(r, p["combo"], p["rep"], ch)
                chans.append(
                    {
                        "row": i,
                        "cell_id": cid,
                        **axes_row,
                        **p["rep"],
                        "is_duplicate": False,
                        "duplicate_of": None,
                        "channel": ch,
                        **{k: cm[k] for k in SCALED + REAL},
                        "finished_at": finished.isoformat(),
                    }
                )

    cells_df = pd.DataFrame(cells)
    chans_df = pd.DataFrame(chans)
    write_plan(folder, pd.DataFrame(plan_rows))
    for shard in sorted(set(cells_df["shard"])) if len(cells_df) else []:
        write_part(folder, "cells", int(shard), cells_df[cells_df["shard"] == shard])
        if len(chans_df):
            write_part(folder, "channels", int(shard), chans_df[chans_df["row"].isin(cells_df.loc[cells_df["shard"] == shard, "row"])])
    if not r.get("migrated"):  # runs from before the new format have no base config
        (folder / "config.base.yaml").write_text(yaml.safe_dump(BASE_CONFIG, sort_keys=False, allow_unicode=True))

    # summary.csv: one row per group (replicates averaged)
    axes = list(r["sweep"])
    ok = cells_df[cells_df["status"] == "ok"]
    if len(ok):
        agg = {}
        for mkey in SCALED + REAL:
            agg[mkey + "_mean"] = (mkey, "mean")
            agg[mkey + "_std"] = (mkey, "std")
            agg[mkey + "_median"] = (mkey, "median")
            agg[mkey + "_min"] = (mkey, "min")
            agg[mkey + "_max"] = (mkey, "max")
        summary = ok.groupby(axes, sort=False).agg(n=("cell_id", "count"), **agg).reset_index()
        summary = summary.sort_values("test_mse_missing_mean")
        summary.to_csv(folder / "summary.csv", index=False)

    ended = None if r.get("running") else started + timedelta(minutes=12 + len(planned) // 20)
    meta = {
        "name": r["experiment"],
        "store_version": 1,
        "issue": r["issue"],
        "config": None if r.get("migrated") else f"configs/experiments/{r['issue'] or 'misc'}/{r['experiment']}.yaml",
        "command": None if r.get("migrated") else f"mlviz-bench run {r['experiment']}",
        "started_at": started.isoformat(),
        "ended_at": ended.isoformat() if ended else None,
        "axes": axes,
        "replicates": rep_keys,
        "primary_metric": "test_mse_missing",
        "epoch": r["epoch"],
        "commit": hashlib.sha1(_seed(r).encode()).hexdigest()[:7],
        "plan": {"cells": len(planned), "excluded": 0, "duplicates": n_dup},
    }
    if r.get("migrated"):
        meta["migrated"] = True
    if ended:  # `counts` is the final tally, written at the end of a run
        meta["counts"] = {
            "planned": len(planned),
            "written": len(cells_df),
            "ok": int((cells_df["status"] == "ok").sum()),
            "error": int((cells_df["status"] == "error").sum()),
            "duplicates": n_dup,
        }
    (folder / "meta.json").write_text(json.dumps(meta, indent=2))

    if r.get("extras"):
        _write_curves_predictions(folder, cells_df, r)
    if ended:  # a finished run is compacted, a running one keeps its parts
        compact(folder)


def hash_int(s: str) -> int:
    return int(hashlib.sha1(s.encode()).hexdigest()[:8], 16)


def _write_curves_predictions(folder: Path, cells: pd.DataFrame, r: dict) -> None:
    """`curves` (cell_id, epoch, metric, value) and `predictions` (cell_id, date, channel, y_pred, y_true)
    exist once per cell_id; they carry no replicate columns."""
    curves, preds = [], []
    pred_len = r["config"]["data"]["pred_len"]
    start = datetime(2026, 1, 1)
    for _, row in cells.drop_duplicates("cell_id").iterrows():
        cid = row["cell_id"]
        seed = int(row["shuffle_seed"])
        best = 27 + (seed % 3)
        for ep in range(1, 41):
            tr = 1.0 / (1 + 0.12 * ep) + 0.02 * _unit(cid, ep, "t")
            va = 1.0 / (1 + 0.1 * ep) + 0.0025 * (ep - best) ** 2 / 10 + 0.02 * _unit(cid, ep, "v") + 0.1
            curves.append({"cell_id": cid, "epoch": ep, "metric": "train_loss", "value": tr})
            curves.append({"cell_id": cid, "epoch": ep, "metric": "val_loss", "value": va})
        for ch in CHANNELS:
            for d in range(3 * pred_len):  # the whole test period
                date = start + timedelta(days=d)
                actual = 100 + 15 * math.sin(d / 7.0) + 5 * _unit(ch, d)
                pred = actual + 3 * _unit(cid, ch, d, "p")
                preds.append(
                    {"cell_id": cid, "date": date.date().isoformat(), "channel": ch, "y_pred": pred, "y_true": actual}
                )
    write_part(folder, "curves", 0, pd.DataFrame(curves))
    write_part(folder, "predictions", 0, pd.DataFrame(preds))


def make_project(root: Path | str) -> Path:
    """Write the demo project into `root` (created if needed) and return it."""
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    (root / "project.yaml").write_text(yaml.safe_dump(PROJECT, sort_keys=False, allow_unicode=True))
    (root / "epochs.yaml").write_text(yaml.safe_dump(EPOCHS, sort_keys=False))
    (root / "configs" / "base").mkdir(parents=True, exist_ok=True)
    (root / "configs" / "base" / "demo_daily.yaml").write_text(
        yaml.safe_dump({**BASE_CONFIG}, sort_keys=False)
    )
    for r in RUNS:
        if not r.get("migrated"):
            d = root / "configs" / "experiments" / (r["issue"] or "misc")
            d.mkdir(parents=True, exist_ok=True)
            (d / f"{r['experiment']}.yaml").write_text(
                yaml.safe_dump(
                    {"base": ["../../base/demo_daily.yaml"], **{k: v for k, v in r["config"].items()}, "sweep": r["sweep"], "replicates": r["replicates"]},
                    sort_keys=False,
                )
            )
        _write_run(root, r)
    for sub in ("deliverables", "analysis"):
        (root / sub).mkdir(exist_ok=True)
    # an analysis and a deliverable folder linked to TIM-52 by the issue ID
    (root / "analysis" / "TIM-52_best_config").mkdir(exist_ok=True)
    (root / "analysis" / "TIM-52_best_config" / "report.md").write_text("# TIM-52\n")
    (root / "deliverables" / "2026-10-09 Comparison TIM-52").mkdir(exist_ok=True)
    (root / "deliverables" / "2026-10-09 Comparison TIM-52" / "README.md").write_text("TIM-52\n")
    return root
