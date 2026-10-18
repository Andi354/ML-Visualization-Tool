"""Feature D (v0.3.0): progress, remaining time and events of running runs."""

from datetime import datetime, timedelta
from types import SimpleNamespace

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from mlviz import progress
from mlviz.fixture import make_project
from mlviz.progress import ProgressWatcher, run_progress
from mlviz.project import Project
from mlviz.runs import list_runs
from mlviz.server import create_app
from mlviz.settings import SettingsStore

T0 = datetime(2026, 10, 15, 11, 0)


class FakeRun:
    """What the progress code reads of a run."""

    def __init__(self, rid="r1", state="running", cells=0, planned=24, failed=0, step=60, start=T0, error="CUDA out of memory"):
        self.id, self.name, self.short, self.issue = rid, rid, None, "TIM-1"
        self.state, self.problem, self.planned_cells = state, None, planned
        self.started, self.ended = start, None
        rows = [{"finished_at": (start + timedelta(seconds=step * (i + 1))).isoformat(), "status": "error" if i < failed else "ok", "error": error if i < failed else None} for i in range(cells)]
        self.cells = pd.DataFrame(rows, columns=["finished_at", "status", "error"])
        self.done_cells = cells

    def error_count(self):
        return int((self.cells["status"] == "error").sum()) if len(self.cells) else 0


def test_numbers_of_a_running_run_from_the_demo_project(tmp_path):
    project = Project.load(make_project(tmp_path))
    run = next(r for r in list_runs(project) if r.state != "finished")
    p = run_progress(run, datetime(2026, 10, 15, 11, 7))
    assert (p["cells_done"], p["cells_planned"], p["cells_failed"]) == (9, 24, 0)
    assert p["rate_per_hour"] == 90.0 and p["remaining"] == "PT10M" and p["remaining_s"] == 600
    assert p["eta"] == "2026-10-15T11:17" and p["last_cell_at"] == "2026-10-15T11:06:00" and p["stalled_since"] is None


def test_a_run_without_a_new_cell_for_the_stall_time_is_stalled_and_has_no_remaining_time():
    run = FakeRun(cells=10)
    p = run_progress(run, T0 + timedelta(minutes=10 + 30, seconds=1), stall_min=30)
    assert p["state"] == "stalled" and p["stalled_since"] == (T0 + timedelta(minutes=40)).isoformat() and p["remaining"] is None
    assert run_progress(run, T0 + timedelta(minutes=39), stall_min=30)["state"] == "running"
    assert run_progress(run, T0 + timedelta(minutes=39), stall_min=10)["state"] == "stalled"  # the setting counts


def test_fewer_than_five_cells_give_no_remaining_time():
    p = run_progress(FakeRun(cells=4), T0 + timedelta(minutes=5))
    assert p["remaining"] is None and p["rate_per_hour"] == 60.0


def test_the_rate_uses_the_last_fifty_cells_within_two_hours():
    fast = FakeRun(cells=100, step=10, planned=500)  # 100 cells of 10 s, then the clock runs on
    p = run_progress(fast, T0 + timedelta(seconds=1000))
    assert p["rate_per_hour"] == 360.0  # one cell per 10 s
    old = run_progress(FakeRun(cells=10), T0 + timedelta(hours=3), stall_min=999)
    assert old["rate_per_hour"] is None  # all cells are older than two hours


def test_a_run_without_cells_counts_from_its_start():
    p = run_progress(FakeRun(cells=0), T0 + timedelta(minutes=45), stall_min=30)
    assert p["stalled_since"] == (T0 + timedelta(minutes=30)).isoformat() and p["cells_done"] == 0


# --- events ----------------------------------------------------------------------------------------
@pytest.fixture
def world(tmp_path, monkeypatch):
    """A watcher whose runs are the list `world.runs` and whose clock is `world.now`."""
    project = Project.load(make_project(tmp_path))
    w = SimpleNamespace(runs=[], now=T0 + timedelta(minutes=5))
    monkeypatch.setattr(progress, "list_runs", lambda p: w.runs)
    monkeypatch.setattr(progress, "group_best", lambda run, metric: 3.2)
    w.settings = SettingsStore(project)
    w.watcher = ProgressWatcher(project, w.settings, now=lambda: w.now)
    return w


def kinds(world, since=0):
    return [e["kind"] for e in world.watcher.snapshot(since)["events"]]


def test_runs_that_are_running_when_the_tool_starts_raise_nothing(world):
    world.runs = [FakeRun(cells=6)]
    world.watcher.poll()
    snap = world.watcher.snapshot()
    assert snap["events"] == [] and [r["id"] for r in snap["runs"]] == ["r1"]


