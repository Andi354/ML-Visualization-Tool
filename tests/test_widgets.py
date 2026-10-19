import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from mlviz import widgets
from mlviz.fixture import RUNS, make_project, run_folder
from mlviz.project import Project
from mlviz.runs import Run, get_run
from mlviz.server import create_app
from mlviz.widgets.common import combo_cells, de

NEW = run_folder(next(r for r in RUNS if r["experiment"] == "TIM-71_example"))
OLD = run_folder(next(r for r in RUNS if r["experiment"] == "TIM-52_best_30"))
COMBO = {"forecaster": "rep-net", "lstm_layer": "1"}


@pytest.fixture(scope="module")
def project(demo_project):
    return Project.load(demo_project)


def compute(project, key, run=NEW, combo=COMBO, **settings):
    return widgets.compute(project, key, {"run": run, "combo": combo, "settings": settings})


def test_german_number_format():
    assert de(2.234) == "2,2" and de(1234567.25, 2) == "1 234 567,25"
    assert de(-0.001, 1) == "0,0" and de(-2.2) == "−2,2" and de(None) == "–"


def test_catalog_documents_every_widget(project):
    cat = {w["key"]: w for w in widgets.catalog()}
    assert {"curves", "forecast", "replicates", "config"} <= set(cat)
    for w in cat.values():
        assert w["label"] and w["question"].endswith("?") and w["scopes"]
        assert all({"key", "label", "type"} <= s.keys() for s in w["settings"])
    assert cat["curves"]["requires"] == "curves" and cat["forecast"]["requires"] == "predictions"
    assert {w["key"] for w in widgets.catalog("combination")} >= {"curves", "forecast", "replicates", "config"}
    assert widgets.catalog("two-runs") == [w for w in widgets.catalog() if "two-runs" in w["scopes"]]


# --- Loss-Kurven ---------------------------------------------------------------------------------
def test_curves_without_curves_say_so_and_cannot_be_saved_data(project):
    r = compute(project, "curves", run=OLD, combo={})
    assert r["unavailable"] == "Dieser Lauf hat keine Lernkurven gespeichert" and "data" not in r


def test_curves_use_the_first_fold_one_thin_line_per_seed_and_a_mean(project):
    r = compute(project, "curves")
    d = r["data"]
    assert len(d["seeds"]) == 2 and len(d["epochs"]) == 40 == len(d["mean"]["val"])
    assert "Fold 0" in r["subtitle"] and "2 Seeds" in r["subtitle"]
    for k in ("train", "val"):
        assert d["mean"][k][5] == pytest.approx(np.mean([s[k][5] for s in d["seeds"]]))
    assert d["mode"] == "single"


def test_curves_title_names_the_epoch_with_the_lowest_mean_val_loss(project):
    r = compute(project, "curves")
    val = r["data"]["mean"]["val"]
    best = int(np.argmin(val)) + 1
    assert r["data"]["best_epoch"] == best
    assert r["title"] == f"val_loss am niedrigsten in Epoche {best} von 40"


def test_curves_mean_only_mode_and_no_hint_lines(project):
    r = compute(project, "curves", mode="mean")
    assert r["data"]["mode"] == "mean" and "note" not in r
    assert "note" not in compute(project, "curves")


def test_curves_for_a_combination_without_cells(project):
    assert "keine Lernkurven vor" in compute(project, "curves", combo={"forecaster": "nope"})["unavailable"]


# --- Vorhersage ----------------------------------------------------------------------------------
def test_forecast_without_predictions_says_so(project):
    assert compute(project, "forecast", run=OLD, combo={})["unavailable"] == "Dieser Lauf hat keine Vorhersagen gespeichert"


def test_forecast_defaults_to_the_first_channel_and_the_last_window(project):
    r = compute(project, "forecast")
    d = r["data"]
    assert d["channel"] == "us"
    assert d["window"]["origins"] is None  # predictions cover the whole test period, no stored windows
    assert d["window"]["start"] == "2026-03-02" and d["window"]["days"] == 30
    assert len(d["series"]["dates"]) == 30 and len(d["overview"]["dates"]) == 90  # whole test period
    assert r["options"]["channel"] == ["us", "eu", "asia", "latam"]


