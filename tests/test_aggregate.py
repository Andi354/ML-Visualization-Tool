import shutil

import pandas as pd
import pytest

from mlviz import aggregate
from mlviz.fixture import RUNS, make_project, run_folder
from mlviz.project import Project
from mlviz.runs import Run, get_run

M = "test_mse_missing"


@pytest.fixture(scope="module")
def project(demo_project):
    return Project.load(demo_project)


def run_of(project, experiment, nth=0):
    folders = [run_folder(r) for r in RUNS if r["experiment"] == experiment]
    return get_run(project, folders[nth])


@pytest.fixture(scope="module")
def r52(project):
    return run_of(project, "TIM-52_best_30")


@pytest.fixture(scope="module")
def big(project):
    return run_of(project, "TIM-39_grid_multivariate_30")


def table(run, project, **q):
    return aggregate.run_table(run, project, q)


def rows_by(t, key):
    return {r["params"][key]: r for r in t["rows"]}


# --- defaults ----------------------------------------------------------------------------------
def test_defaults_axes_split_replicates_averaged_channels_overall(project, r52):
    t = table(r52, project)
    assert t["params"] == ["forecaster"]
    assert t["groups"] == 5 and t["cells"] == 30
    assert t["sort"] == {"metric": M, "stat": "mean", "dir": "asc"}
    means = [r["metrics"][M]["mean"] for r in t["rows"]]
    assert means == sorted(means)


def test_group_mean_and_sd_are_over_the_replicate_cells(project, r52):
    t = table(r52, project)
    ok = r52.ok_cells()
    for r in t["rows"]:
        v = ok.loc[ok["forecaster"] == r["params"]["forecaster"], M]
        assert r["n"] == len(v) == 6
        assert r["metrics"][M]["mean"] == pytest.approx(v.mean())
        assert r["metrics"][M]["std"] == pytest.approx(v.std())
        assert r["metrics"][M]["min"] == pytest.approx(v.min())
        assert r["metrics"][M]["max"] == pytest.approx(v.max())


# --- averaging, filtering --------------------------------------------------------------------
def test_axis_switched_to_average_groups_over_the_remaining_dimensions(project):
    run = run_of(project, "TIM-45_g6_combined")
    full = table(run, project)
    t = table(run, project, dims={"time_embedding": {"mode": "agg"}})
    assert "time_embedding" not in t["params"]
    assert t["groups"] == full["groups"] // 2
    ok = run.ok_cells()
    row = t["rows"][0]
    sub = ok
    for k, v in row["params"].items():
        sub = sub[sub[k] == v]
    assert row["metrics"][M]["mean"] == pytest.approx(sub[M].mean())
    assert row["n"] == len(sub)


def test_value_selection_filters_cells_and_none_selected_means_all(project, r52):
    t = table(r52, project, dims={"forecaster": {"mode": "split", "sel": ["rep-net", "ets"]}})
    assert {r["params"]["forecaster"] for r in t["rows"]} == {"rep-net", "ets"}
    assert t["cells"] == 12
    assert table(r52, project, dims={"forecaster": {"mode": "split", "sel": []}})["groups"] == 5


def test_selection_works_on_an_averaged_dimension_too(project, r52):
    t = table(r52, project, dims={"shuffle_seed": {"mode": "agg", "sel": ["1"]}})
    assert t["cells"] == 10 and all(r["n"] == 2 for r in t["rows"])


def test_replicates_split_become_columns_one_row_per_cell(project, r52):
    t = table(r52, project, dims={"shuffle_seed": {"mode": "split"}, "cv_fold": {"mode": "split"}})
    assert t["params"] == ["forecaster", "shuffle_seed", "cv_fold"]
    assert t["groups"] == 30 and all(r["n"] == 1 for r in t["rows"])
    assert all(r["metrics"][M]["std"] is None for r in t["rows"])  # sd of a single cell is undefined


def test_paired_axis_is_one_dimension_with_the_label_as_value(project):
    run = run_of(project, "TIM-45_g6_combined")
    d = aggregate.run_dims(run)
    pair = next(x for x in d["dims"] if x["key"] == "lr_epochs")
    assert [v["value"] for v in pair["values"]][0] == "learning_rate=0.0005, max_epochs=20"
    assert pair["section"] == "train"
    assert not any(x["key"] in ("learning_rate", "max_epochs") for x in d["dims"])


# --- channels ----------------------------------------------------------------------------------
def test_channels_split_adds_a_column_and_takes_values_from_the_channel_table(project, r52):
    t = table(r52, project, dims={"channel": {"mode": "split"}})
    assert t["params"] == ["forecaster", "channel"]
    assert t["groups"] == 5 * 4
    ch = r52.channels.merge(r52.ok_cells()[["cell_id", "forecaster"]], on="cell_id")
    for r in t["rows"][:6]:
        v = ch[(ch["forecaster"] == r["params"]["forecaster"]) & (ch["channel"] == r["params"]["channel"])][M]
        assert r["metrics"][M]["mean"] == pytest.approx(v.mean())


