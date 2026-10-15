"""Reading run folders (`runs/<experiment>_<timestamp>/`).

A run folder holds `meta.json`, the resolved `config.yaml`, `cells.parquet`, `plan.parquet`, and
optionally `channels.parquet`, `curves/` and `predictions/`. Everything is read lazily and cached by
file modification time, so a running experiment shows up as it writes.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import pandas as pd
import yaml

from .project import Project

_TIMESTAMP = re.compile(r"_(\d{8}[-_T]?\d{6}|\d{4}-\d{2}-\d{2}[_T]\d{2}[-:]?\d{2}[-:]?\d{2})$")
_ISSUE = re.compile(r"^([A-Za-z][A-Za-z0-9]*-\d+)(?:_|$)")


def strip_timestamp(folder_name: str) -> str:
    return _TIMESTAMP.sub("", folder_name)


def issue_of(name: str) -> str | None:
    m = _ISSUE.match(name)
    return m.group(1) if m else None


def _mtime(path: Path) -> float:
    try:
        return path.stat().st_mtime_ns
    except OSError:
        return 0.0


@lru_cache(maxsize=256)
def _read_parquet(path: str, mtime: float) -> pd.DataFrame:
    return pd.read_parquet(path)


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

    @property
    def id(self) -> str:
        return self.path.name

    @property
    def name(self) -> str:
        """Experiment name: the folder name without the timestamp."""
        return str(self.meta.get("experiment") or strip_timestamp(self.id))

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

    def _table(self, name: str) -> pd.DataFrame | None:
        p = self._file(name)
        if not p.exists():
            return None
        return _read_parquet(str(p), _mtime(p))

    @property
    def cells(self) -> pd.DataFrame:
        df = self._table("cells.parquet")
        return df if df is not None else pd.DataFrame()

    @property
    def channels(self) -> pd.DataFrame | None:
        return self._table("channels.parquet")

    @property
    def plan(self) -> pd.DataFrame | None:
        return self._table("plan.parquet")

    @property
    def has_curves(self) -> bool:
        d = self._file("curves")
        return d.is_dir() and any(d.iterdir())

    @property
    def has_predictions(self) -> bool:
        d = self._file("predictions")
        return d.is_dir() and any(d.iterdir())

    # --- meta ---------------------------------------------------------------------------------
    @property
    def axes(self) -> list[str]:
        return list(self.meta.get("axes") or list((self.config.get("sweep") or {}).keys()))

    @property
    def replicates(self) -> list[str]:
        return list(self.meta.get("replicates") or list((self.config.get("replicates") or {}).keys()))

    @property
    def started(self) -> datetime | None:
        return _parse_time(self.meta.get("started")) or _time_from_name(self.id)

    @property
    def ended(self) -> datetime | None:
        return _parse_time(self.meta.get("ended"))

    @property
    def running(self) -> bool:
        return self.meta.get("ended") in (None, "")

    @property
    def migrated(self) -> bool:
        return bool(self.meta.get("migrated"))

    @property
    def epoch(self) -> str | None:
        return self.meta.get("epoch")

    @property
    def planned_cells(self) -> int:
        plan = (self.meta.get("plan") or {}).get("cells")
        if plan is not None:
            return int(plan)
        p = self.plan
        return len(p) if p is not None else len(self.cells)

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


_NAME_TIME = re.compile(r"_(\d{8})[-_T]?(\d{6})$")


def _time_from_name(folder: str) -> datetime | None:
    m = _NAME_TIME.search(folder)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")
    except ValueError:
        return None


def list_runs(project: Project) -> list[Run]:
    """All run folders of the project, newest first. Folders without `meta.json` are ignored."""
    base = project.path("runs")
    if not base.is_dir():
        return []
    runs = [Run(p) for p in base.iterdir() if p.is_dir() and (p / "meta.json").exists()]
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
