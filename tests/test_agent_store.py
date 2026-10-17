"""Chats and settings of the agent in <project>/.mlviz/."""

import json

import pytest
from fastapi.testclient import TestClient

from mlviz.agent_store import NEW_CHAT_TITLE, AgentStore, ChatNotFound
from mlviz.project import Project
from mlviz.server import create_app


@pytest.fixture
def root(tmp_path):
    return tmp_path


@pytest.fixture
def store(root):
    return AgentStore(Project.load(root))


def test_nothing_is_written_before_the_first_chat(root, store):
    assert store.list() == [] and store.mode() == "mixed"
    assert not (root / ".mlviz").exists()


def test_a_new_chat_is_empty_and_has_the_default_title(store):
    chat = store.create()
    assert chat["title"] == NEW_CHAT_TITLE and chat["messages"] == [] and chat["tokens"] == 0
    assert chat["session_id"] is None and chat["last_turn_at"] is None and chat["cache_ttl_s"] == 3600
    assert store.get(chat["id"]) == chat


def test_the_first_message_names_a_new_chat(store):
    chat = store.create()
    store.append(chat["id"], "user", "Öffne das Experiment von gestern\nmit pred_len 90")
    assert store.get(chat["id"])["title"] == "Öffne das Experiment von gestern"
    store.append(chat["id"], "user", "noch etwas")
    assert store.get(chat["id"])["title"] == "Öffne das Experiment von gestern"  # only the first one


def test_a_named_chat_keeps_its_title(store):
    chat = store.create("Eigener Titel")
    store.append(chat["id"], "user", "hallo")
    assert store.get(chat["id"])["title"] == "Eigener Titel"


def test_list_has_no_messages_and_the_newest_activity_first(store, monkeypatch):
    first, second = store.create(), store.create()
    monkeypatch.setenv("MLVIZ_NOW", "2026-10-16T09:00:00")
    store.append(first["id"], "user", "später")
    rows = store.list()
    assert [r["id"] for r in rows] == [first["id"], second["id"]]
    assert all("messages" not in r for r in rows) and rows[0]["messages_n"] == 1


def test_messages_keep_kind_text_and_time(store):
    chat = store.create()
    store.append(chat["id"], "action", "Tab geöffnet", undo_id="u1")
    m = store.get(chat["id"])["messages"][0]
    assert (m["k"], m["t"], m["undo_id"]) == ("action", "Tab geöffnet", "u1") and m["at"]


def test_unknown_kind_and_unknown_or_unsafe_ids_are_refused(store):
    chat = store.create()
    with pytest.raises(ValueError):
        store.append(chat["id"], "nonsense", "x")
    for bad in ("", "nope", "../../etc/passwd", "ABCDEF123456", "0123456789abc"):
        with pytest.raises(ChatNotFound):
            store.get(bad)
    with pytest.raises(ChatNotFound):
        store.get("0123456789ab")  # well formed, but there is no such chat


def test_a_broken_chat_file_is_skipped_in_the_list(root, store):
    good = store.create()
    (root / ".mlviz" / "chats" / "aaaaaaaaaaaa.json").write_text("{not json")
    assert [c["id"] for c in store.list()] == [good["id"]]


def test_the_mode_is_stored_and_checked(root, store):
    assert store.set_mode("confirm") == "confirm" and store.mode() == "confirm"
    assert json.loads((root / ".mlviz" / "agent.json").read_text()) == {"mode": "confirm"}
    with pytest.raises(ValueError):
        store.set_mode("everything")
    (root / ".mlviz" / "agent.json").write_text("[1]")
    assert store.mode() == "mixed"  # junk falls back to the default


def test_writes_stay_below_the_state_folder(root, store):
    store.create()
    store.set_mode("direct")
    assert sorted(p.name for p in root.iterdir()) == [".mlviz"]


# --- API ------------------------------------------------------------------------------------
@pytest.fixture
def client(root):
    return TestClient(create_app(root))


