"""Reading run folders (`runs/<YYYY-MM-DD_HHMM>_<name>/`).

A run folder holds `meta.json`, the resolved `config.yaml`, `config.base.yaml` and the tables
`plan`, `cells`, `channels`, `curves` and `predictions`. The tables, the state and the progress come
from `ds-store` (see `store.py`); `meta.json` and the YAML files are read here. Everything is cached
by modification time, so a running experiment shows up as it writes.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import pandas as pd
import yaml

from . import store
from .project import Project

# Run folders carry a timestamp as prefix (`2026-09-28_195436_<name>`, seconds optional) or, in older
# layouts, as suffix (`<name>_20260928-195436`).
_TS = r"(?:\d{4}-\d{2}-\d{2}[_T]\d{4,6}|\d{8}[-_T]?\d{6})"
_PREFIX = re.compile(rf"^{_TS}_")
_SUFFIX = re.compile(rf"_{_TS}$")
_ISSUE = re.compile(r"^([A-Za-z][A-Za-z0-9]*-\d+)(?:_|$)")


def strip_timestamp(folder_name: str) -> str:
    stripped = _PREFIX.sub("", folder_name, count=1)
    return stripped if stripped != folder_name else _SUFFIX.sub("", folder_name)


def issue_of(name: str) -> str | None:
    m = _ISSUE.match(name)
    return m.group(1) if m else None


def _mtime(path: Path) -> float:
    try:
        return path.stat().st_mtime_ns
    except OSError:
        return 0.0


@lru_cache(maxsize=256)
def _read_json(path: str, mtime: float) -> dict:
    return json.loads(Path(path).read_text())


@lru_cache(maxsize=256)
def _read_yaml(path: str, mtime: float) -> dict:
    data = yaml.safe_load(Path(path).read_text())
    return data if isinstance(data, dict) else {}


def dim_str(series: pd.Series) -> pd.Series:
    """Dimension values (axis or replicate) as text, the way they are shown and compared."""
    return series.map(lambda v: "" if v is None or (isinstance(v, float) and pd.isna(v)) else str(v))


@dataclass
class Run:
    """One run folder."""

    path: Path
    #: Status as `ds-store` listed it, so a run list does not read every run twice.
    listed: dict | None = field(default=None, repr=False, compare=False)

    @property
    def id(self) -> str:
        return self.path.name

    @property
    def name(self) -> str:
        """Experiment name: `name` of `meta.json`, else the folder name without the timestamp."""
        return str(self.meta.get("name") or strip_timestamp(self.id))

    @property
    def issue(self) -> str | None:
        return self.meta.get("issue") or issue_of(self.name)

    # --- files -------------------------------------------------------------------------------
    def _file(self, name: str) -> Path:
        return self.path / name

    @property
    def meta(self) -> dict:
        p = self._file("meta.json")
        try:
            return _read_json(str(p), _mtime(p))
        except (OSError, ValueError):
            return {}

    @property
    def config(self) -> dict:
        p = self._file("config.yaml")
        try:
            return _read_yaml(str(p), _mtime(p))
        except (OSError, yaml.YAMLError):
            return {}

    @property
    def base_config(self) -> dict | None:
        """`config.base.yaml` of the run (the base configs as they were at its start), None if absent."""
        p = self._file("config.base.yaml")
        if not p.is_file():
            return None
        try:
            return _read_yaml(str(p), _mtime(p))
        except (OSError, yaml.YAMLError):
            return None

    # --- tables (through ds-store) -------------------------------------------------------------
    def table(self, name: str, with_cells: bool = False) -> pd.DataFrame | None:
        return store.read_table(self.path, name, with_cells=with_cells)

    @property
    def cells(self) -> pd.DataFrame:
        df = self.table("cells")
        return df if df is not None else pd.DataFrame()

    @property
    def channels(self) -> pd.DataFrame | None:
        return self.table("channels")

    @property
    def plan(self) -> pd.DataFrame | None:
        return self.table("plan")

    @property
    def has_curves(self) -> bool:
        df = self.table("curves")
        return df is not None and not df.empty

    @property
    def has_predictions(self) -> bool:
        df = self.table("predictions")
        return df is not None and not df.empty

    # --- state and progress (ds-store: finished | running | stalled) ---------------------------
    @property
    def status(self) -> dict:
        if self.listed is not None:
            return self.listed
        return store.run_status(self.path)

    @property
    def state(self) -> str:
        return str(self.status.get("state") or "finished")

    @property
    def running(self) -> bool:
        return self.state == "running"

    @property
    def done_cells(self) -> int:
        done = self.status.get("done")
        return int(done) if done is not None else len(self.cells)

    @property
    def planned_cells(self) -> int | None:
        planned = self.status.get("planned")
        if planned is not None:
            return int(planned)
        plan = (self.meta.get("plan") or {}).get("cells")
        return int(plan) if plan is not None else None

    # --- meta ---------------------------------------------------------------------------------
    @property
    def axes(self) -> list[str]:
        return list(self.meta.get("axes") or list((self.config.get("sweep") or {}).keys()))

    @property
    def replicates(self) -> list[str]:
        return list(self.meta.get("replicates") or list((self.config.get("replicates") or {}).keys()))

    @property
    def started(self) -> datetime | None:
        return _parse_time(self.meta.get("started_at")) or _time_from_name(self.id)

    @property
    def ended(self) -> datetime | None:
        return _parse_time(self.meta.get("ended_at"))

    @property
    def migrated(self) -> bool:
        return bool(self.meta.get("migrated"))

    @property
    def epoch(self) -> str | None:
        return self.meta.get("epoch")

    def ok_cells(self) -> pd.DataFrame:
        c = self.cells
        if c.empty or "status" not in c:
            return c
        return c[c["status"] != "error"]

    def error_count(self) -> int:
        c = self.cells
        if c.empty or "status" not in c:
            return 0
        return int((c["status"] == "error").sum())

    def info(self) -> dict:
        s = self.started
        e = self.ended
        return {
            "id": self.id,
            "name": self.name,
            "issue": self.issue,
            "started": s.isoformat() if s else None,
            "ended": e.isoformat() if e else None,
            "state": self.state,
            "running": self.running,
            "migrated": self.migrated,
            "epoch": self.epoch,
            "axes": self.axes,
            "replicates": self.replicates,
            "has_curves": self.has_curves,
            "has_predictions": self.has_predictions,
            "commit": self.meta.get("commit"),
        }


def _parse_time(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


_NAME_TIME = [
    re.compile(r"^(\d{4})-(\d{2})-(\d{2})[_T](\d{2})(\d{2})(\d{2})?_"),
    re.compile(r"_(\d{4})(\d{2})(\d{2})[-_T]?(\d{2})(\d{2})(\d{2})$"),
]


def _time_from_name(folder: str) -> datetime | None:
    for rx in _NAME_TIME:
        m = rx.search(folder)
        if m:
            y, mo, d, h, mi, sec = (int(g or 0) for g in m.groups())
            try:
                return datetime(y, mo, d, h, mi, sec)
            except ValueError:
                return None
    return None


def list_runs(project: Project) -> list[Run]:
    """All run folders of the project, newest first. Folders without `meta.json` are ignored."""
    base = project.path("runs")
    if not base.is_dir():
        return []
    runs = [Run(p, status) for p, status in store.list_runs(base) if (p / "meta.json").exists()]
    runs.sort(key=lambda r: (r.started or datetime.min, r.id), reverse=True)
    return runs


def get_run(project: Project, run_id: str) -> Run | None:
    """One run by folder name; ids that would leave `runs/` are rejected."""
    if not run_id or "/" in run_id or "\\" in run_id or run_id in (".", ".."):
        return None
    p = project.path("runs") / run_id
    if p.is_dir() and (p / "meta.json").exists():
        return Run(p)
    return None
