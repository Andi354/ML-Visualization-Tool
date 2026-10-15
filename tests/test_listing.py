import httpx
import pytest

from mlviz import linear
from mlviz.fixture import RUNS, run_folder
from mlviz.listing import flat_config, group_best, merkmal_candidates, run_listing
from mlviz.project import Project
from mlviz.runs import get_run, list_runs


@pytest.fixture(scope="module")
def project(demo_project):
    return Project.load(demo_project)


def run_of(project, experiment, nth=0):
    folders = [run_folder(r) for r in RUNS if r["experiment"] == experiment]
    return get_run(project, folders[nth])


def test_lauf_merkmal_is_found_by_comparing_configs(project):
    # data.pred_len differs between runs (30/90); everything else is constant or swept
    assert merkmal_candidates(list_runs(project)) == ["data.pred_len"]


def test_swept_keys_are_not_constant_entries(project):
    flat = flat_config(run_of(project, "TIM-52_best_30"))
    assert "model.forecaster" not in flat
    assert flat["data.pred_len"] == "30"
    assert "model.lstm_layer" in flat


def test_single_valued_entries_are_no_candidates(project):
    one = [run_of(project, "TIM-52_best_30")]
    assert merkmal_candidates(one) == []


def test_best_is_the_lowest_group_mean_over_replicates(project):
    run = run_of(project, "TIM-52_best_30", 1)
    metric = project.first_real_metric()
    ok = run.ok_cells()
    expected = ok.groupby(run.axes)[metric.key].mean().min()
    assert group_best(run, metric) == pytest.approx(expected)
    # not the best single cell
    assert group_best(run, metric) > ok[metric.key].min()


def test_failed_cells_do_not_count_for_the_best(project):
    run = run_of(project, "TIM-39_grid_multivariate_30")
    ok = run.ok_cells()
    assert group_best(run, project.metric("test_mape")) >= ok["test_mape"].min()


def test_listing_of_a_finished_run(project):
    run = run_of(project, "TIM-52_best_90")
    row = run_listing(project, run, ["data.pred_len"])
    assert row["cells"] == row["planned"] == 30
    assert row["errors"] == 0 and not row["running"]
    assert row["best"]["metric"] == "test_mape" and row["best"]["unit"] == "%" and row["best"]["scale"] == 100
    assert row["merkmal"] == {"key": "data.pred_len", "label": "pred_len", "value": "90"}


def test_listing_of_a_running_run_counts_written_against_planned(project):
    row = run_listing(project, list_runs(project)[0], [])
    assert row["running"] and 0 < row["cells"] < row["planned"]
    assert row["merkmal"] is None


def test_listing_counts_errors_in_failed_run(project):
    row = run_listing(project, run_of(project, "TIM-39_grid_multivariate_30"), [])
    assert row["errors"] > 0 and row["cells"] == 294


# --- issue links and Linear -------------------------------------------------------------------
def test_analysis_and_deliverable_are_linked_by_issue_id(project):
    assert linear.local_links(project, "TIM-52") == {
        "analysis": "analysis/TIM-52_best_config",
        "deliverable": "deliverables/2026-10-09 Comparison TIM-52",
    }
    assert linear.local_links(project, "TIM-45") == {"analysis": None, "deliverable": None}


def test_analysis_prefix_must_match_the_whole_id(project):
    assert linear.local_links(project, "TIM-5")["analysis"] is None


def linear_client(payload, calls):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"data": payload})

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_linear_titles_and_status(project, monkeypatch):
    linear.clear_cache()
    calls = []
    client = linear_client(
        {"i0": {"identifier": "TIM-52", "title": "Best config", "url": "https://l/52", "state": {"name": "In Progress", "type": "started"}}},
        calls,
    )
    got = linear.fetch_linear(["TIM-52"], "key", client)
    assert got["TIM-52"] == {"title": "Best config", "url": "https://l/52", "status": "In Progress", "status_type": "started"}
    assert calls[0].headers["Authorization"] == "key"


def test_linear_is_cached(project):
    linear.clear_cache()
    calls = []
    client = linear_client({"i0": {"title": "T", "url": "u", "state": {"name": "Todo", "type": "unstarted"}}}, calls)
    linear.fetch_linear(["TIM-1"], "k", client)
    linear.fetch_linear(["TIM-1"], "k", client)
    assert len(calls) == 1


def test_linear_errors_yield_no_titles(project):
    linear.clear_cache()
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    assert linear.fetch_linear(["TIM-9"], "k", client) == {}


def test_malformed_issue_ids_are_not_sent(project):
    linear.clear_cache()
    calls = []
    client = linear_client({}, calls)
    linear.fetch_linear(['TIM-1") { x } #', "../x"], "k", client)
    assert calls == []


def test_without_key_only_local_links_are_returned(project, monkeypatch):
    monkeypatch.delenv("LINEAR_API_KEY", raising=False)
    payload = linear.issues_payload(project, ["TIM-52"])
    assert payload["TIM-52"] == {"analysis": "analysis/TIM-52_best_config", "deliverable": "deliverables/2026-10-09 Comparison TIM-52"}