def test_api_lists_chats_and_the_mode(client):
    j = client.get("/api/agent").json()
    assert j["chats"] == [] and j["mode"] == "mixed" and j["now"]  # `now` is the clock of the tool (cache display)
    chat = client.post("/api/agent/chats").json()
    listing = client.get("/api/agent").json()
    assert [c["id"] for c in listing["chats"]] == [chat["id"]] and "messages" not in listing["chats"][0]


def test_api_message_is_appended_and_returned_with_the_chat(client):
    chat = client.post("/api/agent/chats").json()
    r = client.post(f"/api/agent/chats/{chat['id']}/messages", json={"text": "  Hallo  "})
    assert r.status_code == 200 and r.json()["messages"][0]["t"] == "Hallo"
    assert client.get(f"/api/agent/chats/{chat['id']}").json()["title"] == "Hallo"


def test_api_refuses_empty_messages_and_unknown_chats(client):
    chat = client.post("/api/agent/chats").json()
    assert client.post(f"/api/agent/chats/{chat['id']}/messages", json={"text": "  "}).status_code == 400
    assert client.get("/api/agent/chats/0123456789ab").status_code == 404
    assert client.post("/api/agent/chats/0123456789ab/messages", json={"text": "x"}).status_code == 404
    assert client.get("/api/agent/chats/..%2F..%2Fetc").status_code == 404


def test_api_mode(client):
    assert client.put("/api/agent/mode", json={"mode": "direct"}).json() == {"mode": "direct"}
    assert client.get("/api/agent").json()["mode"] == "direct"
    assert client.put("/api/agent/mode", json={"mode": "x"}).status_code == 400


# --- v0.2.3 · M: instructions of the project ---------------------------------------------------------
def test_the_instructions_start_empty_and_are_one_file_in_the_state_folder(tmp_path):
    from mlviz.agent_store import AgentStore
    from mlviz.project import Project

    store = AgentStore(Project.load(tmp_path))
    assert store.instructions() == ""
    assert store.set_instructions("Tabellen bevorzugen.\nKurz antworten.") == "Tabellen bevorzugen.\nKurz antworten."
    assert (tmp_path / ".mlviz" / "agent_instructions.md").read_text() == "Tabellen bevorzugen.\nKurz antworten.\n"
    assert store.instructions().strip() == "Tabellen bevorzugen.\nKurz antworten."
    assert store.set_instructions("") == "" and not (tmp_path / ".mlviz" / "agent_instructions.md").exists()


def test_the_instructions_have_a_limit_and_the_mode_file_is_not_touched(tmp_path):
    import pytest

    from mlviz.agent_store import MAX_INSTRUCTIONS, AgentStore
    from mlviz.project import Project

    store = AgentStore(Project.load(tmp_path))
    store.set_mode("direct")
    store.set_instructions("x" * MAX_INSTRUCTIONS)
    with pytest.raises(ValueError, match=str(MAX_INSTRUCTIONS)):
        store.set_instructions("x" * (MAX_INSTRUCTIONS + 1))
    with pytest.raises(ValueError):
        store.set_instructions(None)  # type: ignore[arg-type]
    assert len(store.instructions().strip()) == MAX_INSTRUCTIONS and store.mode() == "direct"


def test_a_change_with_expect_only_goes_through_if_nobody_changed_the_text(tmp_path):
    import pytest

    from mlviz.agent_store import AgentStore, InstructionsChanged
    from mlviz.project import Project

    store = AgentStore(Project.load(tmp_path))
    store.set_instructions("alt")
    store.set_instructions("neu", expect="alt")
    with pytest.raises(InstructionsChanged):
        store.set_instructions("wieder alt", expect="alt")
    assert store.instructions().strip() == "neu"
    store.set_instructions("", expect="neu")
    store.set_instructions("von null", expect="")  # an empty file counts as "" for expect
    assert store.instructions().strip() == "von null"
