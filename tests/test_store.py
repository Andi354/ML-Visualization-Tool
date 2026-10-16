"""Runs are read through `ds-store`: the tables of the run format, state and progress, errors."""

import json
import shutil
import sys

import ds_store
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from mlviz import fixture
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
    before = get_run(Project.load(root), RUNNING).done_cells
    run_dir = root / "runs" / RUNNING
    assert (run_dir / "cells").is_dir() and not (run_dir / "cells.parquet").exists()  # still parts
    cells = get_run(Project.load(root), RUNNING).cells
    extra = cells.iloc[:1].copy()
    extra["row"] = int(cells["row"].max()) + 1
    extra["finished_at"] = "2026-10-15T12:30:00"
    ds_store.write_part(run_dir, "cells", 0, extra)
    assert get_run(Project.load(root), RUNNING).done_cells == before + 1


def test_a_run_the_package_cannot_read_is_listed_with_the_reason(tmp_path):
    root = fixture.make_project(tmp_path)
    meta_path = root / "runs" / FINISHED / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta["store_version"] = 99
    meta_path.write_text(json.dumps(meta))
    client = TestClient(create_app(root))
    rows = {r["id"]: r for r in client.get("/api/runs").json()}
    assert rows[FINISHED]["state"] == "unsupported" and "99" in rows[FINISHED]["problem"]
    assert rows[FINISHED]["best"] is None and rows[FINISHED]["cells"] == 0
    assert rows[EXAMPLE]["state"] == "finished" and rows[EXAMPLE]["problem"] is None  # the others stay
    r = client.get(f"/api/runs/{FINISHED}/dims")  # its tables cannot be read
    assert r.status_code == 409 and "99" in r.json()["detail"]
    # the project widgets leave it out instead of failing
    w = client.post("/api/widgets/project-best", json={})
    assert w.status_code == 200


def test_without_the_package_the_tool_says_so(tmp_path, monkeypatch):
    root = fixture.make_project(tmp_path)
    monkeypatch.setitem(sys.modules, "ds_store", None)  # `import ds_store` raises ImportError
    r = TestClient(create_app(root)).get("/api/runs")
    assert r.status_code == 409 and "ds-store" in r.json()["detail"]


def test_the_example_run_of_the_package_is_readable(tmp_path):
    root = tmp_path / "p"
    run_dir = ds_store.write_example_run(root / "runs" / "2026-01-01_1000_example")
    project = Project.load(root)
    run = get_run(project, run_dir.name)
    assert run.name == "example" and run.state == "finished" and run.planned_cells == 8
    assert run.done_cells == 8 and run.error_count() == 1
    assert run.has_curves and run.has_predictions
    client = TestClient(create_app(root))
    row = client.get("/api/runs").json()[0]
    assert row["cells"] == 8 and row["errors"] == 1 and row["has_curves"]
    assert client.get(f"/api/runs/{run_dir.name}/dims").status_code == 200
    t = client.post(f"/api/runs/{run_dir.name}/table", json={}).json()
    assert t["rows"]


def test_the_example_run_while_it_is_going_has_its_parts_read(tmp_path):
    root = tmp_path / "p"
    run_dir = ds_store.write_example_run(root / "runs" / "2026-01-01_1000_example", finished=False, compacted=False)
    run = get_run(Project.load(root), run_dir.name)
    assert run.running and run.done_cells == 8


def test_channels_of_duplicates_are_joined_by_row(tmp_path):
    r = {**next(x for x in fixture.RUNS if x.get("extras")), "duplicates": 2}
    root = tmp_path / "p"
    (root / "runs").mkdir(parents=True)
    fixture._write_run(root, r)
    project = Project.load(root)
    run = get_run(project, fixture.run_folder(r))
    from mlviz import aggregate

    q = {"dims": {"channel": {"mode": "split", "sel": []}}}
    t = aggregate.run_table(run, project, q)
    n_ok = int((run.cells["status"] == "ok").sum())
    per_channel = {}
    for row in t["rows"]:
        per_channel.setdefault(row["params"]["channel"], 0)
        per_channel[row["params"]["channel"]] += row["n"]
    assert set(per_channel.values()) == {n_ok}  # every cell once per channel, copies included


def test_a_missing_table_is_none_not_an_error(project):
    assert get_run(project, FINISHED).table("predictions") is None
    assert not get_run(project, FINISHED).has_predictions


def test_derived_cells_with_empty_axis_values_are_grouped_as_their_own_value(tmp_path):
    """Hybrid cells carry `ensemble_*` axes that are empty on all other cells (TIM-74)."""
    root = tmp_path / "p"
    run_dir = root / "runs" / "2026-10-09_1842_ensemble"
    run_dir.mkdir(parents=True)
    rows = [
        (0, "a0", "repnet", None, None, 0.30),
        (1, "a1", "repnet", None, None, 0.32),
        (2, "h0", "hybrid", "repnet", 0.3, 0.25),
        (3, "h1", "hybrid", "repnet", 0.6, 0.27),
    ]
    cells = pd.DataFrame(
        [
            {
                "row": r, "cell_id": cid, "forecaster": f, "ensemble_base": base, "ensemble_weight": w, "seed": 1,
                "is_duplicate": False, "duplicate_of": None, "status": "ok", "duration_s": 1.0,
                "finished_at": "2026-10-09T18:42:00", "shard": 0, "test_mape": mape,
            }
            for r, cid, f, base, w, mape in rows
        ]
    )
    ds_store.write_plan(run_dir, cells[["row", "cell_id", "duplicate_of", "forecaster", "ensemble_base", "ensemble_weight", "seed"]].assign(derived_from=[None, None, 0, 1]))
    ds_store.write_part(run_dir, "cells", 0, cells)
    (run_dir / "meta.json").write_text(
        json.dumps(
            {
                "name": "ensemble", "store_version": 1, "started_at": "2026-10-09T18:42:00", "ended_at": "2026-10-09T19:00:00",
                "axes": ["forecaster", "ensemble_base", "ensemble_weight"], "replicates": ["seed"],
                "plan": {"cells": 4, "excluded": 0, "duplicates": 0},
            }
        )
    )
    (run_dir / "config.yaml").write_text("sweep: {forecaster: [repnet, hybrid]}\nreplicates: {seed: [1]}\n")
    from mlviz import aggregate

    project = Project.load(root)
    run = get_run(project, run_dir.name)
    t = aggregate.run_table(run, project, {"dims": {"forecaster": {"mode": "split", "sel": []}, "ensemble_weight": {"mode": "split", "sel": []}}})
    assert sorted(r["params"]["ensemble_weight"] for r in t["rows"]) == ["", "0.3", "0.6"]
    assert {r["params"]["forecaster"] for r in t["rows"]} == {"repnet", "hybrid"}
