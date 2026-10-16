"""Templates of analysis boards (feature D): storage and API."""

import json

import pytest
from fastapi.testclient import TestClient

from mlviz.project import Project
from mlviz.server import create_app
from mlviz.templates import BUILTIN, TemplateError, TemplateStore

W = [
    {"type": "compare-table", "settings": {"rows": "forecaster"}, "width": "full"},
    {"type": "per-region", "settings": {}, "width": "half"},
]


@pytest.fixture
def store(tmp_path):
    return TemplateStore(Project.load(tmp_path))


def test_nothing_is_written_before_the_first_template(tmp_path, store):
    assert store.list() == [] and not (tmp_path / ".mlviz").exists()


def test_a_template_keeps_widgets_order_settings_and_width_but_no_runs(store, tmp_path):
    t = store.save("one", "Meeting-Standard", W)
    assert t == {"name": "Meeting-Standard", "scope": "one", "widgets": W, "last_used": None}
    stored = json.loads((tmp_path / ".mlviz" / "templates.json").read_text())["templates"][0]
    assert "run" not in json.dumps(stored) and [w["type"] for w in stored["widgets"]] == ["compare-table", "per-region"]


def test_an_empty_name_becomes_neue_vorlage(store):
    assert store.save("one", "  ", W)["name"] == "Neue Vorlage"


def test_the_same_name_in_any_case_overwrites_within_a_scope_and_keeps_last_used(store):
    store.save("one", "Meeting", W)
    store.mark_used("one", "Meeting", ["2026-10-06_1000_TIM-52_best_30"])
    store.save("one", "MEETING", W[:1])
    items = store.list("one")
    assert len(items) == 1 and items[0]["name"] == "MEETING" and len(items[0]["widgets"]) == 1
    assert items[0]["last_used"]["runs"] == ["2026-10-06_1000_TIM-52_best_30"]


def test_the_same_name_may_exist_in_another_scope(store):
    store.save("one", "Gleich", W)
    store.save("two", "Gleich", W[:1])
    assert [len(t["widgets"]) for t in store.list("one")] == [2] and [len(t["widgets"]) for t in store.list("two")] == [1]
    assert len(store.list()) == 2


def test_standard_is_built_in_and_cannot_be_saved_over_or_deleted(store):
    for name in (BUILTIN, "standard", " STANDARD "):
        with pytest.raises(TemplateError, match="eingebaut"):
            store.save("one", name, W)
    with pytest.raises(TemplateError, match="eingebaut"):
        store.delete("one", BUILTIN)


@pytest.mark.parametrize(
    "scope, widgets, fragment",
    [
        ("everything", W, "scope"),
        ("one", "table", "widgets"),
        ("one", [{"settings": {}}], "type"),
        ("one", [{"type": "a", "settings": "x"}], "settings"),
        ("one", [{"type": "a", "width": "wide"}], "width"),
    ],
)
def test_invalid_templates_are_refused(store, scope, widgets, fragment):
    with pytest.raises(TemplateError, match=fragment):
        store.save(scope, "x", widgets)
    assert store.list() == []


def test_a_name_longer_than_60_characters_is_refused(store):
    with pytest.raises(TemplateError):
        store.save("one", "x" * 61, W)


def test_own_widgets_and_null_settings_are_kept(store):
    t = store.save("one", "Mit Eigenem", [{"type": "own:mape-je-region", "settings": {"model": None, "n": 3}, "width": "full"}])
    assert t["widgets"][0] == {"type": "own:mape-je-region", "settings": {"model": None}, "width": "full"}  # only text settings


def test_marking_a_template_as_used_stores_the_runs_and_the_time(store, monkeypatch):
    monkeypatch.setenv("MLVIZ_NOW", "2026-10-15T12:00:00")
    store.save("two", "Duell", W)
    store.mark_used("two", "duell", ["a", "b"])
    assert store.get("two", "Duell")["last_used"] == {"runs": ["a", "b"], "at": "2026-10-15T12:00:00"}
    with pytest.raises(KeyError):
        store.mark_used("two", "Nope", [])


def test_delete_removes_one_template_of_one_scope(store):
    store.save("one", "A", W)
    store.save("two", "A", W)
    store.delete("one", "a")
    assert [t["scope"] for t in store.list()] == ["two"]
    with pytest.raises(KeyError):
        store.delete("one", "A")


def test_broken_files_and_foreign_entries_are_ignored(tmp_path, store):
    (tmp_path / ".mlviz").mkdir()
    (tmp_path / ".mlviz" / "templates.json").write_text("{not json")
    assert store.list() == []
    (tmp_path / ".mlviz" / "templates.json").write_text(json.dumps({"templates": [{"name": "x", "scope": "weird"}, 5, {"name": "ok", "scope": "one", "widgets": []}]}))
    assert [t["name"] for t in store.list()] == ["ok"]


# --- API ------------------------------------------------------------------------------------
@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(tmp_path))


def test_api_save_list_use_delete(client):
    assert client.get("/api/templates").json() == []
    saved = client.post("/api/templates", json={"scope": "one", "name": "Meeting", "widgets": W})
    assert saved.status_code == 200 and saved.json()["name"] == "Meeting"
    assert [t["name"] for t in client.get("/api/templates", params={"scope": "one"}).json()] == ["Meeting"]
    assert client.get("/api/templates", params={"scope": "two"}).json() == []
    used = client.post("/api/templates/used", json={"scope": "one", "name": "Meeting", "runs": ["r1"]})
    assert used.json()["last_used"]["runs"] == ["r1"]
    assert client.post("/api/templates/used", json={"scope": "one", "name": "Nope", "runs": []}).status_code == 404
    assert client.post("/api/templates/delete", json={"scope": "one", "name": "Meeting"}).json() == {"deleted": "Meeting"}
    assert client.post("/api/templates/delete", json={"scope": "one", "name": "Meeting"}).status_code == 404
    assert client.get("/api/templates").json() == []


def test_api_refuses_standard_and_invalid_input(client):
    assert client.post("/api/templates", json={"scope": "one", "name": "Standard", "widgets": W}).status_code == 400
    assert client.post("/api/templates", json={"scope": "x", "name": "A", "widgets": W}).status_code == 400
    assert client.post("/api/templates/delete", json={"scope": "one", "name": "Standard"}).status_code == 400
