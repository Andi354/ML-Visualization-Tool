"""Descriptions of runs (v0.2.1): `short` in the run list (G), `read_description` through `ds-store` (H)."""

import pytest
from fastapi.testclient import TestClient

from mlviz import fixture, store
from mlviz.project import Project
from mlviz.runs import get_run, list_runs
from mlviz.server import create_app

BEST_90 = fixture.run_folder(next(r for r in fixture.RUNS if r["experiment"] == "TIM-52_best_90"))
LONG = fixture.run_folder(next(r for r in fixture.RUNS if r.get("extras")))
PLAIN = fixture.run_folder(fixture.RUNS[0])


@pytest.fixture
def project(demo_project):
    return Project.load(demo_project)


@pytest.fixture
def client(demo_project):
    return TestClient(create_app(demo_project))


# --- G: short ---------------------------------------------------------------------------------
def test_a_run_with_a_description_lists_its_short(project):
    run = get_run(project, BEST_90)
    listed = {r.id: r for r in list_runs(project)}[BEST_90]
    assert listed.short == "Bestes Setup aus dem Grid mit Horizont 90 gegen die Baselines"
    assert listed.has_description and run is not None


def test_a_run_without_a_description_has_no_short(client):
    row = next(r for r in client.get("/api/runs").json() if r["id"] == PLAIN)
    assert row["short"] is None and row["has_description"] is False


def test_the_runs_api_carries_short_and_has_description(client):
    row = next(r for r in client.get("/api/runs").json() if r["id"] == BEST_90)
    assert row["short"].startswith("Bestes Setup") and row["has_description"] is True


def test_a_short_over_100_characters_is_cut_with_an_ellipsis(client):
    row = next(r for r in client.get("/api/runs").json() if r["id"] == LONG)
    assert len(row["short"]) == 101 and row["short"].endswith("…")


def test_cut_short_keeps_one_line_and_drops_empty_text():
    assert store.cut_short("a\nb  c") == "a b c"
    assert store.cut_short("   ") is None and store.cut_short(None) is None
    assert store.cut_short("x" * 100) == "x" * 100


def test_an_empty_short_counts_as_no_description_line(project, monkeypatch):
    run = next(r for r in list_runs(project) if r.id == BEST_90)
    run.listed = {**run.listed, "short": "", "has": {"description": True}}
    assert run.short is None and run.has_description is True


def test_a_ds_store_without_the_description_functions_means_no_description(project, monkeypatch):
    import ds_store

    monkeypatch.delattr(ds_store, "read_description")
    assert store.read_description(project.path("runs") / BEST_90) is None
