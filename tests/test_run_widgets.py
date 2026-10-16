import re

import numpy as np
import pandas as pd
import pytest

from mlviz import widgets
from mlviz.fixture import RUNS, make_project, run_folder
from mlviz.project import Project
from mlviz.runs import get_run
from mlviz.widgets.common import combo_cells
from mlviz.widgets.runscope import best_combo, real_metrics

R52 = run_folder(next(r for r in RUNS if r["experiment"] == "TIM-52_best_30"))
R45 = run_folder(next(r for r in RUNS if r["experiment"] == "TIM-45_g6_combined"))
R71 = run_folder(next(r for r in RUNS if r["experiment"] == "TIM-71_example"))


@pytest.fixture(scope="module")
def project(demo_project):
    return Project.load(demo_project)


def compute(project, key, run=R52, combo=None, **settings):
    return widgets.compute(project, key, {"run": run, "scope": "run", "combo": combo or {}, "settings": settings})


def test_catalog_has_the_one_run_widgets_in_the_documented_order(project):
    keys = [w["key"] for w in widgets.catalog("run")]
    assert keys == ["compare-table", "per-region", "config", "axis-effect", "stability"]
    assert all(w["question"].endswith("?") for w in widgets.catalog("run"))


# --- Vergleichstabelle -----------------------------------------------------------------------------
def test_compare_table_rows_are_the_forecaster_axis_and_columns_the_real_metrics(project):
    d = compute(project, "compare-table")["data"]
    assert d["row_key"] == "forecaster" and d["rows"] == ["rep-net", "sarima", "ets", "prophet", "snaive"]
    assert [c["key"] for c in d["columns"]] == [m.key for m in real_metrics(project, get_run(project, R52))]
    assert all(c["key"] not in ("test_mse_missing",) for c in d["columns"])  # scaled metrics are not compared
    assert d["groups"] == [None]


def test_compare_table_values_are_replicate_means_and_the_best_per_column_is_marked(project):
    d = compute(project, "compare-table")["data"]
    run = get_run(project, R52)
    ok = run.ok_cells()
    expected = ok.groupby("forecaster")["test_mape"].mean()
    col = [c["key"] for c in d["columns"]].index("test_mape")
    for r, line in zip(d["rows"], d["cells"]):
        assert line[0]["test_mape"]["value"] == pytest.approx(expected[r])
    best_rows = [r for r, line in zip(d["rows"], d["cells"]) if line[0]["test_mape"]["best"]]
    assert best_rows == [expected.idxmin()]
    assert sum(1 for line in d["cells"] if line[0]["test_mape"]["best"]) == 1


def test_compare_table_title_counts_the_columns_the_winner_leads(project):
    r = compute(project, "compare-table")
    assert r["title"] == "rep-net ist in allen 6 Spalten am besten"
    assert r["note"] == "niedriger = besser · grün = bester Wert je Spalte"
    assert "forecaster × MAPE" in r["subtitle"] and "Replikate gemittelt" in r["subtitle"]


def test_other_dimensions_are_fixed_to_their_best_value_and_named_in_the_subtitle(project):
    r = compute(project, "compare-table", run=R45)
    run = get_run(project, R45)
    frame = combo_cells(run, {})
    best = best_combo(run, frame, ["lr_epochs", "lstm_layer", "time_embedding"], real_metrics(project, run)[0])
    assert r["data"]["row_key"] == "lr_epochs"
    assert r["data"]["fixed"] == {k: v for k, v in best.items() if k != "lr_epochs"}
    assert "fest: lstm_layer = " in r["subtitle"]


def test_compare_table_column_groups_from_a_second_dimension(project):
    r = compute(project, "compare-table", run=R45, rows="lstm_layer", groups="time_embedding")
    d = r["data"]
    assert d["groups"] == ["calendar", "none"] and d["groups_key"] == "time_embedding"
    assert len(d["cells"][0]) == 2
    assert "Spalten nach time_embedding" in r["subtitle"]
    assert re.search(r" ist in (allen )?\d+ (von 12 )?Spalten am besten$", r["title"]) or r["title"].endswith("allen 12 Spalten am besten")


def test_the_first_row_is_bold_only_when_it_is_the_projects_own_model(project):
    assert compute(project, "compare-table")["data"]["own_row"] == "rep-net"
    assert compute(project, "compare-table", run=R45)["data"]["own_row"] is None


def test_a_combination_acts_as_a_filter(project):
    r = compute(project, "compare-table", run=R45, combo={"lstm_layer": "1"})
    assert r["data"]["fixed"].get("lstm_layer") == "1"
    assert compute(project, "compare-table", combo={"forecaster": "nope"})["unavailable"] == "Keine Zellen unter diesem Filter"


# --- Je Region -----------------------------------------------------------------------------------
def test_per_region_table_has_a_row_per_channel_and_marks_the_best_per_row(project):
    r = compute(project, "per-region")
    d = r["data"]
    assert d["channels"] == ["asia", "eu", "latam", "us"] and d["series"][0] == "rep-net"
    assert d["metric"]["key"] == "test_mape" and d["format"] == "table"
    for line in d["grid"]:
        vals = [c["value"] for c in line]
        assert [c["best"] for c in line].count(True) == 1
        assert line[int(np.argmin(vals))]["best"]
    assert r["title"] == "rep-net ist in 4 von 4 Regionen am besten"