def test_a_new_run_is_noted_but_a_finished_run_makes_one_event(world):
    world.watcher.poll()
    world.runs = [FakeRun(cells=6)]
    world.watcher.poll()
    assert kinds(world) == ["started"]
    done = FakeRun(cells=24, state="finished")
    done.ended = T0 + timedelta(minutes=24)
    world.runs = [done]
    world.watcher.poll()
    world.watcher.poll()
    events = world.watcher.snapshot()["events"]
    assert [e["kind"] for e in events] == ["started", "finished"]
    assert events[1]["cells"] == 24 and events[1]["duration_s"] == 24 * 60 and events[1]["failed"] == 0
    assert world.watcher.snapshot()["runs"] == []


def test_many_errors_are_raised_once_at_the_threshold_of_the_setting(world):
    world.watcher.poll()
    world.runs = [FakeRun(cells=20, failed=1)]  # 1 of 24 planned = 4.2 %
    world.watcher.poll()
    assert "errors" not in kinds(world)
    world.runs = [FakeRun(cells=20, failed=2)]  # 8.3 %
    world.watcher.poll()
    world.runs = [FakeRun(cells=22, failed=3)]
    world.watcher.poll()
    errors = [e for e in world.watcher.snapshot()["events"] if e["kind"] == "errors"]
    assert len(errors) == 1 and errors[0]["failed"] == 2 and errors[0]["message"] == "CUDA out of memory"
    world.settings.change({"runs.errWarn": 20})
    world.runs = [FakeRun(rid="r2", cells=20, failed=3)]  # 12.5 %: under the new threshold
    world.watcher.poll()
    assert len([e for e in world.watcher.snapshot()["events"] if e["kind"] == "errors"]) == 1


def test_a_stall_is_raised_once_until_a_new_cell_arrives(world):
    world.watcher.poll()
    world.runs = [FakeRun(cells=10)]
    world.now = T0 + timedelta(minutes=5)
    world.watcher.poll()
    world.now = T0 + timedelta(minutes=50)
    world.watcher.poll()
    world.watcher.poll()
    assert kinds(world).count("stalled") == 1
    world.runs = [FakeRun(cells=12)]
    world.now = T0 + timedelta(minutes=50)  # a cell finished at 11:12 in this fake: still stalled by the clock
    world.watcher.poll()
    assert kinds(world).count("stalled") == 1
    world.runs = [FakeRun(cells=12, step=240)]  # the last cell is recent again
    world.watcher.poll()
    world.now = T0 + timedelta(minutes=120)
    world.watcher.poll()
    assert kinds(world).count("stalled") == 2


def test_events_after_a_number_only(world):
    world.watcher.poll()
    world.runs = [FakeRun(cells=6)]
    world.watcher.poll()
    first = world.watcher.snapshot()["last_event"]
    world.runs = []
    world.watcher.poll()
    assert kinds(world, since=first) == []  # a run that vanished is not a finished one


def test_the_api_hands_out_runs_and_events(tmp_path):
    client = TestClient(create_app(make_project(tmp_path)))
    snap = client.get("/api/progress").json()
    assert snap["last_event"] == 0 and snap["events"] == []
    assert [r["name"] for r in snap["runs"]] == ["TIM-83_running_sweep"]
    assert snap["runs"][0]["cells_planned"] == 24


def test_the_agent_tool_reports_the_progress_of_a_run(tmp_path):
    from mlviz import agent_tools

    project = Project.load(make_project(tmp_path))
    out = agent_tools.run_tool(project, "run_progress", {"run": "running_sweep"})
    assert out["cells_done"] == 9 and out["cells_planned"] == 24 and out["state"] == "stalled"  # the clock of the tests is 12:00
    assert out["stalled_since"] == "2026-10-15T11:36:00" and out["remaining"] is None
    with pytest.raises(ValueError):
        agent_tools.run_tool(project, "run_progress", {"run": "gibt-es-nicht"})


def test_the_summary_comes_from_the_agent_on_a_click(tmp_path):
    client = TestClient(create_app(make_project(tmp_path)))
    r = client.post("/api/progress/summary", json={"run": "2026-10-09_0845_TIM-52_best_90"})
    # the stand-in repeats the last line of the prompt, which holds the facts, here with the previous run of the issue
    assert r.status_code == 200 and '"previous_run"' in r.json()["text"] and '"cells": 30' in r.json()["text"]
    assert client.post("/api/progress/summary", json={"run": "nope"}).status_code == 404