def test_forecast_mean_band_and_error_in_percent(project):
    s = compute(project, "forecast")["data"]["series"]
    for lo, m, hi in zip(s["min"], s["mean"], s["max"]):
        assert lo <= m <= hi
    for a, p, e in zip(s["actual"], s["mean"], s["error"]):
        assert e == pytest.approx((p - a) / abs(a) * 100)


def test_forecast_mape_is_the_mean_absolute_percentage_error_of_the_window(project):
    r = compute(project, "forecast")
    s = r["data"]["series"]
    assert r["data"]["mape"] == pytest.approx(np.mean([abs(e) for e in s["error"]]))
    assert r["title"] == f"Region us: MAPE {de(r['data']['mape'])} %"


def test_forecast_channel_and_window_settings(project):
    r = compute(project, "forecast", channel="asia", window="2026-01-03")
    assert r["data"]["channel"] == "asia"
    assert r["data"]["window"]["start"] == "2026-01-03"  # a window of pred_len days starting at the click
    assert "Region asia" in r["title"]
    r2 = compute(project, "forecast", window="2026-01-29")
    assert r2["data"]["window"]["start"] == "2026-01-29"


def test_forecast_channel_from_the_row_when_the_table_is_split_by_channel(project):
    r = compute(project, "forecast", combo={**COMBO, "channel": "latam"})
    assert r["data"]["channel"] == "latam"


def test_forecast_compare_lists_combinations_differing_in_one_axis(project):
    opts = compute(project, "forecast")["options"]["compare"]
    assert opts[0] == {"value": "none", "label": "keine"}
    assert {"value": "forecaster=ets", "label": "forecaster = ets"} in opts
    assert {"value": "lstm_layer=0", "label": "lstm_layer = 0"} in opts
    assert all(o["value"] != "forecaster=rep-net" for o in opts)


def test_forecast_compare_draws_the_other_combination_and_names_its_mape_in_the_title(project):
    r = compute(project, "forecast", compare="forecaster=ets")
    d = r["data"]
    assert d["compare"]["label"] == "ets" and len(d["compare"]["mean"]) == 30
    assert d["compare_mape"] == pytest.approx(np.mean([abs(e) for e in d["compare"]["error"]]))
    assert r["title"].endswith(f"gegenüber {de(d['compare_mape'])} % bei ets")
    assert "note" not in r
    assert compute(project, "forecast")["data"]["compare"] is None


