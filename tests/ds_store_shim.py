"""Stand-in for the description functions of `ds-store` (they arrive with TIM-71).

`list_runs` then returns `short` and `has["description"]` per run, `read_description(run_dir)` returns None without
`description.yaml`, else the fields and a list `problems`. The shim is installed only while the installed `ds-store`
does not have them, so the tests switch to the real functions by themselves once they exist.
"""

from __future__ import annotations

from pathlib import Path

import ds_store
import yaml

FIELDS = ("short", "purpose", "shows", "notes", "expectation", "compare_to")
REQUIRED = ("short", "purpose", "shows")


def read_description(run_dir):
    path = Path(run_dir) / "description.yaml"
    if not path.is_file():
        return None
    try:
        data = yaml.safe_load(path.read_text())
    except yaml.YAMLError:
        data = None
    if not isinstance(data, dict):
        return {"problems": ["description.yaml nicht lesbar"]}
    out = {k: data.get(k) for k in FIELDS}
    out["problems"] = [f"{k} fehlt" for k in REQUIRED if not data.get(k)]
    return out


def install() -> None:
    if hasattr(ds_store, "read_description"):
        return
    original = ds_store.list_runs

    def list_runs(runs_root, *args, **kwargs):
        items = original(runs_root, *args, **kwargs)
        for item in items:
            description = read_description(Path(runs_root) / item["run"])
            item["short"] = (description or {}).get("short")
            item["has"] = {**item.get("has", {}), "description": description is not None}
        return items

    ds_store.read_description = read_description
    ds_store.list_runs = list_runs
