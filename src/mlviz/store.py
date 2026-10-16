"""The one place that reads run tables: the `ds-store` package.

The run folder layout (one file per table, or part files while a run is going) is the business of
`ds-store`; this tool never opens a run table itself. What it uses:

- `list_runs(runs_root)`: one dict per run (meta essentials plus planned/done/ok/error/remaining/state;
  a run from a newer package is listed with `state: "unsupported"` and a `message`)
- `read_table(run_dir, name, with_cells=False)`: `cells`, `channels`, `curves`, `predictions`, `plan`
  as one table (empty when the run has none); `with_cells=True` adds the axis and replicate columns
- `run_status(run_dir)`: the same numbers for one run; state is `finished`, `running` or `stalled`
- `table_version(run_dir, name)`: changes when the table's files change (cache key)

`meta.json` and `config.yaml` are plain files and are read by `runs.py`.
"""

from __future__ import annotations

import time
from functools import lru_cache
from pathlib import Path

import pandas as pd

#: `run_status` depends on the clock (running -> stalled); its cache entries live this long.
STATUS_TTL_S = 30


class StoreError(RuntimeError):
    """`ds-store` could not read a run (for example a `store_version` newer than the package knows)."""


class StoreUnavailable(StoreError):
    """The `ds-store` package is not installed."""


def _api():
    try:
        import ds_store
    except ImportError as e:
        raise StoreUnavailable(
            "Das Paket ds-store ist nicht installiert. Es liest die Läufe, ohne es zeigt das Tool keine Ergebnisse."
        ) from e
    return ds_store


def _wrap(error: Exception) -> StoreError:
    return error if isinstance(error, StoreError) else StoreError(str(error))


def table_version(run_dir: Path, name: str) -> tuple:
    return _api().table_version(Path(run_dir), name)


def version(run_dir: Path) -> tuple:
    """Cache key of a run: the files of its tables and `meta.json` (a running experiment changes both)."""
    run_dir = Path(run_dir)
    try:
        meta = (run_dir / "meta.json").stat().st_mtime_ns
    except OSError:
        meta = 0
    return (meta, *(table_version(run_dir, t) for t in ("plan", "cells", "channels", "curves", "predictions")))


@lru_cache(maxsize=256)
def _read_table(run_dir: str, name: str, with_cells: bool, key: tuple) -> pd.DataFrame | None:
    api = _api()
    try:
        df = api.read_table(Path(run_dir), name, with_cells=True) if with_cells else api.read_table(Path(run_dir), name)
    except Exception as e:
        raise _wrap(e) from e
    return None if df.empty else df


def read_table(run_dir: Path, name: str, with_cells: bool = False) -> pd.DataFrame | None:
    """A run table, or None when the run has no rows in it."""
    return _read_table(str(run_dir), name, with_cells, version(run_dir))


@lru_cache(maxsize=256)
def _run_status(run_dir: str, key: tuple, bucket: int) -> dict:
    try:
        return dict(_api().run_status(Path(run_dir)))
    except Exception as e:
        raise _wrap(e) from e


def run_status(run_dir: Path) -> dict:
    return _run_status(str(run_dir), version(run_dir), int(time.time() // STATUS_TTL_S))


def list_runs(runs_root: Path) -> list[tuple[Path, dict]]:
    """Run folders with their status dicts, as `ds-store` lists them. A run it cannot read comes back
    with `state: "unsupported"` and a `message`."""
    try:
        items = _api().list_runs(Path(runs_root))
    except Exception as e:
        raise _wrap(e) from e
    return [(Path(runs_root) / item["run"], dict(item)) for item in items]
