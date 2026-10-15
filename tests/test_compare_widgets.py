import numpy as np
import pandas as pd
import pytest

from mlviz import widgets
from mlviz.fixture import RUNS, make_project, run_folder
from mlviz.project import Project
from mlviz.runs import get_run

A30 = run_folder(RUNS[3])  # TIM-52_best_30, older
A30B = run_folder(RUNS[4])  # TIM-52_best_30, newer
B90 = run_folder(RUNS[5])  # TIM-52_best_90
R45 = run_folder(RUNS[2])  # TIM-45, epoch tsrm6, axes lr_epochs, lstm_layer, time_embedding
R71 = run_folder(RUNS[6])  # TIM-71, forecaster x lstm_layer
TWO = ("config-diff", "who-wins", "best-config", "all-combos", "regions-ab", "scope-errors", "param-effect", "rank-stability", "rank-jumps")


@pytest.fixture(scope="module")
def project(demo_project):
    return Project.load(demo_project)


def two(project, key, a=A30, b=B90, **settings):
    return widgets.compute(project, key, {"runs": [a, b], "scope": "two-runs", "settings": settings})


def means(project, rid, axes, metric="test_mape"):
    return get_run(project, rid).ok_cells().groupby(axes)[metric].mean()


def test_catalog_two_runs_in_the_documented_order_with_optional_ones_marked(project):
    cat = widgets.catalog("two-runs")
    assert [w["key"] for w in cat] == list(TWO)
    assert [w["key"] for w in cat if w["optional"]] == ["param-effect", "rank-stability", "rank-jumps"]
    assert [w["key"] for w in widgets.catalog("project")] == ["project-best", "param-map"]
    assert [w["key"] for w in widgets.catalog("project") if w["optional"]] == ["param-map"]
    assert all(w["question"].endswith("?") for w in cat)


@pytest.mark.parametrize("key", TWO)
def test_two_run_widgets_need_two_runs(project, key):
    r = widgets.compute(project, key, {"runs": [A30], "scope": "two-runs"})
    assert r["unavailable"] == "Wähle zwei Läufe zum Vergleichen"


def test_unknown_run_is_a_lookup_error(project):
    with pytest.raises(LookupError):
        two(project, "who-wins", b="2020-01-01_000000_gone")


# --- Config-Unterschiede -----------------------------------------------------------------------------------
def test_config_diff_lists_every_entry_that_differs_and_the_commit(project):
    r = two(project, "config-diff")
    chips = {c["key"]: c for c in r["data"]["chips"]}
    assert chips["data.pred_len"] == {"key": "data.pred_len", "a": "30", "b": "90", "merkmal": True}
    assert chips["commit"]["a"] != chips["commit"]["b"] and not chips["commit"]["merkmal"]
    assert r["title"] == f"Die Läufe unterscheiden sich in {len(chips)} Einträgen"
    assert all(k in ("data.pred_len", "commit") for k in chips)


def test_a_differing_lauf_merkmal_warns_that_absolute_values_are_not_comparable(project):
    w = two(project, "config-diff")["data"]["warnings"]
    assert w == [{"kind": "merkmal", "text": "data.pred_len unterscheidet sich: absolute Werte sind nicht fair vergleichbar, Rang und Effekt schon."}]
    assert two(project, "config-diff", b=A30B)["data"]["warnings"] == []


def test_different_epochs_warn_but_the_comparison_stays_possible(project):
    r = two(project, "config-diff", a=R45, b=R71)
    assert any(w["kind"] == "epoch" and "tsrm6" in w["text"] for w in r["data"]["warnings"])
    assert two(project, "who-wins", a=R45, b=R71).get("unavailable") is None


def test_identical_configs(project, tmp_path):
    root = make_project(tmp_path / "p")
    p = Project.load(root)
    r = two(p, "config-diff", a=A30, b=A30)
    assert r["title"] == "Die Läufe haben dieselbe Config" and r["data"]["chips"] == []


def test_matched_combinations_are_counted(project):
    r = two(project, "config-diff")
    assert r["data"]["n_both"] == [5, 5]
    r2 = two(project, "config-diff", a=R45, b=R71)
    assert r2["data"]["n_both"] == [2, 2]  # only lstm_layer is shared


# --- Wer gewinnt wo? ---------------------------------------------------------------------------------------------
def test_who_wins_one_row_per_catalogue_metric_with_the_better_run(project):
    r = two(project, "who-wins")
    d = r["data"]
    assert [x["key"] for x in d["rows"]] == [m.key for m in project.metrics]  # same forecasters: scaled metrics stay
    a, b = means(project, A30, ["forecaster"]), means(project, B90, ["forecaster"])
    row = next(x for x in d["rows"] if x["key"] == "test_mape")
    assert row["a"] == pytest.approx(a.min()) and row["b"] == pytest.approx(b.min())
    assert row["winner"] == "a" and row["gap"] == pytest.approx(abs(a.min() - b.min()) / max(a.min(), b.min()))


