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


# --- H: the description of a run ---------------------------------------------------------------
TIM45 = fixture.run_folder(next(r for r in fixture.RUNS if r["experiment"] == "TIM-45_g6_combined"))
BEST_30_SECOND = fixture.run_folder([r for r in fixture.RUNS if r["experiment"] == "TIM-52_best_30"][1])


def description(client, run_id):
    r = client.get(f"/api/runs/{run_id}/description")
    assert r.status_code == 200
    return r.json()["description"]


def test_a_run_without_a_description_answers_null(client):
    assert description(client, PLAIN) is None


def test_an_unknown_run_is_404(client):
    assert client.get("/api/runs/gibt-es-nicht/description").status_code == 404


def test_the_fields_come_back_as_plain_text(client):
    d = description(client, BEST_90)
    assert d["short"].startswith("Bestes Setup")
    assert d["purpose"].splitlines() == [
        "Prüfen, ob das beste REP-Net-Setup aus dem Grid auch bei 90 Tagen Horizont vorn liegt.",
        "Dazu läuft es mit allen Baselines unter denselben Bedingungen.",
    ]
    assert d["shows"] == ["REP-Net gegen sarima, ets, prophet und snaive", "Abstand je Horizont-Abschnitt"]
    assert d["notes"] == ["Gleiche Folds wie TIM-52_best_30"]
    assert d["expectation"].startswith("REP-Net bleibt vorn")
    assert d["problems"] == []


def test_empty_optional_fields_are_empty_not_missing(client):
    d = description(client, BEST_30_SECOND)
    assert d["notes"] == [] and d["compare_to"] == [] and d["expectation"] is None


def test_compare_to_names_resolve_to_runs_or_are_marked_unknown(client):
    d = description(client, BEST_90)
    assert d["compare_to"] == [
        {"name": "2026-10-08_1120_TIM-52_best_30", "run": BEST_30_SECOND},
        {"name": "TIM-99_gibt_es_nicht", "run": None},
    ]


def test_compare_to_also_accepts_the_experiment_name(project):
    from mlviz import descriptions

    [hit] = descriptions.resolve_compare(project, ["TIM-52_best_30"])
    assert hit["run"] == BEST_30_SECOND  # the newest run of that name


def test_problems_come_with_the_fields_that_can_be_read(client):
    d = description(client, TIM45)
    assert d["problems"] == ["shows fehlt"]
    assert d["short"].startswith("Lernrate und Epochen") and d["purpose"] and d["shows"] == []


def test_a_description_that_cannot_be_read_is_a_problem_not_an_error(project, monkeypatch):
    import ds_store

    from mlviz import descriptions

    def broken(run_dir):
        raise OSError("kaputt")

    monkeypatch.setattr(ds_store, "read_description", broken)
    d = descriptions.describe(project, get_run(project, BEST_90))
    assert d["problems"] == ["kaputt"] and d["purpose"] is None and d["shows"] == []


def test_markdown_is_not_interpreted(project, monkeypatch):
    import ds_store

    from mlviz import descriptions

    monkeypatch.setattr(ds_store, "read_description", lambda d: {"short": "**fett**", "purpose": "# kein Titel", "shows": ["_x_"], "problems": []})
    d = descriptions.describe(project, get_run(project, BEST_90))
    assert d["short"] == "**fett**" and d["purpose"] == "# kein Titel" and d["shows"] == ["_x_"]
