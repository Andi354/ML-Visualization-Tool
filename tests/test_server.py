import pytest
from fastapi.testclient import TestClient

from mlviz.fixture import RUNS, run_folder
from mlviz.server import create_app


@pytest.fixture(scope="module")
def client(demo_project):
    return TestClient(create_app(demo_project))


def test_project_endpoint(client):
    j = client.get("/api/project").json()
    assert j["short"] == "DB" and j["name"] == "Demo Bench"
    assert j["now"] == "2026-10-15T12:00:00"


def test_runs_endpoint_lists_all_runs_newest_first(client):
    runs = client.get("/api/runs").json()
    assert len(runs) == len(RUNS)
    assert runs[0]["running"] is True


def test_run_endpoint_and_404_for_deleted_run(client):
    ok = client.get(f"/api/runs/{run_folder(RUNS[0])}")
    assert ok.status_code == 200 and ok.json()["migrated"] is True
    assert client.get("/api/runs/gone_20200101-000000").status_code == 404


def test_run_id_cannot_leave_runs_folder(client):
    assert client.get("/api/runs/..%2F..%2Fproject.yaml").status_code == 404