def test_channel_selection_filters_channels(project, r52):
    t = table(r52, project, dims={"channel": {"mode": "split", "sel": ["us", "eu"]}})
    assert {r["params"]["channel"] for r in t["rows"]} == {"us", "eu"}
    assert t["groups"] == 10


def test_channel_selection_without_split_averages_the_selected_channels(project, r52):
    t = table(r52, project, dims={"channel": {"mode": "agg", "sel": ["us", "eu"]}})
    assert t["params"] == ["forecaster"] and t["groups"] == 5
    ch = r52.channels[r52.channels["channel"].isin(["us", "eu"])].groupby("cell_id")[M].mean()
    ok = r52.ok_cells().set_index("cell_id")
    expected = ch.reindex(ok.index).groupby(ok["forecaster"]).mean()
    for r in t["rows"]:
        assert r["metrics"][M]["mean"] == pytest.approx(expected[r["params"]["forecaster"]])


def test_no_channel_dimension_without_channels_or_with_one_channel(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = run_of(Project.load(root), "sweep_check")
    (run.path / "channels.parquet").unlink()
    assert not any(d["kind"] == "channel" for d in aggregate.run_dims(Run(run.path))["dims"])
    ch = pd.read_parquet(run_of(Project.load(root), "TIM-52_best_90").path / "channels.parquet")
    one = Run(run_of(Project.load(root), "TIM-52_best_90").path)
    ch[ch["channel"] == "us"].to_parquet(one.path / "channels.parquet")
    assert not any(d["kind"] == "channel" for d in aggregate.run_dims(Run(one.path))["dims"])


# --- sorting, best, limit ---------------------------------------------------------------------
def test_sorting_is_global_over_all_groups_not_only_the_rendered_rows(project, big):
    t = table(big, project, limit=5, sort={"metric": M, "dir": "asc"})
    assert t["shown"] == 5 and t["groups"] == 294
    ok = big.ok_cells()
    axes = big.axes
    means = ok.groupby(axes)[M].mean().sort_values()
    assert [r["metrics"][M]["mean"] for r in t["rows"]] == pytest.approx(list(means.iloc[:5]))
    desc = table(big, project, limit=5, sort={"metric": M, "dir": "desc"})
    assert [r["metrics"][M]["mean"] for r in desc["rows"]] == pytest.approx(list(means.iloc[::-1].iloc[:5]))


def test_more_than_200_groups_renders_the_first_200(project, big):
    t = table(big, project)
    assert t["groups"] == 294 and t["shown"] == len(t["rows"]) == 200 and t["cells"] == 294


def test_best_is_the_best_group_of_the_sort_metric_over_all_groups(project, big):
    t = table(big, project, limit=3, sort={"metric": "test_mape", "dir": "desc"})
    ok = big.ok_cells()
    best = ok.groupby(big.axes)["test_mape"].mean().min()
    assert t["best"]["value"] == pytest.approx(best)
    assert t["best"]["metric"] == "test_mape"
    # sorted descending, so the best group is not among the first rows
    assert t["best"]["key"] not in [r["key"] for r in t["rows"]]


def test_best_respects_a_max_direction(project, r52, tmp_path):
    p = Project.load(project.root)
    p.metrics[0].direction = "max"
    t = aggregate.run_table(r52, p, {})
    assert t["sort"]["dir"] == "desc"
    assert t["best"]["value"] == pytest.approx(max(r["metrics"][M]["mean"] for r in t["rows"]))


def test_sort_by_group_size_and_by_min_max(project, r52):
    t = table(r52, project, sort={"metric": M, "stat": "n", "dir": "desc"}, dims={"forecaster": {"mode": "split", "sel": []}})
    assert [r["n"] for r in t["rows"]] == sorted((r["n"] for r in t["rows"]), reverse=True)
    mn = table(r52, project, sort={"metric": M, "stat": "min", "dir": "asc"})
    vals = [r["metrics"][M]["min"] for r in mn["rows"]]
    assert vals == sorted(vals)


# --- failed cells -------------------------------------------------------------------------------
def test_n_counts_successful_cells_and_errors_are_counted_per_group(project, big):
    t = table(big, project, dims={"lstm_layer": {"mode": "agg"}})
    cells = big.cells
    for r in t["rows"][:10]:
        sub = cells
        for k, v in r["params"].items():
            sub = sub[sub[k].astype(str) == v]
        assert r["n"] == int((sub["status"] == "ok").sum())
        assert r["errors"] == int((sub["status"] == "error").sum())


def test_group_with_only_failed_cells_has_no_values_and_sorts_last(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = run_of(Project.load(root), "TIM-52_best_30")
    df = pd.read_parquet(run.path / "cells.parquet")
    mask = df["forecaster"] == "rep-net"  # the best forecaster fails completely
    df.loc[mask, "status"] = "error"
    df.loc[mask, M] = None
    df.to_parquet(run.path / "cells.parquet")
    t = aggregate.run_table(Run(run.path), Project.load(root), {})
    last = t["rows"][-1]
    assert last["params"]["forecaster"] == "rep-net"
    assert last["n"] == 0 and last["errors"] == 6 and last["metrics"][M]["mean"] is None
    t_desc = aggregate.run_table(Run(run.path), Project.load(root), {"sort": {"metric": M, "dir": "desc"}})
    assert t_desc["rows"][-1]["params"]["forecaster"] == "rep-net"  # last in both directions


# --- sidebar ----------------------------------------------------------------------------------
def test_sections_follow_config_blocks_then_replicates_then_channels(project, r52):
    d = aggregate.run_dims(r52)
    assert d["sections"] == ["model", "Wiederholungen", "Kanäle"]
    assert [x["key"] for x in d["dims"]] == ["forecaster", "shuffle_seed", "cv_fold", "channel"]
    assert [v["n"] for v in d["dims"][0]["values"]] == [6] * 5


def test_constants_list_non_swept_entries_and_single_valued_axes(project):
    run = run_of(project, "TIM-45_g6_combined")
    blocks = {b["block"]: {r["key"]: r["value"] for r in b["rows"]} for b in aggregate.constants(run)}
    assert blocks["data"]["pred_len"] == "30"
    assert "lstm_layer" not in blocks["model"]  # swept
    assert "learning_rate" not in blocks["train"] and "max_epochs" not in blocks["train"]  # paired members
    assert blocks["model"]["conv_dims"] == "[16, 32]"
    assert blocks["train"]["calc_real"] == "true"


def test_a_single_valued_axis_is_a_constant_not_a_dimension(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = run_of(Project.load(root), "TIM-52_best_30")
    df = pd.read_parquet(run.path / "cells.parquet")
    df["forecaster"] = "rep-net"
    df.to_parquet(run.path / "cells.parquet")
    plan = pd.read_parquet(run.path / "plan.parquet")
    plan["forecaster"] = "rep-net"
    plan.to_parquet(run.path / "plan.parquet")
    r = Run(run.path)
    assert aggregate.dimension_axes(r) == []
    consts = {b["block"]: {x["key"]: x["value"] for x in b["rows"]} for b in aggregate.constants(r)}
    assert consts["model"]["forecaster"] == "rep-net"
    t = aggregate.run_table(r, Project.load(root), {})
    assert t["params"] == [] and t["groups"] == 1


def test_migrated_run_with_a_config_lacking_keys_still_works(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = run_of(Project.load(root), "TIM-30_baselines_30")
    (run.path / "config.yaml").write_text("sweep: {forecaster: [a]}\n")
    r = Run(run.path)
    d = aggregate.run_dims(r)
    assert d["constants"] == [] or isinstance(d["constants"], list)
    assert aggregate.run_table(r, Project.load(root), {})["groups"] == 5


# --- overview ---------------------------------------------------------------------------------
def test_overview_has_a_card_per_axis_and_one_for_the_channel_sorted_by_spread(project):
    run = run_of(project, "TIM-45_g6_combined")
    cards = table(run, project)["overview"]["cards"]
    assert {c["key"] for c in cards} == {"lr_epochs", "lstm_layer", "time_embedding", "channel"}
    spreads = [c["spread"] for c in cards]
    assert spreads == sorted(spreads, reverse=True)
    lstm = next(c for c in cards if c["key"] == "lstm_layer")
    ok = run.ok_cells()
    for v in lstm["values"]:
        sub = ok[ok["lstm_layer"] == v["value"]][M]
        assert v["mean"] == pytest.approx(sub.mean()) and v["std"] == pytest.approx(sub.std()) and v["n"] == len(sub)
    assert lstm["best_value"] == min(lstm["values"], key=lambda v: v["mean"])["value"]


def test_overview_follows_the_filters(project, r52):
    t = table(r52, project, dims={"shuffle_seed": {"mode": "agg", "sel": ["1"]}})
    card = next(c for c in t["overview"]["cards"] if c["key"] == "forecaster")
    assert all(v["n"] == 2 for v in card["values"])


def test_overview_can_be_left_out(project, r52):
    assert "overview" not in table(r52, project, overview=False)


def test_histogram_covers_all_group_means_and_marks_the_best_bin(project, big):
    t = table(big, project)
    h = t["histogram"]
    # one cell per group here, so every failed cell is a group without a mean
    assert sum(h["counts"]) == 294 - big.error_count() and len(h["counts"]) == 14
    assert h["lo"] == pytest.approx(t["best"]["value"]) and h["best_bin"] == 0


def test_unknown_dimensions_in_the_query_are_ignored(project, r52):
    assert table(r52, project, dims={"nope": {"mode": "split", "sel": ["x"]}})["groups"] == 5


def test_empty_run(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = run_of(Project.load(root), "sweep_check")
    pd.read_parquet(run.path / "cells.parquet").iloc[0:0].to_parquet(run.path / "cells.parquet")
    t = aggregate.run_table(Run(run.path), Project.load(root), {})
    assert t["groups"] == 0 and t["rows"] == []
