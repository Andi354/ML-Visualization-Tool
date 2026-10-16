"""Feature F: running the agent (`claude -p`), with the stand-in in tests/fake_claude.py."""

import json
import threading
import time

import pytest
from fastapi.testclient import TestClient

from mlviz import agent_run
from mlviz.server import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_CLAUDE_LOG", str(tmp_path / "calls.log"))
    return TestClient(create_app(tmp_path))


def calls(client):
    f = client.app.state.project.root / "calls.log"
    return [json.loads(l) for l in f.read_text().splitlines()] if f.exists() else []


def run(client, chat_id, text, **extra):
    """Sends a message and returns the snapshots of the stream."""
    with client.stream("POST", f"/api/agent/chats/{chat_id}/run", json={"text": text, **extra}) as r:
        assert r.status_code == 200
        return [json.loads(l[6:]) for l in r.iter_lines() if l.startswith("data: ")]


def new_chat(client):
    return client.post("/api/agent/chats", json={}).json()["id"]


def test_a_message_gets_an_answer_and_the_chat_keeps_it(client):
    cid = new_chat(client)
    snaps = run(client, cid, "Hallo", context="Analyse")
    assert snaps[0]["busy"] is True and snaps[0]["chat"]["messages"][0]["k"] == "user"
    last = snaps[-1]
    assert last["busy"] is False
    assert [m["k"] for m in last["chat"]["messages"]] == ["user", "agent"]
    assert last["chat"]["messages"][1]["t"] == "Antwort auf: Hallo"
    assert client.get(f"/api/agent/chats/{cid}").json()["messages"] == last["chat"]["messages"]


def test_the_call_is_headless_in_the_project_folder_with_the_view_in_front(client):
    cid = new_chat(client)
    run(client, cid, "Hallo", context="Lauf · TIM-52")
    (call,) = calls(client)
    a = call["args"]
    assert a[a.index("-p") + 1] == "[Ansicht: Lauf · TIM-52]\nHallo"
    assert a[a.index("--output-format") + 1] == "stream-json" and "--verbose" in a
    assert "--strict-mcp-config" in a and a[a.index("--allowedTools") + 1] == "mcp__mlviz__*,Read,Glob,Grep"
    assert call["cwd"] == str(client.app.state.project.root)
    assert "--resume" not in a


def test_the_session_is_stored_and_resumed_by_the_next_message(client):
    cid = new_chat(client)
    run(client, cid, "Eins")
    session = client.get(f"/api/agent/chats/{cid}").json()["session_id"]
    assert session
    run(client, cid, "Zwei")
    a = calls(client)[1]["args"]
    assert a[a.index("--resume") + 1] == session


def test_tokens_cache_and_window_come_from_the_usage(client):
    cid = new_chat(client)
    run(client, cid, "Hallo")
    chat = client.get(f"/api/agent/chats/{cid}").json()
    assert chat["tokens"] == 1000 + 10 * len("Hallo")
    assert chat["last_turn_at"] and chat["cache_ttl_s"] == 3600 and chat["context_window"] == 200000


