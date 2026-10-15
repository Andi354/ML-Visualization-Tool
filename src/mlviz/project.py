"""Project-level files: `project.yaml`, `epochs.yaml` and the clock.

The tool knows nothing about a project beyond these files and the run folders, so every accessor
tolerates missing keys and falls back to a neutral default.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import yaml


def _read_yaml(path: Path) -> dict:
    try:
        data = yaml.safe_load(path.read_text())
    except (OSError, yaml.YAMLError):
        return {}
    return data if isinstance(data, dict) else {}


@dataclass
class Metric:
    key: str
    label: str
    direction: str = "min"
    family: str = "real"

    def to_json(self) -> dict:
        return {"key": self.key, "label": self.label, "direction": self.direction, "family": self.family}


@dataclass
class Project:
    root: Path
    name: str = ""
    short: str = ""
    paths: dict = field(default_factory=dict)
    metrics: list[Metric] = field(default_factory=list)
    primary_metric: str | None = None
    own_model: dict | None = None
    epochs: list[dict] = field(default_factory=list)

    @classmethod
    def load(cls, root: Path | str) -> "Project":
        root = Path(root).resolve()
        raw = _read_yaml(root / "project.yaml")
        name = str(raw.get("name") or root.name)
        short = str(raw.get("short") or "".join(c for c in name if c.isalnum())[:2]).upper()[:2]
        paths = {
            "runs": "runs",
            "analyses": "analysis",
            "deliverables": "deliverables",
            "reports": "reports",
            "configs": "configs",
            **(raw.get("paths") or {}),
        }
        metrics = [
            Metric(
                key=str(m["key"]),
                label=str(m.get("label") or m["key"]),
                direction=str(m.get("direction", "min")),
                family=str(m.get("family", "real")),
            )
            for m in (raw.get("metrics") or [])
            if isinstance(m, dict) and "key" in m
        ]
        epochs = [e for e in (_read_yaml(root / "epochs.yaml").get("epochs") or []) if isinstance(e, dict)]
        return cls(
            root=root,
            name=name,
            short=short,
            paths=paths,
            metrics=metrics,
            primary_metric=raw.get("primary_metric") or (metrics[0].key if metrics else None),
            own_model=raw.get("own_model") if isinstance(raw.get("own_model"), dict) else None,
            epochs=epochs,
        )

    def path(self, key: str) -> Path:
        return self.root / self.paths[key]

    def metric(self, key: str) -> Metric | None:
        return next((m for m in self.metrics if m.key == key), None)

    def first_real_metric(self) -> Metric | None:
        return next((m for m in self.metrics if m.family == "real"), None)

    def epoch_names(self) -> list[str]:
        return [str(e.get("name")) for e in self.epochs if e.get("name")]

    def to_json(self) -> dict:
        return {
            "name": self.name,
            "short": self.short,
            "now": now().isoformat(),
            "primary_metric": self.primary_metric,
            "metrics": [m.to_json() for m in self.metrics],
            "epochs": self.epochs,
            "own_model": self.own_model,
            "paths": self.paths,
        }


def now() -> datetime:
    """Current time; `MLVIZ_NOW` (ISO) overrides it so tests and screenshots are deterministic."""
    fixed = os.environ.get("MLVIZ_NOW")
    return datetime.fromisoformat(fixed) if fixed else datetime.now().replace(microsecond=0)