def test_who_wins_median_mode(project):
    row = next(x for x in two(project, "who-wins", mode="median")["data"]["rows"] if x["key"] == "test_mape")
    assert row["a"] == pytest.approx(means(project, A30, ["forecaster"]).median())


def test_who_wins_verdict_sentence(project):
    r = two(project, "who-wins")
    d = r["data"]
    n = len(d["rows"])
    wa, wb = d["winners"]["a"], d["winners"]["b"]
    if wb == 0:
        assert r["title"] == f"A ist bei allen {n} Metriken besser"
    else:
        lead, nl, other, no = ("A", wa, "B", wb) if wa >= wb else ("B", wb, "A", wa)
        assert r["title"] == f"{lead} ist bei {nl} von {n} Metriken besser. Nicht eindeutig: {other} gewinnt bei {no}."


def test_who_wins_scaled_metrics_are_hidden_when_the_forecasters_differ(project):
    r = two(project, "who-wins", a=R45, b=R71)
    assert r["data"]["scaled_hidden"] is True
    assert all(x["family"] == "real" for x in r["data"]["rows"])


def test_who_wins_mixed_verdict(project):
    r = two(project, "who-wins", a=R45, b=R71)
    assert "Nicht eindeutig" in r["title"] or "besser" in r["title"]


# --- Beste Config je Lauf -----------------------------------------------------------------------------------------
def test_best_config_each_best_combination_and_its_value_and_rank_in_the_other_run(project):
    r = two(project, "best-config")
    d = r["data"]
    a, b = means(project, A30, ["forecaster"]), means(project, B90, ["forecaster"])
    assert d["a"]["combo"] == {"forecaster": a.idxmin()} and d["a"]["value"] == pytest.approx(a.min())
    assert d["a"]["in_other"]["value"] == pytest.approx(b[a.idxmin()])
    assert d["a"]["in_other"]["rank"] == int(b.rank().loc[a.idxmin()]) and d["a"]["in_other"]["of"] == 5
    assert r["title"] == f"Das Beste von A ist in B auf Rang {d['a']['in_other']['rank']} von 5"


def test_best_config_rank_flags(project):
    d = two(project, "best-config")["data"]
    assert d["a"]["in_other"]["flag"] == "best"  # rank <= 3


def test_best_config_flags_rank_above_ten_as_warn(project, tmp_path):
    root = make_project(tmp_path / "p")
    p = Project.load(root)
    big = run_folder(RUNS[1])  # 294 combinations of conv_dims x representation_module x lstm_layer x time_embedding
    other = get_run(p, run_folder(RUNS[1]))
    # B is a copy of the big run with its ranking reversed: A's best combination is B's worst
    import shutil

    copy = other.path.parent / "2026-09-19_140500_TIM-39_copy"
    shutil.copytree(other.path, copy)
    cells = pd.read_parquet(copy / "cells.parquet")
    cells["test_mape"] = cells["test_mape"].max() + cells["test_mape"].min() - cells["test_mape"]
    cells.to_parquet(copy / "cells.parquet")
    r = two(p, "best-config", a=big, b=copy.name)
    assert r["data"]["a"]["in_other"]["rank"] > 10 and r["data"]["a"]["in_other"]["flag"] == "warn"
    assert two(p, "best-config", a=big, b=big)["data"]["a"]["in_other"]["flag"] == "best"


# --- Alle Kombinationen --------------------------------------------------------------------------------------------
def test_all_combinations_values_best_and_median_per_run(project):
    d = two(project, "all-combos")["data"]
    a = means(project, A30, ["forecaster"])
    assert sorted(d["a"]["values"]) == pytest.approx(sorted(a.values))
    assert d["a"]["best"] == pytest.approx(a.min()) and d["a"]["median"] == pytest.approx(a.median())


def test_all_combinations_title_names_the_better_middle(project):
    r = two(project, "all-combos")
    assert r["title"].startswith("A liegt in der Mitte besser (Median ")


# --- Regionen --------------------------------------------------------------------------------------------------------
def test_regions_best_combination_per_channel_and_the_relative_difference(project):
    d = two(project, "regions-ab")["data"]
    assert [x["channel"] for x in d["rows"]] == ["us", "eu", "asia", "latam"]
    run = get_run(project, A30)
    best = means(project, A30, ["forecaster"]).idxmin()
    ch = run.channels.merge(run.ok_cells()[["cell_id", "forecaster"]], on="cell_id")
    va = ch[(ch["forecaster"] == best) & (ch["channel"] == "us")]["test_mape"].mean()
    row = d["rows"][0]
    assert row["a"] == pytest.approx(va) and row["diff"] == pytest.approx((row["b"] - row["a"]) / row["a"] * 100)


