import pytest

from mlviz.project import Project, now


def test_loads_name_short_and_metric_catalog(demo_project):
    p = Project.load(demo_project)
    assert p.name == "Demo Bench"
    assert p.short == "DB"
    assert len(p.metrics) == 10
    assert p.primary_metric == "test_mse_missing"
    assert p.first_real_metric().key == "test_mape"
    assert p.epoch_names() == ["tsrm6", "eval-all-windows"]


def test_short_falls_back_to_two_letters_of_folder_name(tmp_path):
    d = tmp_path / "repnet-bench"
    d.mkdir()
    p = Project.load(d)
    assert p.name == "repnet-bench"
    assert p.short == "RE"
    assert p.metrics == []
    assert p.primary_metric is None
    assert p.path("runs") == d.resolve() / "runs"


def test_broken_yaml_is_ignored(tmp_path):
    (tmp_path / "project.yaml").write_text("name: [unclosed")
    assert Project.load(tmp_path).name == tmp_path.name


def test_clock_can_be_fixed(monkeypatch):
    monkeypatch.setenv("MLVIZ_NOW", "2026-01-02T03:04:05")
    assert now().isoformat() == "2026-01-02T03:04:05"


def test_to_json_has_what_the_frame_needs(demo_project):
    j = Project.load(demo_project).to_json()
    assert {"name", "short", "now", "metrics", "epochs", "primary_metric"} <= j.keys()


def test_folders_come_from_paths_and_outputs(tmp_path):
    (tmp_path / "project.yaml").write_text(
        "paths: {runs: results/runs, configs: cfg}\n"
        "outputs: {analysis: out/analysis, research: out/research, deliverables: out/deliverables}\n"
    )
    p = Project.load(tmp_path)
    assert p.path("runs") == tmp_path.resolve() / "results" / "runs"
    assert p.path("configs") == tmp_path.resolve() / "cfg"
    assert p.path("analysis") == tmp_path.resolve() / "out" / "analysis"
    assert p.path("research") == tmp_path.resolve() / "out" / "research"
    assert p.path("deliverables") == tmp_path.resolve() / "out" / "deliverables"


def test_reports_are_derived_from_the_outputs(tmp_path):
    (tmp_path / "project.yaml").write_text("outputs: {analysis: out/analysis}\n")
    assert Project.load(tmp_path).path("reports") == tmp_path.resolve() / "out" / "analysis"


def test_defaults_without_paths_and_outputs(tmp_path):
    p = Project.load(tmp_path)
    assert {k: p.paths[k] for k in ("runs", "configs", "analysis", "research", "deliverables")} == {
        "runs": "runs", "configs": "configs", "analysis": "analysis", "research": "research", "deliverables": "deliverables"
    }


def test_the_earlier_flat_paths_still_read(tmp_path):
    (tmp_path / "project.yaml").write_text("paths: {runs: r, analyses: a, deliverables: d, reports: rep}\n")
    p = Project.load(tmp_path)
    assert (p.paths["runs"], p.paths["analysis"], p.paths["deliverables"], p.paths["reports"]) == ("r", "a", "d", "rep")


def test_metric_label_unit_and_scale_are_optional(tmp_path):
    (tmp_path / "project.yaml").write_text(
        "metrics:\n  - {key: test_mape, label: MAPE, unit: '%', scale: 100}\n  - {key: test_mae}\n"
    )
    mape, mae = Project.load(tmp_path).metrics
    assert (mape.label, mape.unit, mape.scale) == ("MAPE", "%", 100.0)
    assert (mae.label, mae.unit, mae.scale, mae.family) == ("test_mae", "", 1.0, "real")


def test_family_short_and_own_model_come_from_the_viz_namespace(tmp_path):
    (tmp_path / "project.yaml").write_text(
        "name: Bench\n"
        "viz: {short: bn, own_model: {axis: forecaster, value: rep-net}}\n"
        "metrics:\n  - {key: test_mse_missing, viz: {family: scaled}}\n"
    )
    p = Project.load(tmp_path)
    assert p.short == "BN" and p.own_model == {"axis": "forecaster", "value": "rep-net"}
    assert p.metrics[0].family == "scaled"


def test_family_short_and_own_model_in_the_earlier_top_level_form_still_read(tmp_path):
    (tmp_path / "project.yaml").write_text(
        "short: xy\nown_model: {axis: m, value: v}\nmetrics:\n  - {key: k, family: scaled}\n"
    )
    p = Project.load(tmp_path)
    assert p.short == "XY" and p.own_model == {"axis": "m", "value": "v"} and p.metrics[0].family == "scaled"


# --- metrics: primary + catalog and epochs.yaml as a list (the form of ds-init / repnet-bench) -------
REPNET_PROJECT = """\
name: repnet-bench
metrics:
  primary: test_mse_missing
  catalog:
    test_mse_missing: {direction: min, viz: {family: scaled}}
    test_mape: {direction: min, viz: {family: real}, label: MAPE, unit: "%", scale: 100}
    test_mae: {direction: min, viz: {family: real}}
    test_score: {direction: max}
"""
REPNET_EPOCHS = """\
- {name: tsrm6, repo: REP-Net, commit: a1b2c3d, date: 2026-09-01, reason: TSRM v6 encoder}
- {name: eval-all-windows, repo: REP-Net, commit: e4f5a6b, date: 2026-10-05, reason: evaluation over all windows}
"""


