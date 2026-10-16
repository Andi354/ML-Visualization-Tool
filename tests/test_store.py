"""Runs are read through `ds-store`: the tables of the run format, state and progress, errors."""

import json
import shutil
import sys

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from mlviz import fixture, store
from mlviz.project import Project
from mlviz.runs import get_run, list_runs
from mlviz.server import create_app

EXAMPLE = fixture.run_folder(next(r for r in fixture.RUNS if r.get("extras")))
RUNNING = fixture.run_folder(next(r for r in fixture.RUNS if r.get("running")))
FINISHED = fixture.run_folder(fixture.RUNS[3])


@pytest.fixture
def project(demo_project):
    return Project.load(demo_project)


# --- format -----------------------------------------------------------------------------------
def test_curves_are_one_flat_table(project):
    curves = get_run(project, EXAMPLE).table("curves")
    assert list(curves.columns) == ["cell_id", "epoch", "metric", "value"]
    assert set(curves["metric"]) == {"train_loss", "val_loss"}


def test_predictions_are_one_flat_table_without_replicate_columns(project):
    preds = get_run(project, EXAMPLE).table("predictions")
    assert list(preds.columns) == ["cell_id", "date", "channel", "y_pred", "y_true"]
    with_cells = get_run(project, EXAMPLE).table("predictions", with_cells=True)
    assert {"shuffle_seed", "cv_fold"} <= set(with_cells.columns)  # per cell_id from cells


def test_cells_and_plan_have_the_columns_of_the_format(project):
    run = get_run(project, FINISHED)
    assert {"row", "cell_id", "duplicate_of", "is_duplicate", "status", "duration_s", "finished_at", "shard"} <= set(run.cells.columns)
    assert list(run.plan.columns)[:3] == ["row", "cell_id", "duplicate_of"]
    assert len(run.cells.iloc[0]["cell_id"]) == 16


def test_meta_names_of_the_format(project):
    run = get_run(project, FINISHED)
    assert run.name == "TIM-52_best_30" and run.started.isoformat() == "2026-10-06T10:00:00"
    assert run.ended is not None


def test_run_folder_name_without_seconds(project):
    assert FINISHED == "2026-10-06_1000_TIM-52_best_30"


# --- state and progress -----------------------------------------------------------------------
def test_state_and_progress_come_from_the_store(project):
    running, finished = get_run(project, RUNNING), get_run(project, FINISHED)
    assert finished.state == "finished" and not finished.running
    assert running.state == "running" and running.running
    assert 0 < running.done_cells < running.planned_cells == 24


def test_a_run_without_end_and_old_files_is_stalled(tmp_path):
    root = fixture.make_project(tmp_path)
    run_dir = root / "runs" / RUNNING
    old = 946684800  # 2000-01-01
    import os

    for f in run_dir.rglob("*"):
        os.utime(f, (old, old))
    os.utime(run_dir, (old, old))
    assert get_run(Project.load(root), RUNNING).state == "stalled"


def test_run_list_carries_the_state(project, demo_project):
    rows = {r["id"]: r for r in TestClient(create_app(demo_project)).get("/api/runs").json()}
    assert rows[RUNNING]["state"] == "running" and rows[RUNNING]["running"]
    assert rows[FINISHED]["state"] == "finished"
    assert rows[RUNNING]["cells"] < rows[RUNNING]["planned"]


def test_listed_status_is_used_for_the_run_list(project):
    runs = {r.id: r for r in list_runs(project)}
    assert runs[RUNNING].listed["state"] == "running"


# --- duplicates, parts, versions --------------------------------------------------------------
def test_duplicates_count_as_planned_cells_and_share_curves(tmp_path):
    r = {**next(x for x in fixture.RUNS if x.get("extras")), "duplicates": 2}
    root = tmp_path / "p"
    (root / "runs").mkdir(parents=True)
    fixture._write_run(root, r)
    run = get_run(Project.load(root), fixture.run_folder(r))
    cells = run.cells
    assert len(cells) == run.planned_cells and cells["is_duplicate"].sum() == 2
    dup = cells[cells["is_duplicate"]].iloc[0]
    orig = cells[cells["row"] == dup["duplicate_of"]].iloc[0]
    assert dup["cell_id"] == orig["cell_id"] and dup["test_mse_missing"] == orig["test_mse_missing"]
    curves = run.table("curves")
    assert curves["cell_id"].nunique() == cells["cell_id"].nunique()


def test_new_part_files_of_a_running_experiment_show_up(tmp_path):
    root = fixture.make_project(tmp_path)
    run_dir = root / "runs" / RUNNING
    before = get_run(Project.load(root), RUNNING).done_cells
    cells = pd.read_parquet(run_dir / "cells.parquet")
    extra = cells.iloc[:1].copy()
    extra["row"] = int(cells["row"].max()) + 1
    extra["finished_at"] = "2026-10-15T12:30:00"
    (run_dir / "cells").mkdir()
    extra.to_parquet(run_dir / "cells" / "part-0-1.parquet", index=False)
    assert get_run(Project.load(root), RUNNING).done_cells == before + 1


def test_a_store_version_the_package_does_not_know_is_reported(tmp_path):
    root = fixture.make_project(tmp_path)
    meta_path = root / "runs" / FINISHED / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta["store_version"] = 99
    meta_path.write_text(json.dumps(meta))
    client = TestClient(create_app(root))
    r = client.get("/api/runs")
    assert r.status_code == 409 and r.json()["store_error"] and "99" in r.json()["detail"]


def test_without_the_package_the_tool_says_so(tmp_path, monkeypatch):
    root = fixture.make_project(tmp_path)
    monkeypatch.setitem(sys.modules, "ds_store", None)  # `import ds_store` raises ImportError
    store._read_table.cache_clear()
    store._run_status.cache_clear()
    r = TestClient(create_app(root)).get("/api/runs")
    assert r.status_code == 409 and "ds-store" in r.json()["detail"]


def test_a_missing_table_is_none_not_an_error(project):
    assert get_run(project, FINISHED).table("predictions") is None
    assert not get_run(project, FINISHED).has_predictions
