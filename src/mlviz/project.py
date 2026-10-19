"""Project-level files: `project.yaml`, `epochs.yaml` and the clock.

The tool knows nothing about a project beyond these files and the run folders, so every accessor
tolerates missing keys and falls back to a neutral default. Content that is present but in no known
form is not dropped silently: it becomes a warning (log, `/api/project`, notice in the frontend).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

log = logging.getLogger(__name__)


def _read_yaml(path: Path) -> dict:
    try:
        data = yaml.safe_load(path.read_text())
    except (OSError, yaml.YAMLError):
        return {}
    return data if isinstance(data, dict) else {}


def _load_any(path: Path) -> tuple[Any, str | None]:
    """YAML of any top-level type, plus a problem text when the file exists but cannot be parsed."""
    if not path.exists():
        return None, None
    try:
        return yaml.safe_load(path.read_text()), None
    except (OSError, yaml.YAMLError) as e:
        return None, f"{path.name} konnte nicht gelesen werden ({type(e).__name__})"


def _metrics_of(raw: dict, warnings: list[str]) -> tuple[list["Metric"], str | None]:
    """Metric catalogue and primary metric from `metrics:` of `project.yaml`.

    Forms: `{primary: <key>, catalog: {<key>: {direction, viz: {family}, label, unit, scale}}}` (ds-init,
    repnet-bench) or a list of entries with `key` (earlier form) plus a top-level `primary_metric`."""
    value = raw.get("metrics")
    primary = raw.get("primary_metric")
    entries: list[tuple[str, dict]] = []
    if value is None:
        return [], primary
    if isinstance(value, dict) and isinstance(value.get("catalog"), dict):
        primary = value.get("primary") or primary
        for key, body in value["catalog"].items():
            if body is None:
                body = {}
            if not isinstance(body, dict):
                warnings.append(f"project.yaml: Metrik {key!r} im Katalog ist kein Eintrag mit Feldern, ausgelassen")
                continue
            entries.append((str(key), body))
    elif isinstance(value, list):
        for m in value:
            if isinstance(m, dict) and "key" in m:
                entries.append((str(m["key"]), m))
            else:
                warnings.append("project.yaml: ein Eintrag unter metrics hat keinen key, ausgelassen")
    else:
        warnings.append("project.yaml: metrics hat keine bekannte Form (erwartet: primary + catalog, oder eine Liste mit key)")
        return [], primary
    metrics = []
    for key, m in entries:
        mviz = _dict(m.get("viz"))
        metrics.append(
            Metric(
                key=key,
                label=str(m.get("label") or mviz.get("short") or key),
                direction=str(m.get("direction", "min")),
                family=str(mviz.get("family") or m.get("family") or "real"),
                unit=str(m.get("unit", "")),
                scale=float(m.get("scale", 1.0)),
            )
        )
    if primary is not None and metrics and str(primary) not in {m.key for m in metrics}:
        warnings.append(f"project.yaml: die Primärmetrik {primary!r} steht nicht im Metrik-Katalog")
    return metrics, (str(primary) if primary is not None else None)


def _epochs_of(root: Path, warnings: list[str]) -> list[dict]:
    """Epochs from `epochs.yaml`: a list at the top level (`name`, `repo`, `commit`, `date`, `reason`) or the
    earlier form `{epochs: [...]}` (`name`, `since`, `description`). Shown as `name`, `since`, `description`."""
    data, problem = _load_any(root / "epochs.yaml")
    if problem:
        warnings.append(problem)
        return []
    if data is None:
        return []
    items = data.get("epochs") if isinstance(data, dict) else data
    if not isinstance(items, list):
        warnings.append("epochs.yaml hat keine bekannte Form (erwartet: eine Liste von Epochen, oder epochs: mit einer Liste)")
        return []
    epochs = []
    for e in items:
        if not isinstance(e, dict) or not e.get("name"):
            warnings.append("epochs.yaml: ein Eintrag ohne name, ausgelassen")
            continue
        out = {**e, "name": str(e["name"])}
        since = e.get("since", e.get("date"))
        if since is not None:
            out["since"] = str(since)
        description = e.get("description", e.get("reason"))
        if description is not None:
            out["description"] = str(description)
        epochs.append(out)
    return epochs


def _dict(value) -> dict:
    return value if isinstance(value, dict) else {}


#: Folders of a project: where `paths:` (runs, configs) and `outputs:` (analysis, research,
#: deliverables) of `project.yaml` put them, with the ds-init defaults.
DEFAULT_PATHS = {
    "runs": "runs",
    "configs": "configs",
    "analysis": "analysis",
    "research": "research",
    "deliverables": "deliverables",
}


def _paths(raw: dict) -> dict[str, str]:
    """Folders from `paths:` and `outputs:`; `reports` is derived from the outputs (the analysis
    folder) unless given. The earlier flat form (`paths.analyses`, `paths.reports`) still reads."""
    legacy = {("analysis" if k == "analyses" else k): str(v) for k, v in _dict(raw.get("paths")).items()}
    outputs = {("analysis" if k == "analyses" else k): str(v) for k, v in _dict(raw.get("outputs")).items()}
    paths = {**DEFAULT_PATHS, **legacy, **outputs}
    paths.setdefault("reports", paths["analysis"])
    return paths


@dataclass
class Metric:
    key: str
    label: str
    direction: str = "min"
    family: str = "real"
    #: Optional display: the stored value is multiplied by `scale` and shown with `unit`
    #: (e.g. a MAPE stored as a share, `scale: 100`, `unit: "%"`).
    unit: str = ""
    scale: float = 1.0

    def to_json(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "direction": self.direction,
            "family": self.family,
            "unit": self.unit,
            "scale": self.scale,
        }


@dataclass
class Project:
    root: Path
    name: str = ""
    short: str = ""
    paths: dict = field(default_factory=dict)
    metrics: list[Metric] = field(default_factory=list)
    primary_metric: str | None = None
    #: The setting `runs.metric` (a metric key): beats the run's own `primary_metric` and the project's. Set per request by the server.
    primary_override: str | None = None
    own_model: dict | None = None
    epochs: list[dict] = field(default_factory=list)
    #: Content of the project files that is present but in no known form (shown, not dropped silently).
    warnings: list[str] = field(default_factory=list)

    @classmethod
    def load(cls, root: Path | str) -> "Project":
        root = Path(root).resolve()
        warnings: list[str] = []
        data, problem = _load_any(root / "project.yaml")
        if problem:
            warnings.append(problem)
        elif data is not None and not isinstance(data, dict):
            warnings.append("project.yaml hat keine bekannte Form (erwartet: Einträge mit Schlüsseln)")
        raw = data if isinstance(data, dict) else {}
        viz = _dict(raw.get("viz"))  # what only this tool needs: `short`, `own_model`, per-metric `family`
        name = str(raw.get("name") or root.name)
        short = str(viz.get("short") or raw.get("short") or "".join(c for c in name if c.isalnum())[:2]).upper()[:2]
        paths = _paths(raw)
        metrics, primary = _metrics_of(raw, warnings)
        epochs = _epochs_of(root, warnings)
        for w in warnings:
            log.warning("%s: %s", root.name, w)
        own_model = viz.get("own_model", raw.get("own_model"))
        return cls(
            root=root,
            name=name,
            short=short,
            paths=paths,
            metrics=metrics,
            primary_metric=primary or (metrics[0].key if metrics else None),
            own_model=own_model if isinstance(own_model, dict) else None,
            epochs=epochs,
            warnings=warnings,
        )

    def path(self, key: str) -> Path:
        return self.root / self.paths[key]

    def metric(self, key: str) -> Metric | None:
        return next((m for m in self.metrics if m.key == key), None)

    def primary_for(self, run_meta: dict) -> str | None:
        """The primary metric of a run: the setting, else the run's own, else the project's."""
        if self.primary_override and self.metric(self.primary_override):
            return self.primary_override
        return run_meta.get("primary_metric") or self.primary_metric

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
            "warnings": self.warnings,
        }


def now() -> datetime:
    """Current time; `MLVIZ_NOW` (ISO) overrides it so tests and screenshots are deterministic."""
    fixed = os.environ.get("MLVIZ_NOW")
    return datetime.fromisoformat(fixed) if fixed else datetime.now().replace(microsecond=0)
