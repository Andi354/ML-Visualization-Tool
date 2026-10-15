"""Widgets of the scope "two runs" (feature E): A against B. Combinations are matched by their axis
values; only combinations present in both runs count."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ..aggregate import CHANNEL, _ordered_values, dimension_axes, has_channels
from ..listing import flat_config
from ..project import Metric, Project
from ..runs import Run, get_run
from .common import de, metric_text
from .registry import Widget, seg, widget
from .runscope import better, best_of, real_metrics

SCOPES = ("two-runs",)
SHARED_NOTE = "Keine gemeinsamen Kombinationen"
MAX_RANK_JUMPS = 7
FLIP_MIN_EFFECT = 1.5  # percent


@dataclass
class Pair:
    a: Run
    b: Run
    metric: Metric
    axes_a: list[str]
    axes_b: list[str]
    shared: list[str]
    full_a: pd.Series
    full_b: pd.Series
    shared_a: pd.Series
    shared_b: pd.Series

    @property
    def common(self) -> pd.Index:
        return self.shared_a.index.intersection(self.shared_b.index)

    def n_union(self) -> int:
        return len(self.shared_a.index.union(self.shared_b.index))


def _means(run: Run, axes: list[str], metric: Metric) -> pd.Series:
    ok = run.ok_cells()
    if ok.empty or metric.key not in ok.columns:
        return pd.Series(dtype=float)
    if not axes:
        return pd.Series({(): float(ok[metric.key].mean())})
    g = ok.groupby(axes, sort=False)[metric.key].mean().dropna()
    g.index = pd.MultiIndex.from_tuples([i if isinstance(i, tuple) else (i,) for i in g.index]) if len(axes) > 1 else pd.Index([(i,) for i in g.index])
    return g


def load_pair(project: Project, req: dict) -> tuple[Pair | None, dict | None]:
    ids = req.get("runs") or []
    if len(ids) < 2:
        return None, {"unavailable": "Wähle zwei Läufe zum Vergleichen"}
    a, b = get_run(project, ids[0]), get_run(project, ids[1])
    if a is None or b is None:
        raise LookupError("run not found")
    metrics = real_metrics(project, a)
    if not metrics:
        return None, {"unavailable": "Der Lauf hat keine Metriken"}
    metric = metrics[0]
    axes_a, axes_b = dimension_axes(a), dimension_axes(b)
    shared = [x for x in axes_a if x in axes_b]
    return (
        Pair(a, b, metric, axes_a, axes_b, shared, _means(a, axes_a, metric), _means(b, axes_b, metric), _means(a, shared, metric), _means(b, shared, metric)),
        None,
    )


def rank(series: pd.Series, metric: Metric) -> pd.Series:
    """1 = best (by the metric's direction)."""
    return series.rank(ascending=metric.direction != "max", method="min")


def combo_dict(axes: list[str], key: tuple) -> dict[str, str]:
    return {a: str(v) for a, v in zip(axes, key)}


def label_of(run: Run) -> str:
    return run.name


def same_forecasters(a: Run, b: Run) -> bool:
    def forecasters(run: Run) -> set[str]:
        if "forecaster" in run.axes:
            return set(_ordered_values(run, "forecaster"))
        return {str((run.config.get("model") or {}).get("forecaster"))}

    return forecasters(a) == forecasters(b)


def _meta(pair: Pair) -> dict:
    return {
        "a": {"id": pair.a.id, "name": pair.a.name, "running": pair.a.running},
        "b": {"id": pair.b.id, "name": pair.b.name, "running": pair.b.running},
        "metric": {"key": pair.metric.key, "label": pair.metric.label, "unit": pair.metric.unit, "scale": pair.metric.scale, "direction": pair.metric.direction},
    }


# --- Config-Unterschiede ---------------------------------------------------------------------------------
@widget(Widget(key="config-diff", label="Config-Unterschiede", question="Worin unterscheiden sich die beiden Läufe?", scopes=SCOPES))
def config_diff(project: Project, req: dict) -> dict:
    pair, err = load_pair(project, req)
    if err:
        return err
    a, b = pair.a, pair.b
    fa, fb = _all_config(a), _all_config(b)
    merkmal_keys = set()
    from ..listing import merkmal_candidates
    from ..runs import list_runs

    merkmal_keys = set(merkmal_candidates(list_runs(project)))
    chips = []
    for key in sorted(set(fa) | set(fb), key=lambda k: (list(fa) + list(fb)).index(k)):
        va, vb = fa.get(key), fb.get(key)
        if va != vb:
            chips.append({"key": key, "a": va if va is not None else "–", "b": vb if vb is not None else "–", "merkmal": key in merkmal_keys})
    if a.meta.get("commit") != b.meta.get("commit"):
        chips.append({"key": "commit", "a": a.meta.get("commit") or "–", "b": b.meta.get("commit") or "–", "merkmal": False})
    warnings = []
    if any(c["merkmal"] for c in chips):
        names = ", ".join(c["key"] for c in chips if c["merkmal"])
        warnings.append({"kind": "merkmal", "text": f"{names} unterscheidet sich: absolute Werte sind nicht fair vergleichbar, Rang und Effekt schon."})
    if a.epoch != b.epoch:
        warnings.append({"kind": "epoch", "text": f"Verschiedene Epochen ({a.epoch} und {b.epoch}): Der Vergleich ist möglich, aber nicht ohne Vorbehalt."})
    n = len(chips)
    title = "Die Läufe haben dieselbe Config" if n == 0 else f"Die Läufe unterscheiden sich in {n} {'Eintrag' if n == 1 else 'Einträgen'}"
    return {
        "title": title,
        "subtitle": f"{a.name} (A) und {b.name} (B)",
        "note": None,
        "data": {**_meta(pair), "chips": chips, "warnings": warnings, "n_both": [len(pair.common), pair.n_union()]},
    }


def _all_config(run: Run) -> dict[str, str]:
    """Constant config entries of all blocks except the grid; swept keys are compared via the grid."""
    out = dict(flat_config(run))
    run_block = run.config.get("run")
    if isinstance(run_block, dict):
        import json

        for k, v in run_block.items():
            out[f"run.{k}"] = v if isinstance(v, str) else json.dumps(v)
    return out


# --- Wer gewinnt wo? ---------------------------------------------------------------------------------------
@widget(
    Widget(
        key="who-wins",
        label="Wer gewinnt wo?",
        question="Welcher Lauf ist bei welcher Metrik besser?",
        scopes=SCOPES,
        settings=[seg("mode", "Wert", [("best", "Bester Wert"), ("median", "Median")], "best")],
    )
)
def who_wins(project: Project, req: dict) -> dict:
    pair, err = load_pair(project, req)
    if err:
        return err
    a, b = pair.a, pair.b
    mode = req["settings"]["mode"]
    same = same_forecasters(a, b)
    rows = []
    hidden = False
    for m in project.metrics:
        if m.key not in a.cells.columns or m.key not in b.cells.columns:
            continue
        if m.family != "real" and not same:
            hidden = True
            continue
        va = _stat(a, pair.axes_a, m, mode)
        vb = _stat(b, pair.axes_b, m, mode)
        if va is None or vb is None:
            continue
        pick = better(m)
        winner = None if va == vb else ("a" if pick(va, vb) == va else "b")
        gap = abs(va - vb) / max(abs(va), abs(vb)) if max(abs(va), abs(vb)) else 0.0
        rows.append({"key": m.key, "label": m.label, "family": m.family, "unit": m.unit, "scale": m.scale, "a": va, "b": vb, "winner": winner, "gap": gap})
    if not rows:
        return {"unavailable": "Keine gemeinsamen Metriken"}
    wa = sum(r["winner"] == "a" for r in rows)
    wb = sum(r["winner"] == "b" for r in rows)
    lead, n_lead, other, n_other = ("B", wb, "A", wa) if wb >= wa else ("A", wa, "B", wb)
    if n_other == 0:
        verdict = f"{lead} ist bei allen {len(rows)} Metriken besser" if n_lead == len(rows) else f"{lead} ist bei {n_lead} von {len(rows)} Metriken besser"
    else:
        verdict = f"{lead} ist bei {n_lead} von {len(rows)} Metriken besser. Nicht eindeutig: {other} gewinnt bei {n_other}."
    return {
        "title": verdict,
        "subtitle": f"{'Bester Wert' if mode == 'best' else 'Median'} über alle Kombinationen · A = {a.name}, B = {b.name}",
        "note": "niedriger = besser · Balken zeigt zum besseren Lauf, Länge = relativer Abstand"
        + (" · skalierte Metriken sind markiert" if any(r["family"] != "real" for r in rows) else ""),
        "data": {**_meta(pair), "rows": rows, "mode": mode, "scaled_hidden": hidden, "winners": {"a": wa, "b": wb}},
    }


def _stat(run: Run, axes: list[str], m: Metric, mode: str) -> float | None:
    s = _means(run, axes, m)
    if s.empty:
        return None
    if mode == "median":
        return float(s.median())
    return float(s.max() if m.direction == "max" else s.min())


# --- Beste Config je Lauf ---------------------------------------------------------------------------
@widget(Widget(key="best-config", label="Beste Config je Lauf", question="Wie gut ist das Beste des einen Laufs im anderen?", scopes=SCOPES))
def best_config(project: Project, req: dict) -> dict:
    pair, err = load_pair(project, req)
    if err:
        return err
    out = {}
    for side, run, axes, full, other_shared, other_axes in (
        ("a", pair.a, pair.axes_a, pair.full_a, pair.shared_b, pair.axes_b),
        ("b", pair.b, pair.axes_b, pair.full_b, pair.shared_a, pair.axes_a),
    ):
        if full.empty:
            return {"unavailable": "Keine Werte"}
        key = best_of(full, pair.metric)
        combo = combo_dict(axes, key)
        sub = tuple(combo[x] for x in pair.shared)
        in_other = None
        if sub in other_shared.index or (not pair.shared and () in other_shared.index):
            r = rank(other_shared, pair.metric)
            in_other = {"value": float(other_shared[sub]), "rank": int(r[sub]), "of": int(len(other_shared))}
            in_other["flag"] = "best" if in_other["rank"] <= 3 else ("warn" if in_other["rank"] > 10 else None)
        out[side] = {"combo": combo, "value": float(full[key]), "in_other": in_other}
    a_in_b = out["a"]["in_other"]
    if a_in_b:
        title = f"Das Beste von A ist in B auf Rang {a_in_b['rank']} von {a_in_b['of']}"
    else:
        title = "Das Beste von A kommt in B nicht vor"
    return {
        "title": title,
        "subtitle": f"Beste Kombination je Lauf (Mittel über Replikate) · {pair.metric.label}",
        "note": "Rang ≤ 3 grün · Rang > 10 gelb",
        "data": {**_meta(pair), **out},
    }


# --- Alle Kombinationen ------------------------------------------------------------------------------
@widget(Widget(key="all-combos", label="Alle Kombinationen", question="Wie verteilen sich alle Kombinationen beider Läufe?", scopes=SCOPES))
def all_combos(project: Project, req: dict) -> dict:
    pair, err = load_pair(project, req)
    if err:
        return err
    runs = {}
    for side, full in (("a", pair.full_a), ("b", pair.full_b)):
        if full.empty:
            return {"unavailable": "Keine Werte"}
        runs[side] = {"values": [float(v) for v in full.values], "best": float(full.max() if pair.metric.direction == "max" else full.min()), "median": float(full.median())}
    lower = "A" if runs["a"]["median"] < runs["b"]["median"] else "B"
    if pair.metric.direction == "max":
        lower = "B" if lower == "A" else "A"
    return {
        "title": f"{lower} liegt in der Mitte besser (Median {metric_text(pair.metric, runs['a']['median'] if lower == 'A' else runs['b']['median'])} gegenüber {metric_text(pair.metric, runs['b']['median'] if lower == 'A' else runs['a']['median'])})",
        "subtitle": f"{pair.metric.label} je Kombination, gemeinsame Achse für A und B",
        "note": "Punkt = Kombination · großer Punkt mit Ring = beste · Strich = Median",
        "data": {**_meta(pair), **runs},
    }


# --- Regionen ---------------------------------------------------------------------------------------------
@widget(Widget(key="regions-ab", label="Regionen", question="In welchen Regionen ist welcher Lauf besser?", scopes=SCOPES))
def regions_ab(project: Project, req: dict) -> dict:
    pair, err = load_pair(project, req)
    if err:
        return err
    if not (has_channels(pair.a) and has_channels(pair.b)):
        return {"unavailable": "Mindestens ein Lauf hat keine Kanäle"}
    per = {}
    for side, run, axes, full in (("a", pair.a, pair.axes_a, pair.full_a), ("b", pair.b, pair.axes_b, pair.full_b)):
        if full.empty:
            return {"unavailable": "Keine Werte"}
        combo = combo_dict(axes, best_of(full, pair.metric))
        ok = run.ok_cells()
        for k, v in combo.items():
            ok = ok[ok[k] == v]
        ch = run.channels
        if pair.metric.key not in ch.columns:
            return {"unavailable": "Keine Metrik je Kanal"}
        j = ch.assign(**{CHANNEL: ch[CHANNEL].map(str)}).merge(ok[["cell_id"]], on="cell_id")
        per[side] = j.groupby(CHANNEL, sort=False)[pair.metric.key].mean()
    channels = [c for c in per["a"].index if c in per["b"].index]
    rows = []
    wins_b = 0
    for c in channels:
        va, vb = float(per["a"][c]), float(per["b"][c])
        diff = (vb - va) / abs(va) * 100 if va else 0.0
        if better(pair.metric)(va, vb) == vb and va != vb:
            wins_b += 1
        rows.append({"channel": c, "a": va, "b": vb, "diff": diff})
    if not rows:
        return {"unavailable": "Keine gemeinsamen Regionen"}
    return {
        "title": f"B ist in {wins_b} von {len(rows)} Regionen besser" if wins_b * 2 >= len(rows) else f"A ist in {len(rows) - wins_b} von {len(rows)} Regionen besser",
        "subtitle": f"{pair.metric.label} je Region für die beste Kombination jedes Laufs",
        "note": "Differenz = B gegenüber A in Prozent",
        "data": {**_meta(pair), "rows": rows},
    }


# --- Umfang und Fehler -------------------------------------------------------------------------------
@widget(Widget(key="scope-errors", label="Umfang und Fehler", question="Wie groß waren die Läufe, und wie viele Zellen sind fehlgeschlagen?", scopes=SCOPES))
def scope_errors(project: Project, req: dict) -> dict:
    pair, err = load_pair(project, req)
    if err:
        return err
    from ..listing import merkmal_candidates
    from ..runs import list_runs

    cands = merkmal_candidates(list_runs(project))
    out = {}
    for side, run in (("a", pair.a), ("b", pair.b)):
        started, ended = run.started, run.ended
        seconds = (ended - started).total_seconds() if started and ended else None
        flat = flat_config(run)
        out[side] = {
            "cells": int(len(run.cells)),
            "errors": run.error_count(),
            "duration": seconds,
            "merkmal": [{"key": k, "label": k.split(".", 1)[1], "value": flat.get(k)} for k in cands if k in flat],
            "epoch": run.epoch,
            "running": run.running,
        }
    return {
        "title": f"A: {out['a']['cells']} Zellen ({out['a']['errors']} Fehler), B: {out['b']['cells']} Zellen ({out['b']['errors']} Fehler)",
        "subtitle": "Umfang, Fehler, Dauer, Lauf-Merkmale und Epoche je Lauf",
        "note": "Fehlerzahlen über 50 sind rot",
        "data": {**_meta(pair), **out, "error_limit": 50},
    }


# --- Wirkung je Parameter (optional) ---------------------------------------------------------------
def _effects(pair: Pair) -> list[dict]:
    rows = []
    for axis in pair.shared:
        vals = [v for v in _ordered_values(pair.a, axis) if v in set(_ordered_values(pair.b, axis))]
        for v in vals:
            e = {}
            for side, run, axes, full in (("a", pair.a, pair.axes_a, pair.full_a), ("b", pair.b, pair.axes_b, pair.full_b)):
                i = axes.index(axis)
                sel = full[[k[i] == v for k in full.index]]
                total = full.mean()
                e[side] = float((sel.mean() - total) / abs(total) * 100) if len(sel) and total else None
            if e["a"] is None or e["b"] is None:
                continue
            flips = (e["a"] > 0) != (e["b"] > 0) and abs(e["a"]) > FLIP_MIN_EFFECT and abs(e["b"]) > FLIP_MIN_EFFECT
            rows.append({"axis": axis, "value": v, "a": e["a"], "b": e["b"], "flips": bool(flips)})
    return rows


@widget(
    Widget(
        key="param-effect",
        label="Wirkung je Parameter",
        question="Wirkt ein Parameterwert in beiden Läufen gleich?",
        scopes=SCOPES,
        settings=[seg("sort", "Sortierung", [("axis", "nach Achse"), ("difference", "nach Unterschied")], "axis")],
        optional=True,
    )
)
def param_effect(project: Project, req: dict) -> dict:
    pair, err = load_pair(project, req)
    if err:
        return err
    rows = _effects(pair)
    if not rows:
        return {"unavailable": SHARED_NOTE}
    if req["settings"]["sort"] == "difference":
        rows.sort(key=lambda r: -abs(r["a"] - r["b"]))
    flips = [r for r in rows if r["flips"]]
    title = f"{len(flips)} von {len(rows)} Parameterwerten kippen die Richtung" if flips else "Kein Parameterwert kippt die Richtung"
    return {
        "title": title,
        "subtitle": f"Wirkung = Mittel der Kombinationen mit dem Wert gegenüber dem Lauf-Mittel, {pair.metric.label}, in Prozent",
        "note": "kippt = Vorzeichen wechselt und beide Wirkungen über 1,5 % · niedriger = besser",
        "data": {**_meta(pair), "rows": rows, "sort": req["settings"]["sort"], "scale": 8},
    }


def _spearman(x: pd.Series, y: pd.Series) -> float:
    """Spearman's rho: Pearson correlation of the average ranks (no SciPy needed)."""
    r = x.rank(method="average").corr(y.rank(method="average"))
    return 0.0 if r != r else float(r)


# --- Hält die Rangfolge? (optional) ------------------------------------------------------------------
def _ranks(pair: Pair) -> pd.DataFrame:
    common = pair.common
    if not pair.shared or not len(common):
        return pd.DataFrame()
    ra = rank(pair.shared_a.loc[common], pair.metric)
    rb = rank(pair.shared_b.loc[common], pair.metric)
    return pd.DataFrame({"a": ra, "b": rb, "va": pair.shared_a.loc[common], "vb": pair.shared_b.loc[common]})


@widget(Widget(key="rank-stability", label="Hält die Rangfolge?", question="Bleibt die Rangfolge der Kombinationen in B erhalten?", scopes=SCOPES, optional=True))
def rank_stability(project: Project, req: dict) -> dict:
    pair, err = load_pair(project, req)
    if err:
        return err
    df = _ranks(pair)
    if len(df) < 2:
        return {"unavailable": SHARED_NOTE}
    rho = _spearman(df["a"], df["b"])
    top_a = set(df.sort_values("a").index[:5])
    top_b = set(df.sort_values("b").index[:5])
    k = min(5, len(df))
    best_a = df["a"].idxmin()
    return {
        "title": f"Rangfolge {'hält' if rho >= 0.7 else 'hält nur teilweise' if rho >= 0.3 else 'hält nicht'}: Spearman {de(rho, 2)}, {len(top_a & top_b)} von {k} der Top {k} bleiben",
        "subtitle": f"Rang in A gegen Rang in B über {len(df)} gemeinsame Kombinationen · {pair.metric.label}",
        "note": "Diagonale = gleicher Rang",
        "data": {
            **_meta(pair),
            "points": [{"combo": combo_dict(pair.shared, k_), "a": int(r["a"]), "b": int(r["b"])} for k_, r in df.iterrows()],
            "n": int(len(df)),
            "spearman": rho,
            "top_overlap": [len(top_a & top_b), k],
            "best_a_rank_in_b": int(df.loc[best_a, "b"]),
        },
    }


# --- Größte Rangsprünge (optional) ------------------------------------------------------------------
@widget(Widget(key="rank-jumps", label="Größte Rangsprünge", question="Welche Kombinationen ändern ihren Rang am stärksten?", scopes=SCOPES, optional=True))
def rank_jumps(project: Project, req: dict) -> dict:
    pair, err = load_pair(project, req)
    if err:
        return err
    df = _ranks(pair)
    if df.empty:
        return {"unavailable": SHARED_NOTE}
    df = df.assign(jump=(df["a"] - df["b"]).abs()).sort_values("jump", ascending=False, kind="mergesort").head(MAX_RANK_JUMPS)
    rows = [{"combo": combo_dict(pair.shared, k), "a": int(r["a"]), "b": int(r["b"]), "jump": int(r["jump"])} for k, r in df.iterrows()]
    top = rows[0]
    desc = ", ".join(f"{k} = {v}" for k, v in top["combo"].items()) or "die einzige Kombination"
    return {
        "title": f"Größter Rangsprung: {desc} von Rang {top['a']} auf {top['b']}" if top["jump"] else "Keine Rangänderung: Die Rangfolge ist in beiden Läufen gleich",
        "subtitle": f"Die {len(rows)} Kombinationen mit der größten Rangänderung · {pair.metric.label}",
        "note": "Rang 1 = bester Wert",
        "data": {**_meta(pair), "rows": rows},
    }
