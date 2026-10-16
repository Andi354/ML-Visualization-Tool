"""The one place that reads run tables: the `ds-store` package.

The run folder layout (one file per table, or part files while a run is going) is the business of
`ds-store`; this tool never opens a run table itself. Three functions are used:

- `list_runs(runs_root)`: one dict per run (meta essentials plus planned/done/ok/error/remaining/state)
- `read_table(run_dir, name, with_cells=False)`: `cells`, `channels`, `plan`, `curves`, `predictions`;
  `with_cells=True` adds the axis and replicate columns of each `cell_id`
- `run_status(run_dir)`: the same numbers for one run; state is `finished`, `running` or `stalled`

`meta.json` and `config.yaml` are plain files and are read by `runs.py`.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd


class StoreError(RuntimeError):
    """`ds-store` could not read a run (for example a `store_version` newer than the package knows)."""


class StoreUnavailable(StoreError):
    """The `ds-store` package is not installed."""


def _api():
    try:
        import ds_store
    except ImportError as e:  # pragma: no cover - exercised through a monkeypatched import in tests
        raise StoreUnavailable(
            "Das Paket ds-store ist nicht installiert. Es liest die Läufe, ohne es zeigt das Tool keine Ergebnisse."
        ) from e
    return ds_store


def signature(run_dir: Path) -> int:
    """Newest modification time in a run folder and its table sub-folders (cache key only).

    A running experiment writes new part files, so the key changes and cached tables are dropped.
    """
    newest = 0
    try:
        newest = run_dir.stat().st_mtime_ns
        for entry in run_dir.iterdir():
            if entry.name == "ckpt":
                continue
            newest = max(newest, entry.stat().st_mtime_ns)
            if entry.is_dir():
                for part in entry.iterdir():
                    newest = max(newest, part.stat().st_mtime_ns)
    except OSError:
        pass
    return newest


def _wrap(error: Exception) -> StoreError:
    return error if isinstance(error, StoreError) else StoreError(str(error))


@lru_cache(maxsize=256)
def _read_table(run_dir: str, name: str, with_cells: bool, sig: int) -> pd.DataFrame | None:
    api = _api()
    try:
        return api.read_table(Path(run_dir), name, with_cells=True) if with_cells else api.read_table(Path(run_dir), name)
    except FileNotFoundError:
        return None
    except Exception as e:
        raise _wrap(e) from e


def read_table(run_dir: Path, name: str, with_cells: bool = False) -> pd.DataFrame | None:
    """A run table, or None when the run has no such table."""
    return _read_table(str(run_dir), name, with_cells, signature(run_dir))


@lru_cache(maxsize=256)
def _run_status(run_dir: str, sig: int) -> dict:
    try:
        return dict(_api().run_status(Path(run_dir)))
    except Exception as e:
        raise _wrap(e) from e


def run_status(run_dir: Path) -> dict:
    return _run_status(str(run_dir), signature(run_dir))


def list_runs(runs_root: Path) -> list[tuple[Path, dict]]:
    """Run folders with their status dicts, as `ds-store` lists them (order not significant)."""
    try:
        items = _api().list_runs(Path(runs_root))
    except Exception as e:
        raise _wrap(e) from e
    out = []
    for item in items:
        path = _path_of(Path(runs_root), item)
        if path is not None:
            out.append((path, dict(item)))
    return out


def _path_of(root: Path, item: dict) -> Path | None:
    """The run folder of a `list_runs` entry (the key that holds it is `path`, `dir`, `run_dir`, `id`
    or `name`; a relative value is taken relative to `runs_root`)."""
    for key in ("path", "dir", "run_dir", "id", "name"):
        value = item.get(key)
        if value:
            p = Path(str(value))
            p = p if p.is_absolute() else (root / p)
            if p.is_dir():
                return p
    return None
