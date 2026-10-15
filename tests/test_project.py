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
