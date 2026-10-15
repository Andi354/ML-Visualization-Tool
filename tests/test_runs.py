import pytest

from mlviz.fixture import CHANNELS, RUNS, run_folder
from mlviz.project import Project
from mlviz.runs import get_run, issue_of, list_runs, strip_timestamp


@pytest.fixture(scope="module")
def project(demo_project):
    return Project.load(demo_project)


@pytest.mark.parametrize(
    "folder,name",
    [
        ("2026-09-25_164000_TIM-45_g6_combined", "TIM-45_g6_combined"),
        ("2026-09-25_1640_TIM-45_g6_combined", "TIM-45_g6_combined"),
        ("TIM-45_g6_combined_20260925-164000", "TIM-45_g6_combined"),
        ("TIM-45_g6_combined_20260925_164000", "TIM-45_g6_combined"),
        ("no_timestamp", "no_timestamp"),
    ],
)
def test_timestamp_is_stripped_from_folder_name(folder, name):
    assert strip_timestamp(folder) == name


@pytest.mark.parametrize(
    "folder,iso",
    [
        ("2026-09-25_164012_x", "2026-09-25T16:40:12"),
        ("2026-09-25_1640_x", "2026-09-25T16:40:00"),
        ("x_20260925-164012", "2026-09-25T16:40:12"),
    ],
)
def test_start_time_falls_back_to_the_folder_name(tmp_path, folder, iso):
    from mlviz.runs import Run

    (tmp_path / folder).mkdir()
    assert Run(tmp_path / folder).started.isoformat() == iso


def test_issue_is_the_config_name_prefix():
    assert issue_of("TIM-52_best_30") == "TIM-52"
    assert issue_of("sweep_check") is None


def test_runs_are_listed_newest_first(project):
    runs = list_runs(project)
    assert len(runs) == len(RUNS)
    starts = [r.started for r in runs]
    assert starts == sorted(starts, reverse=True)
    assert runs[0].name == "TIM-83_running_sweep"


def test_folder_without_meta_is_ignored(project, tmp_path):
    (project.path("runs") / "not-a-run").mkdir()
    try:
        assert all(r.id != "not-a-run" for r in list_runs(project))
    finally:
        (project.path("runs") / "not-a-run").rmdir()


def test_run_reads_axes_replicates_and_counts(project):
    run = get_run(project, run_folder(next(r for r in RUNS if r["experiment"] == "TIM-45_g6_combined")))
    assert run.axes == ["lr_epochs", "lstm_layer", "time_embedding"]
    assert run.replicates == ["shuffle_seed"]
    assert run.planned_cells == 36 == len(run.cells)
    assert run.migrated and not run.running
    assert set(run.channels["channel"]) == set(CHANNELS)


def test_paired_axis_is_one_column_with_label(project):
    run = get_run(project, run_folder(next(r for r in RUNS if r["experiment"] == "TIM-45_g6_combined")))
    assert "learning_rate" not in run.cells.columns
    assert "learning_rate=0.0005, max_epochs=20" in set(run.cells["lr_epochs"])


def test_running_run_has_fewer_cells_than_planned(project):
    run = list_runs(project)[0]
    assert run.running
    assert 0 < len(run.cells) < run.planned_cells


def test_failed_cells_are_counted(project):
    run = get_run(project, run_folder(next(r for r in RUNS if r["experiment"] == "TIM-39_grid_multivariate_30")))
    assert run.error_count() > 0
    assert len(run.ok_cells()) == len(run.cells) - run.error_count()
    assert run.cells.loc[run.cells["status"] == "error", "test_mse_missing"].isna().all()


def test_curves_and_predictions_only_in_the_new_run(project):
    flags = {r.name: (r.has_curves, r.has_predictions) for r in list_runs(project)}
    assert flags["TIM-71_example"] == (True, True)
    assert flags["TIM-52_best_30"] == (False, False)


@pytest.mark.parametrize("bad", ["", "..", ".", "../x", "a/b", "a\\b", "does-not-exist"])
def test_unknown_or_escaping_run_ids_are_rejected(project, bad):
    assert get_run(project, bad) is None


def test_run_reads_resolved_config(project):
    run = list_runs(project)[0]
    cfg = run.config
    assert cfg["data"]["pred_len"] == 30
    assert list(cfg["sweep"]) == run.axes
