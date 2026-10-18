"""Feature E (v0.3.0): own notes on runs (store, API, agent tools)."""

import json

import pytest
from fastapi.testclient import TestClient

from mlviz import agent_tools
from mlviz.fixture import make_project
from mlviz.notes import NoteNotFound, NoteStore, clean_anchor
from mlviz.project import Project
from mlviz.server import create_app

RUN = "2026-10-09_0845_TIM-52_best_90"


@pytest.fixture
def root(tmp_path):
    return make_project(tmp_path)


@pytest.fixture
def client(root):
    return TestClient(create_app(root))


def test_a_note_is_stored_per_run_and_a_missing_file_means_no_notes(root):
    store = NoteStore(Project.load(root))
    assert store.list(RUN) == [] and store.counts() == {}
    note = store.add(RUN, "  **gut**  ")
    assert note["text"] == "**gut**" and note["anchor"] == {"kind": "run", "key": ""} and note["by"] == "user"
    assert json.loads((root / ".mlviz" / "notes" / f"{RUN}.json").read_text())[0]["id"] == note["id"]
    assert store.counts() == {RUN: 1}


def test_update_and_delete_and_the_file_goes_with_the_last_note(root):
    store = NoteStore(Project.load(root))
    a = store.add(RUN, "eins")
    store.add(RUN, "zwei", {"kind": "section", "key": "expectation"})
    assert store.update(RUN, a["id"], "geändert")["text"] == "geändert"
    store.delete(RUN, a["id"])
    assert [n["text"] for n in store.list(RUN)] == ["zwei"]
    with pytest.raises(NoteNotFound):
        store.delete(RUN, a["id"])
    store.delete(RUN, store.list(RUN)[0]["id"])
    assert not (root / ".mlviz" / "notes" / f"{RUN}.json").exists()


def test_a_deleted_note_can_come_back_with_its_id_and_date(root):
    store = NoteStore(Project.load(root))
    n = store.add(RUN, "weg")
    store.delete(RUN, n["id"])
    back = store.add(RUN, n["text"], n["anchor"], n["by"], n["id"], n["created"])
    assert back["id"] == n["id"] and back["created"] == n["created"]


def test_anchors_and_texts_are_checked():
    assert clean_anchor({"kind": "group", "key": "lstm_layer=2"}) == {"kind": "group", "key": "lstm_layer=2"}
    for bad in ({"kind": "table"}, {"kind": "section", "key": "zzz"}, {"kind": "group", "key": " "}, "run"):
        with pytest.raises(ValueError):
            clean_anchor(bad)
    with pytest.raises(ValueError):
        NoteStore._text("   ")
    with pytest.raises(ValueError):
        NoteStore._text("x" * 4001)


def test_the_api_adds_edits_deletes_and_restores(client):
    n = client.post(f"/api/runs/{RUN}/notes", json={"text": "erste", "anchor": {"kind": "section", "key": "purpose"}}).json()
    assert client.get(f"/api/runs/{RUN}/notes").json()[0]["anchor"]["key"] == "purpose"
    assert client.put(f"/api/runs/{RUN}/notes/{n['id']}", json={"text": "neu"}).json()["text"] == "neu"
    assert client.get("/api/notes/counts").json() == {RUN: 1}
    assert client.delete(f"/api/runs/{RUN}/notes/{n['id']}").json()["id"] == n["id"]
    assert client.get(f"/api/runs/{RUN}/notes").json() == []
    assert client.post(f"/api/runs/{RUN}/notes", json=n).json()["id"] == n["id"]  # Rückgängig
    assert client.post(f"/api/runs/{RUN}/notes", json={"text": ""}).status_code == 400
    assert client.post("/api/runs/nope/notes", json={"text": "x"}).status_code == 404
    assert client.put(f"/api/runs/{RUN}/notes/zzz", json={"text": "x"}).status_code == 404


def test_runs_show_their_note_count_and_the_search_finds_text(client):
    client.post(f"/api/runs/{RUN}/notes", json={"text": "Der Horizont 90 ist zu lang für die Daten"})
    row = next(r for r in client.get("/api/runs").json() if r["id"] == RUN)
    assert row["notes"] == 1
    hit = client.get("/api/notes/search", params={"q": "HORIZONT"}).json()
    assert hit[0]["run"] == RUN and "Horizont 90" in hit[0]["excerpt"]
    assert client.get("/api/notes/search", params={"q": "nichts"}).json() == []


def test_the_agent_reads_notes_and_can_only_propose_them(root):
    project = Project.load(root)
    NoteStore(project).add(RUN, "meine Notiz", by="user")
    out = agent_tools.run_tool(project, "read_notes", {"run": "best_90"})
    assert out["notes"][0]["text"] == "meine Notiz" and out["run"] == RUN
    found = agent_tools.run_tool(project, "find_runs", {"text": "best_90"})
    assert found["runs"][0]["notes"] == 1
    tool = agent_tools.TOOLS["propose_note"]
    assert tool.kind == "change" and tool.always_confirm and tool.side == "browser"
    assert agent_tools.asks(tool, "direct")
    assert NoteStore(project).count(RUN) == 1  # nothing was written by proposing
