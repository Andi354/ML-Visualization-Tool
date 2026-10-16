"""Resolved config of a run or of one combination, for the config view (feature J)."""

from __future__ import annotations

import copy
from typing import Any

import yaml

from .aggregate import GRID_BLOCKS, _ordered_values, _paired_members, axis_block, dimension_axes, display_value
from .project import Project
from .runs import Run

#: Blocks that make up the grid itself; they are shown in the grid box and at the end of the YAML.
YAML_GRID_BLOCKS = ("sweep", "replicates")


def compact(v: Any) -> str:
    """Short value for chips: small floats as `5e-4`, everything else as in the config."""
    if isinstance(v, float) and v != 0 and abs(v) < 1e-2:
        mant, exp = f"{v:e}".split("e")
        return f"{mant.rstrip('0').rstrip('.')}e{int(exp)}"
    return display_value(v)




def _raw_for_label(run: Run, axis: str, label: str) -> tuple[bool, Any]:
    values = (run.config.get("sweep") or {}).get(axis)
    labels = _ordered_values(run, axis)
    if isinstance(values, list) and len(values) == len(labels) and label in labels:
        return True, values[labels.index(label)]
    return False, None


def _flow(v: Any) -> str:
    return yaml.dump(v, default_flow_style=True, width=10**6, allow_unicode=True).splitlines()[0]


def _blocks(cfg: dict) -> dict[str, dict]:
    return {k: v for k, v in cfg.items() if isinstance(v, dict) and k not in GRID_BLOCKS}


def run_config(project: Project, run: Run, combo: dict[str, str] | None = None) -> dict:
    cfg = copy.deepcopy(run.config)
    combo = combo or {}
    sweep = cfg.get("sweep") or {}
    axes = dimension_axes(run)
    base = run.base_config  # the merged base configs of the run's start; None for runs without

    grid_axes: list[dict] = []
    swept: dict[tuple[str, str], list[str]] = {}  # (block, key) -> all values of the grid
    current: dict[tuple[str, str], str] = {}
    for axis in axes:
        raw_values = sweep.get(axis)
        labels = _ordered_values(run, axis)
        paired = bool(_paired_members(run, axis))
        displays = []
        for i, label in enumerate(labels):
            raw = raw_values[i] if isinstance(raw_values, list) and len(raw_values) == len(labels) else label
            displays.append(" · ".join(compact(x) for x in raw.values()) if isinstance(raw, dict) else compact(raw))
        grid_axes.append(
            {
                "key": axis,
                "paired": paired,
                "members": _paired_members(run, axis),
                "values": [{"label": l, "display": d} for l, d in zip(labels, displays)],
                "current": combo.get(axis) if combo.get(axis) in labels else None,
            }
        )
        # apply the combination to the resolved config
        found, raw = _raw_for_label(run, axis, combo[axis]) if axis in combo else (False, None)
        blocks = _blocks(cfg)
        if paired:
            for member in _paired_members(run, axis):
                block = next((b for b, e in blocks.items() if member in e), None)
                if block is None:
                    continue
                swept[(block, member)] = list(
                    dict.fromkeys(display_value(d.get(member)) for d in (raw_values or []) if isinstance(d, dict))
                )
                if found and isinstance(raw, dict) and member in raw:
                    cfg[block][member] = raw[member]
                    current[(block, member)] = display_value(raw[member])
        else:
            block = axis_block(run, axis)
            if block == "sweep" or block not in blocks:
                continue
            swept[(block, axis)] = list(dict.fromkeys(display_value(x) for x in (raw_values or [])))
            if found:
                cfg[block][axis] = raw
                current[(block, axis)] = display_value(raw)

    replicates = [
        {"key": k, "values": [display_value(x) for x in (v if isinstance(v, list) else [v])]}
        for k, v in (cfg.get("replicates") or {}).items()
    ]

    def base_of(block: str, key: str) -> tuple[bool, str | None]:
        if base is None:
            return False, None
        b = (base.get(block) or {}) if isinstance(base.get(block), dict) else {}
        if key not in b:
            return False, None
        return cfg[block].get(key) != b[key], display_value(b[key])

    blocks_out = []
    for name, entries in _blocks(cfg).items():
        rows = []
        for key, value in entries.items():
            differs, base_val = base_of(name, key)
            rows.append(
                {
                    "key": key,
                    "value": display_value(value),
                    "swept": (name, key) in swept,
                    "values": swept.get((name, key), []),
                    "base": base_val if differs else None,
                    "differs": differs,
                }
            )
        blocks_out.append({"name": name, "entries": rows, "differs": sum(1 for r in rows if r["differs"])})

    lines: list[dict] = []
    order = [k for k in cfg if k not in YAML_GRID_BLOCKS and isinstance(cfg[k], dict)] + [
        k for k in YAML_GRID_BLOCKS if isinstance(cfg.get(k), dict)
    ]
    for name in order:
        lines.append({"n": len(lines) + 1, "indent": 0, "text": f"{name}:", "block": name, "kind": "block"})
        for key, value in cfg[name].items():
            line = {
                "n": len(lines) + 1,
                "indent": 1,
                "text": f"{key}: {_flow(value)}",
                "block": name,
                "kind": "entry",
                "swept": False,
                "replicate": name == "replicates",
                "differs": False,
                "note": None,
                "base": None,
            }
            if (name, key) in swept:
                others = [v for v in swept[(name, key)] if v != current.get((name, key))]
                line["swept"] = True
                line["note"] = ("weitere: " + ", ".join(others)) if (name, key) in current and others else (
                    "Grid: " + ", ".join(swept[(name, key)])
                )
            if name not in YAML_GRID_BLOCKS:
                differs, base_val = base_of(name, key)
                line["differs"], line["base"] = differs, (base_val if differs else None)
            lines.append(line)

    return {
        "base_known": base is not None,
        "grid": {"axes": grid_axes, "replicates": replicates},
        "blocks": blocks_out,
        "lines": lines,
        "yaml": "\n".join(("  " * l["indent"]) + l["text"] for l in lines) + "\n",
    }
