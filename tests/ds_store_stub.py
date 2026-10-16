"""Stand-in for the `ds-store` package in tests (`list_runs`, `read_table`, `run_status`).

The real package comes with the migration of the project (TIM-71); until it is installed the tests
use this stub. It is test code only: the tool itself never reads a table. The stub follows the run
format of ds-init (store_version 1): one `<table>.parquet` per table, or part files
`<table>/part-<shard>-<n>.parquet` while a run is going; a cell written twice resolves to its newest row.
"""

from __future__ import annotations

import json
import sys
import time
import types
from pathlib import Path

import pandas as pd

STALE_AFTER = 15 * 60
SUPPORTED_STORE_VERSION = 1


def _meta(run_dir: Path) -> dict:
    return json.loads((Path(run_dir) / "meta.json").read_text())


def _check_version(meta: dict) -> None:
    if int(meta.get("store_version") or 0) > SUPPORTED_STORE_VERSION:
        raise RuntimeError(f"store_version {meta['store_version']} is newer than this ds-store knows")


def _raw(run_dir: Path, name: str) -> pd.DataFrame:
    run_dir = Path(run_dir)
    _check_version(_meta(run_dir))
    files = [run_dir / f"{name}.parquet"] if (run_dir / f"{name}.parquet").exists() else []
    files += sorted((run_dir / name).glob("part-*.parquet")) if (run_dir / name).is_dir() else []
    if not files:
        raise FileNotFoundError(f"{run_dir.name} has no table {name}")
    return pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)


def read_table(run_dir, name: str, with_cells: bool = False) -> pd.DataFrame:
    df = _raw(run_dir, name)
    if name in ("cells", "channels") and "finished_at" in df.columns:
        key = ["row"] if name == "cells" and "row" in df.columns else None
        if key:
            df = df.sort_values("finished_at").drop_duplicates(key, keep="last").sort_values("row")
    if with_cells and name not in ("cells", "plan"):
        cells = _raw(run_dir, "cells")
        extra = [c for c in cells.columns if c not in df.columns or c == "cell_id"]
        df = df.merge(cells[extra].drop_duplicates("cell_id"), on="cell_id", how="left")
    return df.reset_index(drop=True)


def run_status(run_dir) -> dict:
    run_dir = Path(run_dir)
    meta = _meta(run_dir)
    _check_version(meta)
    try:
        cells = read_table(run_dir, "cells")
    except FileNotFoundError:
        cells = pd.DataFrame(columns=["status"])
    planned = (meta.get("plan") or {}).get("cells")
    done = len(cells)
    ok = int((cells.get("status") == "ok").sum()) if len(cells) else 0
    error = int((cells.get("status") == "error").sum()) if len(cells) else 0
    if meta.get("ended_at"):
        state = "finished"
    else:
        newest = max((f.stat().st_mtime for f in run_dir.rglob("*.parquet")), default=0)
        state = "running" if time.time() - newest < STALE_AFTER else "stalled"
    return {
        "planned": planned,
        "done": done,
        "ok": ok,
        "error": error,
        "remaining": None if planned is None else planned - done,
        "state": state,
    }


def list_runs(runs_root) -> list[dict]:
    out = []
    for p in sorted(Path(runs_root).iterdir()):
        if p.is_dir() and (p / "meta.json").exists():
            out.append({"id": p.name, "name": _meta(p).get("name"), **run_status(p)})
    return out


def install() -> types.ModuleType:
    """Make `import ds_store` resolve to this stub."""
    module = types.ModuleType("ds_store")
    module.read_table = read_table
    module.run_status = run_status
    module.list_runs = list_runs
    sys.modules["ds_store"] = module
    return module