def test_forecast_without_origin_column_uses_a_pred_len_slice(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = get_run(Project.load(root), NEW)
    for f in (run.path / "predictions").glob("*.parquet"):
        df = pd.read_parquet(f)
        df.drop(columns="origin").drop_duplicates(["shuffle_seed", "cv_fold", "channel", "date"]).to_parquet(f)
    p = Project.load(root)
    r = widgets.compute(p, "forecast", {"run": NEW, "combo": COMBO, "settings": {}})
    assert r["data"]["window"]["origins"] is None and r["data"]["window"]["days"] == 30
    assert r["data"]["window"]["end"] == r["data"]["overview"]["dates"][-1]  # last window of the period
    early = widgets.compute(p, "forecast", {"run": NEW, "combo": COMBO, "settings": {"window": "2026-01-01"}})
    assert early["data"]["window"]["start"] == "2026-01-01"
    late = widgets.compute(p, "forecast", {"run": NEW, "combo": COMBO, "settings": {"window": "2030-01-01"}})
    assert late["data"]["window"]["end"] == r["data"]["window"]["end"]  # clamped to the period


# --- Wiederholungen ----------------------------------------------------------------------------
def test_replicates_grid_seed_by_fold(project):
    r = compute(project, "replicates")
    d = r["data"]
    assert d["row_key"] == "shuffle_seed" and d["col_key"] == "cv_fold"
    assert d["rows"] == ["1", "2"] and d["cols"] == ["0", "1"]
    run = get_run(project, NEW)
    cells = combo_cells(run, COMBO)
    v = float(cells[(cells["shuffle_seed"] == "2") & (cells["cv_fold"] == "1")]["test_mse_missing"].iloc[0])
    assert d["grid"][1][1]["value"] == pytest.approx(v)
    assert d["metric"]["key"] == "test_mse_missing" and d["lo"] <= d["hi"]


def test_replicates_title_names_the_best_one(project):
    r = compute(project, "replicates")
    flat = [(c["value"], i, j) for i, row in enumerate(r["data"]["grid"]) for j, c in enumerate(row)]
    best = min(flat)
    assert r["data"]["best"] == {"row": r["data"]["rows"][best[1]], "col": r["data"]["cols"][best[2]]}
    assert r["title"].startswith("Beste Wiederholung: shuffle_seed ")


def test_replicates_metric_setting_and_options(project):
    r = compute(project, "replicates", metric="test_mape")
    assert r["data"]["metric"]["key"] == "test_mape" and "%" in r["title"]
    assert len(r["options"]["metric"]) == 10


def test_replicates_failed_cells_are_empty_grid_cells(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = get_run(Project.load(root), NEW)
    df = pd.read_parquet(run.path / "cells.parquet")
    hit = (df["forecaster"] == "rep-net") & (df["lstm_layer"] == "1") & (df["shuffle_seed"] == 1) & (df["cv_fold"] == 0)
    df.loc[hit, "status"] = "error"
    df.loc[hit, "test_mse_missing"] = None
    df.to_parquet(run.path / "cells.parquet")
    r = widgets.compute(Project.load(root), "replicates", {"run": NEW, "combo": COMBO})
    assert r["data"]["grid"][0][0] == {"value": None, "failed": True, "missing": False}
    assert r["data"]["grid"][0][1]["value"] is not None


def test_replicates_with_one_replicate_dimension_has_one_column(project):
    r = compute(project, "replicates", run=run_folder(RUNS[0]), combo={"forecaster": "ets"})
    assert r["data"]["col_key"] is None and r["data"]["cols"] == [""] and len(r["data"]["rows"]) == 3


def test_replicates_without_replicates(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = get_run(Project.load(root), run_folder(RUNS[8]))
    meta = run.path / "meta.json"
    import json

    m = json.loads(meta.read_text())
    m["replicates"] = []
    meta.write_text(json.dumps(m))
    import yaml

    cfg = yaml.safe_load((run.path / "config.yaml").read_text())
    cfg["replicates"] = {}
    (run.path / "config.yaml").write_text(yaml.safe_dump(cfg))
    r = widgets.compute(Project.load(root), "replicates", {"run": run.id, "combo": {}})
    assert r["unavailable"] == "Dieser Lauf hat keine Wiederholungen"


# --- Config --------------------------------------------------------------------------------------
def test_config_widget_title_counts_grid_axes_and_base_differences(project):
    r = compute(project, "config", combo={"forecaster": "ets", "lstm_layer": "1"})
    assert r["title"] == "Config: 2 Achsen im Grid, 2 Abweichungen von base"
    assert r["data"]["view"] == "blocks"
    assert compute(project, "config", view="yaml")["data"]["view"] == "yaml"


# --- API -----------------------------------------------------------------------------------------
@pytest.fixture(scope="module")
def client(demo_project):
    return TestClient(create_app(demo_project))


def test_api_catalog_and_widget(client):
    assert {w["key"] for w in client.get("/api/widgets/catalog").json()} >= {"curves", "forecast"}
    r = client.post("/api/widgets/curves", json={"run": NEW, "combo": COMBO})
    assert r.status_code == 200 and r.json()["data"]["best_epoch"] > 0


def test_api_unknown_widget_and_run(client):
    assert client.post("/api/widgets/nope", json={}).status_code == 404
    assert client.post("/api/widgets/curves", json={"run": "2020-01-01_000000_gone"}).status_code == 404


def test_unknown_settings_are_ignored_and_defaults_applied(project):
    r = compute(project, "curves", mode="nonsense-key", other=1)
    assert r["data"]["mode"] == "nonsense-key"  # a known key is passed through
    r = widgets.compute(project, "curves", {"run": NEW, "combo": COMBO, "settings": {"bogus": 1}})
    assert r["data"]["mode"] == "single"


def test_every_catalog_entry_has_a_width_the_comparison_table_is_full_all_others_half():
    from mlviz.widgets.registry import catalog

    entries = [w for scope in ("combination", "run", "two-runs", "project") for w in catalog(scope)]
    assert {w["width"] for w in entries} == {"half", "full"}
    assert {w["key"] for w in entries if w["width"] == "full"} == {"compare-table"}