def test_regions_need_channels_in_both_runs(project, tmp_path):
    root = make_project(tmp_path / "p")
    p = Project.load(root)
    (get_run(p, B90).path / "channels.parquet").unlink()
    assert two(p, "regions-ab")["unavailable"] == "Mindestens ein Lauf hat keine Kanäle"


# --- Umfang und Fehler --------------------------------------------------------------------------------------------------
def test_scope_and_errors_per_run(project):
    r = two(project, "scope-errors", a=run_folder(RUNS[1]), b=A30)
    d = r["data"]
    assert d["a"]["cells"] == 294 and d["a"]["errors"] > 0 and d["b"]["errors"] == 0
    assert d["a"]["epoch"] == "tsrm6" and d["b"]["epoch"] == "eval-all-windows"
    assert d["a"]["merkmal"] == [{"key": "data.pred_len", "label": "pred_len", "value": "30"}]
    assert d["a"]["duration"] > 0 and d["error_limit"] == 50
    assert r["title"] == f"A: 294 Zellen ({d['a']['errors']} Fehler), B: 30 Zellen (0 Fehler)"


def test_a_running_run_is_flagged(project):
    d = two(project, "scope-errors", a=run_folder(RUNS[7]), b=A30)["data"]
    assert d["a"]["running"] is True and d["a"]["duration"] is None


# --- Wirkung je Parameter ---------------------------------------------------------------------------------------------
def test_param_effect_per_axis_value_against_the_run_mean(project):
    d = two(project, "param-effect")["data"]
    a = means(project, A30, ["forecaster"])
    row = next(x for x in d["rows"] if x["value"] == "ets")
    assert row["a"] == pytest.approx((a["ets"] - a.mean()) / a.mean() * 100)
    assert d["scale"] == 8


def test_param_effect_flip_needs_a_sign_change_and_both_effects_above_1_5_percent(project):
    rows = two(project, "param-effect", a=R45, b=R71)["data"]["rows"]
    for r in rows:
        expect = (r["a"] > 0) != (r["b"] > 0) and abs(r["a"]) > 1.5 and abs(r["b"]) > 1.5
        assert r["flips"] == expect


def test_param_effect_sorting_by_difference(project):
    rows = two(project, "param-effect", a=R45, b=R71, sort="difference")["data"]["rows"]
    diffs = [abs(r["a"] - r["b"]) for r in rows]
    assert diffs == sorted(diffs, reverse=True)


def test_effects_without_shared_axes_say_so(project):
    for key in ("param-effect", "rank-stability", "rank-jumps"):
        r = two(project, key, a=run_folder(RUNS[7]), b=run_folder(RUNS[8]))  # encoding_size/lstm vs time_embedding
        assert r["unavailable"] == "Keine gemeinsamen Kombinationen", key


# --- Rangfolge ------------------------------------------------------------------------------------------------------------
def test_rank_stability_spearman_top_overlap_and_rank_of_as_best_in_b(project):
    d = two(project, "rank-stability", a=A30, b=A30B)["data"]
    a, b = means(project, A30, ["forecaster"]), means(project, A30B, ["forecaster"])
    expected = np.corrcoef(a.rank().values, b.loc[a.index].rank().values)[0, 1]
    assert d["spearman"] == pytest.approx(expected)
    assert d["n"] == 5 and len(d["points"]) == 5
    assert d["best_a_rank_in_b"] == int(b.rank().loc[a.idxmin()])
    assert d["top_overlap"][1] == 5


def test_rank_stability_title(project):
    r = two(project, "rank-stability", a=A30, b=A30B)
    assert r["title"].startswith("Rangfolge hält") or r["title"].startswith("Rangfolge hält nur teilweise") or r["title"].startswith("Rangfolge hält nicht")
    assert "Spearman" in r["title"] and "der Top 5 bleiben" in r["title"]


def test_rank_jumps_the_seven_largest_changes(project):
    big = run_folder(RUNS[1])
    r = two(project, "rank-jumps", a=big, b=big)
    assert r["title"] == "Keine Rangänderung: Die Rangfolge ist in beiden Läufen gleich"
    r2 = two(project, "rank-jumps", a=R45, b=R71)
    jumps = [x["jump"] for x in r2["data"]["rows"]]
    assert jumps == sorted(jumps, reverse=True) and len(jumps) <= 7
    assert all(x["jump"] == abs(x["a"] - x["b"]) for x in r2["data"]["rows"])


# --- project scope ------------------------------------------------------------------------------------------------------------
def proj(project, key, runs=None, **params):
    return widgets.compute(project, key, {"scope": "project", "runs": runs or [], "params": params})