def test_an_api_key_shortens_the_cache_lifetime(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    cid = new_chat(client)
    run(client, cid, "Hallo")
    assert client.get(f"/api/agent/chats/{cid}").json()["cache_ttl_s"] == 300
    assert client.get("/api/agent/setup").json()["api_key"] is True


def test_every_answer_block_is_a_snapshot(client):
    cid = new_chat(client)
    snaps = run(client, cid, "[blocks]")
    counts = [len([m for m in s["chat"]["messages"] if m["k"] == "agent"]) for s in snaps]
    assert counts == [0, 1, 2, 2]


def test_subscription_usage_is_reported(client):
    assert client.get("/api/agent").json()["limits"] is None
    cid = new_chat(client)
    run(client, cid, "Hallo")
    assert client.get("/api/agent").json()["limits"] == {"five_hour": 24, "seven_day": 65}


def test_an_error_of_claude_code_is_kept_and_resend_replaces_it(client):
    cid = new_chat(client)
    last = run(client, cid, "[error] bitte")[-1]["chat"]["messages"]
    assert [m["k"] for m in last] == ["user", "info"] and last[1]["error"] and last[1]["t"] == "Usage limit reached"
    again = run(client, cid, "[error] bitte", resend=True)[-1]["chat"]["messages"]
    assert [m["k"] for m in again] == ["user", "info"]  # not a second question, not a second error


def test_a_crash_without_result_shows_the_last_line_of_stderr(client):
    cid = new_chat(client)
    msgs = run(client, cid, "[silent]")[-1]["chat"]["messages"]
    assert msgs[-1]["error"] and msgs[-1]["t"] == "boom: something broke"


def test_stop_ends_the_process_and_notes_it(client):
    cid = new_chat(client)
    result = {}
    t = threading.Thread(target=lambda: result.setdefault("snaps", run(client, cid, "[sleep]")))
    t.start()
    for _ in range(100):
        if client.post(f"/api/agent/chats/{cid}/stop").json()["stopped"]:
            break
        time.sleep(0.05)
    t.join(timeout=10)
    assert not t.is_alive()
    msgs = result["snaps"][-1]["chat"]["messages"]
    assert msgs[-1] == {**msgs[-1], "k": "info", "t": "Abgebrochen"}
    assert client.post(f"/api/agent/chats/{cid}/stop").json() == {"stopped": False}


def test_one_request_per_chat_at_a_time_but_other_chats_run(client):
    a, b = new_chat(client), new_chat(client)
    t = threading.Thread(target=lambda: run(client, a, "[sleep]"))
    t.start()
    for _ in range(100):
        if client.app.state.project.root.joinpath("calls.log").exists():
            break
        time.sleep(0.05)
    assert client.post(f"/api/agent/chats/{a}/run", json={"text": "noch eins"}).status_code == 409
    assert run(client, b, "parallel")[-1]["busy"] is False
    client.post(f"/api/agent/chats/{a}/stop")
    t.join(timeout=10)


def test_empty_text_and_unknown_chat_are_refused(client):
    cid = new_chat(client)
    assert client.post(f"/api/agent/chats/{cid}/run", json={"text": "  "}).status_code == 400
    assert client.post("/api/agent/chats/aaaaaaaaaaaa/run", json={"text": "x"}).status_code == 404


def test_setup_check(client, monkeypatch):
    assert client.get("/api/agent/setup").json() == {"ready": True, "problem": None, "step": None, "api_key": False}
    monkeypatch.setenv("FAKE_CLAUDE_LOGGED_OUT", "1")
    s = client.get("/api/agent/setup").json()
    assert s["ready"] is False and "angemeldet" in s["problem"] and "claude" in s["step"]
    monkeypatch.setenv("MLVIZ_CLAUDE", "/nonexistent/claude")
    s = client.get("/api/agent/setup").json()
    assert s["ready"] is False and s["problem"]


def test_claude_is_found_in_the_vscode_extension_when_not_on_the_path(client, monkeypatch, tmp_path):
    monkeypatch.delenv("MLVIZ_CLAUDE")
    monkeypatch.setenv("PATH", "/nonexistent")
    monkeypatch.setenv("HOME", str(tmp_path))
    for v in ("2.1.9", "2.1.301"):
        b = tmp_path / ".vscode-server/extensions" / f"anthropic.claude-code-{v}-linux-x64/resources/native-binary/claude"
        b.parent.mkdir(parents=True)
        b.write_text("#!/bin/sh\n")
        b.chmod(0o755)
    assert agent_run.command() == [str(b)]  # 2.1.301 is newer than 2.1.9


def test_without_claude_code_the_setup_says_so(client, monkeypatch, tmp_path):
    monkeypatch.delenv("MLVIZ_CLAUDE")
    monkeypatch.setenv("PATH", "/nonexistent")
    monkeypatch.setenv("HOME", str(tmp_path))
    s = client.get("/api/agent/setup").json()
    assert s["ready"] is False and "nicht installiert" in s["problem"]


def test_compact_runs_slash_compact_on_the_session_and_notes_the_sizes(client):
    cid = new_chat(client)
    assert client.post(f"/api/agent/chats/{cid}/compact").status_code == 400  # nothing to compact yet
    run(client, cid, "Hallo")
    with client.stream("POST", f"/api/agent/chats/{cid}/compact") as r:
        snaps = [json.loads(l[6:]) for l in r.iter_lines() if l.startswith("data: ")]
    chat = snaps[-1]["chat"]
    assert chat["messages"][-1] == {**chat["messages"][-1], "k": "info", "t": "Chat komprimiert · 52k → 2k Tokens"}
    assert chat["tokens"] == 2010
    a = calls(client)[-1]["args"]
    assert a[a.index("-p") + 1] == "/compact" and "--resume" in a
    assert [m["k"] for m in chat["messages"]] == ["user", "agent", "info"]  # no user message for the command