def test_metrics_as_primary_and_catalog(tmp_path):
    (tmp_path / "project.yaml").write_text(REPNET_PROJECT)
    p = Project.load(tmp_path)
    assert [m.key for m in p.metrics] == ["test_mse_missing", "test_mape", "test_mae", "test_score"]
    assert p.primary_metric == "test_mse_missing"
    mse, mape, mae, score = p.metrics
    assert (mse.family, mse.direction, mse.label) == ("scaled", "min", "test_mse_missing")  # label optional
    assert (mape.family, mape.label, mape.unit, mape.scale) == ("real", "MAPE", "%", 100.0)
    assert score.direction == "max" and score.family == "real"  # family defaults to real
    assert p.first_real_metric().key == "test_mape"
    assert p.warnings == []


def test_the_primary_metric_comes_from_primary_not_from_the_order(tmp_path):
    (tmp_path / "project.yaml").write_text(REPNET_PROJECT.replace("primary: test_mse_missing", "primary: test_mae"))
    assert Project.load(tmp_path).primary_metric == "test_mae"


def test_a_primary_metric_outside_the_catalog_is_a_warning(tmp_path):
    (tmp_path / "project.yaml").write_text(REPNET_PROJECT.replace("primary: test_mse_missing", "primary: nope"))
    p = Project.load(tmp_path)
    assert any("nope" in w for w in p.warnings)


def test_the_earlier_metric_list_still_reads(tmp_path):
    (tmp_path / "project.yaml").write_text("primary_metric: b\nmetrics:\n  - {key: a}\n  - {key: b, direction: max}\n")
    p = Project.load(tmp_path)
    assert [m.key for m in p.metrics] == ["a", "b"] and p.primary_metric == "b" and p.warnings == []


def test_metrics_in_no_known_form_are_a_warning_not_silence(tmp_path, caplog):
    (tmp_path / "project.yaml").write_text("metrics: just a text\n")
    with caplog.at_level("WARNING"):
        p = Project.load(tmp_path)
    assert p.metrics == [] and any("metrics" in w for w in p.warnings)
    assert "metrics" in caplog.text


def test_a_catalog_entry_that_is_not_a_mapping_is_skipped_with_a_warning(tmp_path):
    (tmp_path / "project.yaml").write_text("metrics:\n  primary: a\n  catalog:\n    a: {direction: min}\n    b: 5\n")
    p = Project.load(tmp_path)
    assert [m.key for m in p.metrics] == ["a"] and any("'b'" in w for w in p.warnings)


def test_epochs_as_a_list_at_the_top_level(tmp_path):
    (tmp_path / "epochs.yaml").write_text(REPNET_EPOCHS)
    p = Project.load(tmp_path)
    assert p.epoch_names() == ["tsrm6", "eval-all-windows"]
    last = p.epochs[-1]
    assert (last["since"], last["description"]) == ("2026-10-05", "evaluation over all windows")
    assert (last["repo"], last["commit"]) == ("REP-Net", "e4f5a6b")
    assert p.warnings == []


def test_epochs_in_the_earlier_form_still_read(tmp_path):
    (tmp_path / "epochs.yaml").write_text("epochs:\n  - {name: e1, since: '2026-09-01', description: first}\n")
    p = Project.load(tmp_path)
    assert p.epoch_names() == ["e1"] and p.epochs[0]["since"] == "2026-09-01" and p.warnings == []


def test_epochs_in_no_known_form_or_without_a_name_are_warnings(tmp_path):
    (tmp_path / "epochs.yaml").write_text("some: thing\n")
    p = Project.load(tmp_path)
    assert p.epochs == [] and any("epochs.yaml" in w for w in p.warnings)
    (tmp_path / "epochs.yaml").write_text("- {name: ok, date: 2026-01-01}\n- {date: 2026-02-01}\n")
    p = Project.load(tmp_path)
    assert p.epoch_names() == ["ok"] and any("ohne name" in w for w in p.warnings)


def test_files_that_cannot_be_parsed_are_warnings(tmp_path):
    (tmp_path / "project.yaml").write_text("name: [unclosed")
    (tmp_path / "epochs.yaml").write_text("- {name: [unclosed")
    p = Project.load(tmp_path)
    assert {w.split(" ")[0] for w in p.warnings} == {"project.yaml", "epochs.yaml"}


def test_missing_files_are_not_a_warning(tmp_path):
    assert Project.load(tmp_path).warnings == []


def test_the_demo_project_has_the_form_of_ds_init_and_no_warnings(demo_project):
    p = Project.load(demo_project)
    assert p.warnings == [] and len(p.metrics) == 10 and p.primary_metric == "test_mse_missing"
    assert "catalog" in (demo_project / "project.yaml").read_text()
    assert (demo_project / "epochs.yaml").read_text().lstrip().startswith("- ")


def test_the_api_carries_metrics_primary_epochs_and_warnings(tmp_path):
    from fastapi.testclient import TestClient

    from mlviz.server import create_app

    (tmp_path / "project.yaml").write_text(REPNET_PROJECT)
    (tmp_path / "epochs.yaml").write_text("some: thing\n")
    j = TestClient(create_app(tmp_path)).get("/api/project").json()
    assert [m["key"] for m in j["metrics"]][:2] == ["test_mse_missing", "test_mape"]
    assert j["primary_metric"] == "test_mse_missing" and j["epochs"] == []
    assert len(j["warnings"]) == 1 and "epochs.yaml" in j["warnings"][0]