def test_per_region_values_come_from_the_channel_table(project):
    d = compute(project, "per-region")["data"]
    run = get_run(project, R52)
    ch = run.channels.drop(columns="forecaster").merge(run.ok_cells()[["row", "forecaster"]], on="row")
    assert d["grid"][1][2]["value"] == pytest.approx(ch[(ch["channel"] == "eu") & (ch["forecaster"] == d["series"][2])]["test_mape"].mean())


def test_per_region_bars_format_and_metric_setting(project):
    r = compute(project, "per-region", format="bars", metric="test_mae")
    assert r["data"]["format"] == "bars" and r["data"]["metric"]["key"] == "test_mae"
    assert any(o["value"] == "test_mse_missing" for o in r["options"]["metric"])


def test_per_region_two_series_says_besser(project):
    r = compute(project, "per-region", run=R71, rows="lstm_layer")
    assert r["title"].endswith("Regionen besser")


def test_per_region_without_channels(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = get_run(Project.load(root), R52)
    (run.path / "channels.parquet").unlink()
    r = widgets.compute(Project.load(root), "per-region", {"run": R52, "scope": "run"})
    assert r["unavailable"] == "Dieser Lauf hat keine Kanäle"


# --- Beste Config ----------------------------------------------------------------------------------
def test_config_in_the_run_scope_is_the_best_combination(project):
    r = compute(project, "config")
    run = get_run(project, R52)
    best = best_combo(run, combo_cells(run, {}), ["forecaster"], real_metrics(project, run)[0])
    assert r["data"]["combo"] == best
    assert r["title"] == "Beste Config: forecaster = rep-net"


def test_config_filter_wins_over_the_best_value(project):
    r = compute(project, "config", combo={"forecaster": "ets"})
    assert r["data"]["combo"] == {"forecaster": "ets"}


# --- Wirkung je Achse ----------------------------------------------------------------------------------
def test_axis_effect_is_sorted_by_spread_and_names_the_best_value(project):
    r = compute(project, "axis-effect", run=R45)
    axes = r["data"]["axes"]
    assert [a["spread"] for a in axes] == sorted((a["spread"] for a in axes), reverse=True)
    run = get_run(project, R45)
    ok = run.ok_cells()
    overall = ok["test_mape"].mean()
    top = axes[0]
    means = ok.groupby(top["axis"])["test_mape"].mean()
    assert top["spread"] == pytest.approx((means.max() - means.min()) / overall * 100)
    assert top["best"] == means.idxmin() and top["worst"] == means.idxmax()
    assert all(v["rel"] == pytest.approx((v["mean"] - overall) / overall * 100) for v in top["values"])
    assert r["title"].startswith(f"{top['axis']} wirkt am stärksten: ")


def test_axis_effect_without_a_varied_axis(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = get_run(Project.load(root), R52)
    df = pd.read_parquet(run.path / "cells.parquet")
    df["forecaster"] = "x"
    df.to_parquet(run.path / "cells.parquet")
    plan = pd.read_parquet(run.path / "plan.parquet")
    plan["forecaster"] = "x"
    plan.to_parquet(run.path / "plan.parquet")
    r = widgets.compute(Project.load(root), "axis-effect", {"run": R52, "scope": "run"})
    assert r["unavailable"] == "Dieser Lauf hat keine Achsen"


# --- Stabilität ------------------------------------------------------------------------------------
def test_stability_shows_every_replicate_with_mean_and_sd(project):
    r = compute(project, "stability")
    d = r["data"]
    assert d["row_key"] == "forecaster" and len(d["rows"]) == 5
    row = d["rows"][0]
    assert len(row["points"]) == 6  # 3 seeds x 2 folds
    vals = [p["value"] for p in row["points"]]
    assert row["mean"] == pytest.approx(np.mean(vals)) and row["sd"] == pytest.approx(np.std(vals, ddof=1))
    assert "shuffle_seed" in row["points"][0]["label"]
    assert "deterministische Modelle variieren nur über Folds" in r["note"]


def test_stability_title_names_the_calmest_row(project):
    r = compute(project, "stability")
    calm = min(r["data"]["rows"], key=lambda x: x["sd"])
    assert r["title"].startswith(f"{calm['value']} schwankt am wenigsten (sd ")


def test_stability_without_replicates_to_compare(project):
    r = compute(project, "stability", run=run_folder(RUNS[1]))  # one seed per combination
    assert r["title"] == "Es gibt keine Wiederholungen zum Vergleichen"
    assert all(row["sd"] is None for row in r["data"]["rows"])


# --- API -----------------------------------------------------------------------------------------
def test_api_serves_the_run_widgets(demo_project):
    from fastapi.testclient import TestClient
    from mlviz.server import create_app

    client = TestClient(create_app(demo_project))
    r = client.post("/api/widgets/compare-table", json={"run": R52, "scope": "run"})
    assert r.status_code == 200 and r.json()["data"]["rows"][0] == "rep-net"
