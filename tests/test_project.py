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