def test_project_best_one_point_per_run_with_a_best_value(project):
    d = proj(project, "project-best")["data"]
    assert len(d["points"]) == 9
    p = next(x for x in d["points"] if x["id"] == B90)
    assert p["value"] == pytest.approx(means(project, B90, ["forecaster"]).min()) and p["label"] == "TIM-52" and p["series"] == "90"
    dates = [x["date"] for x in d["points"]]
    assert dates == sorted(dates)


def test_project_best_colours_by_the_lauf_merkmal_one_series_per_value(project):
    d = proj(project, "project-best")["data"]
    assert d["series"] == [{"value": "30", "index": 0}, {"value": "90", "index": 1}] and d["color_label"] == "pred_len"
    assert proj(project, "project-best", color_by="none")["data"]["series"] == []  # project without a Lauf-Merkmal: one series
    assert len(proj(project, "project-best", color_by="none")["data"]["lines"]) == 1


def test_project_best_line_is_the_best_so_far_in_the_current_epoch_only(project):
    d = proj(project, "project-best")["data"]
    line = next(l for l in d["lines"] if l["series"] == "30")["points"]
    values = [p["value"] for p in line]
    assert values == sorted(values, reverse=True)  # never rises
    older = {p["date"] for p in d["points"] if p["older"]}
    assert not (older & {p["date"] for p in line})  # runs of an older epoch are not in the line
    assert any(p["older"] for p in d["points"]) and d["epoch"] == "eval-all-windows"


def test_project_best_marks_selected_and_running_runs_and_names_the_best(project):
    r = proj(project, "project-best", runs=[B90])
    pts = {p["id"]: p for p in r["data"]["points"]}
    assert pts[B90]["selected"] and not pts[A30]["selected"]
    assert any(p["running"] for p in pts.values())
    assert r["title"].startswith("Bestes Ergebnis der aktuellen Epoche: ")
    assert "pred_len 30" in r["title"]
    assert {o["value"] for o in r["options"]["color_by"]} == {"none", "data.pred_len"}


def test_param_map_default_selection_is_the_finished_runs_of_the_current_epoch(project):
    d = proj(project, "param-map")["data"]
    ids = [r["id"] for r in d["runs"]]
    assert R45 not in ids and run_folder(RUNS[7]) not in ids  # older epoch, still running
    assert A30 in ids and B90 in ids and d["cap"] == 6
    groups = [r["group"] for r in d["runs"]]
    assert groups == sorted(groups)  # grouped by Lauf-Merkmal


def test_param_map_cells_are_effects_against_the_run_mean_or_empty_when_not_varied(project):
    d = proj(project, "param-map", runs=[A30, R71, run_folder(RUNS[8])])["data"]
    row = next(r for r in d["rows"] if (r["axis"], r["value"]) == ("forecaster", "ets"))
    a = means(project, A30, ["forecaster"])
    ids = [r["id"] for r in d["runs"]]
    assert row["cells"][ids.index(A30)] == pytest.approx((a["ets"] - a.mean()) / a.mean() * 100)
    assert row["cells"][ids.index(run_folder(RUNS[8]))] is None  # sweep_check does not vary the forecaster


def test_param_map_consistency_per_lauf_merkmal_value(project):
    d = proj(project, "param-map", runs=[A30, A30B, B90, run_folder(RUNS[0])])["data"]
    row = next(r for r in d["rows"] if (r["axis"], r["value"]) == ("forecaster", "rep-net"))
    by = {c["group"]: c for c in row["consistency"]}
    assert by["30"]["text"] == "immer besser" and by["90"]["text"] == "immer besser" and not row["flips"]


def test_param_map_flips_when_the_direction_differs_between_lauf_merkmal_values(project, tmp_path):
    root = make_project(tmp_path / "p")
    p = Project.load(root)
    run = get_run(p, B90)
    df = pd.read_parquet(run.path / "cells.parquet")
    df["test_mape"] = df["test_mape"].where(df["forecaster"] != "ets", df["test_mape"] * 0.5)  # ets becomes best in the 90 run
    df.loc[df["forecaster"] == "rep-net", "test_mape"] = df["test_mape"].max() * 2
    df.to_parquet(run.path / "cells.parquet")
    d = widgets.compute(p, "param-map", {"scope": "project", "runs": [A30, B90]})["data"]
    row = next(r for r in d["rows"] if (r["axis"], r["value"]) == ("forecaster", "rep-net"))
    assert row["flips"] is True
    title = widgets.compute(p, "param-map", {"scope": "project", "runs": [A30, B90]})["title"]
    assert "verschieden" in title and not title.startswith("Kein")


def test_param_map_needs_runs_with_axes(project):
    r = proj(project, "param-map", runs=["2020-01-01_000000_gone"])
    assert r["unavailable"] == "Keine Läufe mit variierten Achsen ausgewählt"
