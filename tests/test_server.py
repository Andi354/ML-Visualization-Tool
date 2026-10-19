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
    assert client.get("/api/runs/2020-01-01_000000_gone").status_code == 404


def test_run_id_cannot_leave_runs_folder(client):
    assert client.get("/api/runs/..%2F..%2Fproject.yaml").status_code == 404


def test_runs_endpoint_carries_listing_facts(client):
    by = {r["id"]: r for r in client.get("/api/runs").json()}
    r = by[run_folder(RUNS[5])]
    assert r["cells"] == 30 and r["best"]["metric"] == "test_mape" and r["merkmal"]["value"] == "90"


def test_issues_endpoint_without_key(client, monkeypatch):
    monkeypatch.delenv("LINEAR_API_KEY", raising=False)
    issues = client.get("/api/issues").json()
    assert set(issues) >= {"TIM-52", "TIM-45", "TIM-83"}
    assert "title" not in issues["TIM-52"]
    assert client.get("/api/project").json()["linear"] is False


def test_unknown_api_path_is_404(client):
    assert client.get("/api/nope").status_code == 404


def test_dims_and_table_endpoints(client):
    rid = run_folder(RUNS[3])
    dims = client.get(f"/api/runs/{rid}/dims").json()
    assert dims["sections"][0] == "model"
    t = client.post(f"/api/runs/{rid}/table", json={"dims": {"forecaster": {"mode": "agg"}}}).json()
    assert t["groups"] == 1 and t["params"] == []


def test_table_of_a_deleted_run_is_404(client):
    assert client.post("/api/runs/2020-01-01_000000_gone/table", json={}).status_code == 404
    assert client.get("/api/runs/2020-01-01_000000_gone/dims").status_code == 404


def test_the_primary_metric_setting_beats_the_run_and_the_project(client):
    rid = run_folder(RUNS[3])
    metric = "test_mape"
    body = {"dims": {"forecaster": {"mode": "agg"}}}
    before = client.get(f"/api/runs/{rid}/dims").json()["primary_metric"]
    assert before != metric
    client.put("/api/settings", json={"set": {"runs.metric": metric}})
    try:
        assert client.get(f"/api/runs/{rid}/dims").json()["primary_metric"] == metric
        assert client.post(f"/api/runs/{rid}/table", json=body).json()["sort"]["metric"] == metric
        widget = client.post("/api/widgets/replicates", json={"scope": "combination", "run": rid, "settings": {}}).json()
        assert widget["data"]["metric"]["key"] == metric
    finally:
        client.put("/api/settings", json={"unset": ["runs.metric"]})
    assert client.get(f"/api/runs/{rid}/dims").json()["primary_metric"] == before
