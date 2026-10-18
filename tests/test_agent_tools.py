"""Feature C: the tools of the agent, the modes and the cards (MCP server, commands, confirmation)."""

import json
import threading
import time

import pytest
from fastapi.testclient import TestClient

from mlviz import agent_tools
from mlviz.agent_run import ChatRun
from mlviz.fixture import make_project
from mlviz.server import create_app

RUN = "2026-10-08_1120_TIM-52_best_30"


@pytest.fixture(scope="module")
def project(tmp_path_factory):
    return make_project(tmp_path_factory.mktemp("tools"))


@pytest.fixture
def client(project):
    return TestClient(create_app(project))


@pytest.fixture
def runner(client):
    return client.app.state.agent_runner


@pytest.fixture
def chat(client):
    return client.post("/api/agent/chats", json={}).json()["id"]


def set_mode(client, mode):
    client.put("/api/agent/mode", json={"mode": mode})


class Call:
    """A tool call in a thread, as `claude` makes it while a request is running."""

    def __init__(self, runner, chat, name, args=None):
        self.runner, self.chat = runner, chat
        self.live = runner.live.get(chat) or runner.live.setdefault(chat, ChatRun())
        self.result = None
        self.thread = threading.Thread(target=lambda: setattr(self, "result", runner.call_tool(chat, name, args or {})))
        self.thread.start()

    def next_item(self, timeout=5):
        return self.live.out.get(timeout=timeout)

    def next_command(self):
        while True:
            item = self.next_item()
            if "command" in item:
                return item["command"]

    def finish(self):
        self.thread.join(timeout=5)
        assert not self.thread.is_alive()
        return self.result


def messages(client, chat):
    return client.get(f"/api/agent/chats/{chat}").json()["messages"]


def reply(client, cmd, **result):
    return client.post(f"/api/agent/commands/{cmd['id']}/result", json={"ok": True, **result}).json()


# --- which tool waits for a click --------------------------------------------------------------------
@pytest.mark.parametrize(
    "mode,kind,asks",
    [("direct", "read", False), ("direct", "nav", False), ("direct", "change", False),
     ("mixed", "read", False), ("mixed", "nav", False), ("mixed", "change", True),
     ("confirm", "read", False), ("confirm", "nav", True), ("confirm", "change", True)],
)
def test_the_mode_decides_which_kinds_ask(mode, kind, asks):
    assert agent_tools.needs_confirmation(mode, kind) is asks


def test_applying_a_template_and_drafting_a_widget_are_navigation_not_change():
    assert agent_tools.TOOLS["apply_template"].kind == "nav" and agent_tools.TOOLS["draft_widget"].kind == "nav"
    assert agent_tools.TOOLS["save_template"].kind == "change" and agent_tools.TOOLS["keep_draft"].kind == "change"
    assert agent_tools.TOOLS["save_deliverable"].kind == "change"


def test_every_tool_has_a_schema_and_the_groups_of_the_spec_are_there():
    names = {t["name"] for t in agent_tools.catalog()}
    assert {"find_runs", "read_run", "open_run", "focus_tab", "close_tab", "show_runs", "open_analysis", "set_run_view", "add_widget",
            "remove_widget", "configure_widget", "move_widget", "resize_widget", "apply_template", "save_template", "draft_widget",
            "keep_draft", "save_deliverable", "get_view", "choose_run"} <= names
    for t in agent_tools.catalog():
        assert t["description"] and t["inputSchema"]["type"] == "object"


# --- the MCP server ------------------------------------------------------------------------------------
def rpc(client, chat, method, params=None, token=None, id=1):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.post(f"/mcp/{chat}", json={"jsonrpc": "2.0", "id": id, "method": method, "params": params or {}}, headers=headers)


def test_the_mcp_server_wants_the_secret_of_this_start(client, runner, chat):
    assert rpc(client, chat, "tools/list").status_code == 401
    assert rpc(client, chat, "tools/list", token="wrong").status_code == 401
    assert rpc(client, chat, "tools/list", token=runner.token).status_code == 200


def test_initialize_list_and_notifications(client, runner, chat):
    init = rpc(client, chat, "initialize", {"protocolVersion": "2025-06-18"}, runner.token).json()
    assert init["result"]["protocolVersion"] == "2025-06-18" and init["result"]["serverInfo"]["name"] == "mlviz"
    tools = rpc(client, chat, "tools/list", token=runner.token).json()["result"]["tools"]
    assert any(t["name"] == "find_runs" for t in tools)
    note = client.post(f"/mcp/{chat}", json={"jsonrpc": "2.0", "method": "notifications/initialized"}, headers={"Authorization": f"Bearer {runner.token}"})
    assert note.status_code == 202
    assert client.get(f"/mcp/{chat}").status_code == 405


def test_read_tools_answer_from_the_backend_without_a_line_in_the_chat(client, runner, chat):
    r = rpc(client, chat, "tools/call", {"name": "find_runs", "arguments": {"feature": {"pred_len": "30"}}}, runner.token).json()["result"]
    assert not r["isError"] and json.loads(r["content"][0]["text"])["count"] == 8
    r = rpc(client, chat, "tools/call", {"name": "read_run", "arguments": {"run": RUN, "part": "summary"}}, runner.token).json()["result"]
    assert json.loads(r["content"][0]["text"])["run"] == RUN
    assert messages(client, chat) == []


def test_find_runs_filters(client, runner):
    def find(**a):
        return agent_tools.run_tool(runner.project, "find_runs", a)

    assert find(issue="TIM-52")["count"] == 3 and find(issue="TIM-99")["count"] == 0
    assert all(r["issue"] == "TIM-52" for r in find(issue="TIM-52")["runs"])
    assert find(state="running")["count"] == 1
    assert all(r["started"][:10] >= "2026-10-08" for r in find(date_from="2026-10-08")["runs"])
    assert find(axis="encoding_size")["count"] >= 1
    assert find(limit=2)["runs"].__len__() == 2 and find(limit=2)["count"] > 2


def test_an_ambiguous_run_is_reported_to_the_agent(client, runner, chat):
    r = rpc(client, chat, "tools/call", {"name": "read_run", "arguments": {"run": "TIM-52"}}, runner.token).json()["result"]
    assert r["isError"] and "Mehrere Läufe passen" in r["content"][0]["text"]


# --- Direkt: at once, with an action line ------------------------------------------------------------------
def test_direct_mode_sends_the_command_at_once_and_writes_an_action_line(client, runner, chat):
    set_mode(client, "direct")
    c = Call(runner, chat, "open_run", {"run": RUN})
    cmd = c.next_command()
    assert cmd["tool"] == "open_run" and cmd["args"] == {"run": RUN}
    assert reply(client, cmd, summary="Tab geöffnet · TIM-52_best_30", undoable=True, data={"tab": RUN}) == {"accepted": True}
    text, is_error = c.finish()
    assert not is_error and json.loads(text)["summary"] == "Tab geöffnet · TIM-52_best_30"
    (line,) = messages(client, chat)
    assert line["k"] == "action" and line["t"] == "Tab geöffnet · TIM-52_best_30" and line["undo_id"] == cmd["id"] and line["state"] == "done"


def test_an_action_without_undo_has_no_undo_id(client, runner, chat):
    set_mode(client, "direct")
    c = Call(runner, chat, "show_runs", {"view": "issues"})
    reply(client, c.next_command(), summary="Läufe · Issues")
    c.finish()
    assert "undo_id" not in messages(client, chat)[0]


def test_get_view_is_answered_without_a_line(client, runner, chat):
    c = Call(runner, chat, "get_view")
    reply(client, c.next_command(), data={"area": "runs"})
    text, _ = c.finish()
    assert json.loads(text) == {"area": "runs"} and messages(client, chat) == []


def test_a_failing_command_tells_the_agent_and_leaves_an_info_line(client, runner, chat):
    set_mode(client, "direct")
    c = Call(runner, chat, "remove_widget", {"widget": "nope"})
    cmd = c.next_command()
    client.post(f"/api/agent/commands/{cmd['id']}/result", json={"ok": False, "error": "Kein Widget „nope“ im Board"})
    text, is_error = c.finish()
    assert is_error and "Kein Widget" in text
    (line,) = messages(client, chat)
    assert line["k"] == "info" and "Kein Widget" in line["t"]


# --- Gemischt / Bestätigen: a card first -------------------------------------------------------------------
def test_mixed_mode_runs_navigation_at_once_but_asks_before_a_change(client, runner, chat):
    set_mode(client, "mixed")
    nav = Call(runner, chat, "open_analysis", {"scope": "project"})
    reply(client, nav.next_command(), summary="Analyse · Projektverlauf")
    nav.finish()
    change = Call(runner, chat, "remove_widget", {"widget": "compare-table"})
    card = next(m for m in iter(lambda: messages(client, chat), None) if m[-1]["k"] == "confirm")[-1]
    assert card["t"] == "Widget entfernen · compare-table" and card["tool"] == "remove_widget" and card["cid"]
    assert change.live.out.empty() or "command" not in change.live.out.queue[-1]  # nothing was sent to the tool yet
    client.post(f"/api/agent/commands/{card['cid']}/decision", json={"approve": True})
    cmd = change.next_command()
    assert cmd["id"] == card["cid"]
    reply(client, cmd, summary="Widget entfernt · Vergleichstabelle", undoable=True)
    change.finish()
    kinds = [m["k"] for m in messages(client, chat)]
    assert kinds == ["action", "action"]  # the card became the action line, in place
    assert messages(client, chat)[1]["undo_id"] == card["cid"]


def wait_for_card(client, chat):
    for _ in range(100):
        cards = [m for m in messages(client, chat) if m["k"] == "confirm"]
        if cards:
            return cards[0]
        time.sleep(0.05)
    raise AssertionError("no card")


def test_rejecting_a_card_tells_the_agent_and_changes_nothing(client, runner, chat):
    set_mode(client, "confirm")
    c = Call(runner, chat, "show_runs", {"view": "issues"})
    card = wait_for_card(client, chat)
    assert card["t"] == "Läufe · Issues"  # even navigation asks in Bestätigen
    client.post(f"/api/agent/commands/{card['cid']}/decision", json={"approve": False})
    text, is_error = c.finish()
    assert "abgelehnt" in text and not is_error
    (line,) = messages(client, chat)
    assert line["k"] == "action" and line["rejected"] and line["t"] == "Abgelehnt · Läufe · Issues"
    assert c.live.out.empty() or all("command" not in i for i in list(c.live.out.queue))


def test_the_save_card_lists_the_details(client, runner, chat):
    set_mode(client, "mixed")
    c = Call(runner, chat, "save_deliverable", {"title": "Meeting", "widgets": ["compare-table"]})
    card = wait_for_card(client, chat)
    assert card["save"] is True and card["details"][0] == "Ziel: deliverables/2026-10-15 Meeting/" and "Titel: Meeting" in card["details"] and "Widgets: compare-table" in card["details"]
    client.post(f"/api/agent/commands/{card['cid']}/decision", json={"approve": False})
    c.finish()


def test_stopping_closes_open_cards_as_rejected(client, runner, chat):
    set_mode(client, "mixed")
    c = Call(runner, chat, "add_widget", {"type": "per-region"})
    wait_for_card(client, chat)
    runner._procs[chat] = None  # a request is "running"
    assert runner.stop(chat)
    text, _ = c.finish()
    runner._procs.pop(chat, None)
    runner._sweep(chat)
    (line,) = messages(client, chat)
    assert line["k"] == "action" and line["rejected"]


def test_an_answer_for_a_gone_request_is_not_accepted(client):
    assert client.post("/api/agent/commands/deadbeef0000/result", json={"ok": True}).json() == {"accepted": False}
    assert client.post("/api/agent/commands/deadbeef0000/decision", json={"approve": True}).json() == {"accepted": False}


def test_without_a_request_in_progress_commands_are_refused(client, runner, chat):
    text, is_error = runner.call_tool(chat, "open_run", {"run": RUN})
    assert is_error and "keine Anfrage" in text
    assert runner.call_tool(chat, "no_such_tool", {})[1] is True


# --- run cards ---------------------------------------------------------------------------------------------
def test_choose_run_shows_cards_and_returns_the_clicked_run(client, runner, chat):
    ids = ["2026-10-08_1120_TIM-52_best_30", "2026-10-06_1000_TIM-52_best_30"]
    c = Call(runner, chat, "choose_run", {"question": "Welcher der beiden?", "runs": ids + ["gibt-es-nicht"]})
    for _ in range(100):
        cards = [m for m in messages(client, chat) if m["k"] == "choice"]
        if cards:
            break
        time.sleep(0.05)
    card = cards[0]
    assert card["t"] == "Welcher der beiden?" and [r["id"] for r in card["runs"]] == ids
    assert {"name", "started", "state", "axes"} <= set(card["runs"][0])
    client.post(f"/api/agent/commands/{card['cid']}/decision", json={"choice": ids[1]})
    text, is_error = c.finish()
    assert json.loads(text) == {"run": ids[1]} and not is_error
    (line,) = messages(client, chat)
    assert line["k"] == "action" and line["t"].startswith("Lauf gewählt · ")


# --- undo and redo ------------------------------------------------------------------------------------------
def test_undo_and_redo_update_the_action_line(client, runner, chat):
    set_mode(client, "direct")
    c = Call(runner, chat, "open_run", {"run": RUN})
    cmd = c.next_command()
    reply(client, cmd, summary="Tab geöffnet", undoable=True)
    c.finish()
    r = client.post(f"/api/agent/chats/{chat}/actions/{cmd['id']}", json={"state": "reverted", "text": "Tab geschlossen"})
    assert r.status_code == 200
    line = messages(client, chat)[0]
    assert line["state"] == "reverted" and line["t"] == "Tab geschlossen"
    client.post(f"/api/agent/chats/{chat}/actions/{cmd['id']}", json={"state": "done", "text": "Tab geöffnet"})
    assert messages(client, chat)[0]["state"] == "done"
    assert client.post(f"/api/agent/chats/{chat}/actions/{cmd['id']}", json={"state": "bad"}).status_code == 400
    assert client.post(f"/api/agent/chats/{chat}/actions/unknown", json={"state": "done"}).status_code == 404


def test_run_references_become_exact_ids_before_the_browser_sees_them(client, runner, chat):
    set_mode(client, "direct")
    c = Call(runner, chat, "open_run", {"run": "TIM-83"})  # one run matches
    cmd = c.next_command()
    assert cmd["args"]["run"] == "2026-10-15_1100_TIM-83_running_sweep"
    reply(client, cmd, summary="x")
    c.finish()


def test_unknown_and_ambiguous_runs_are_an_error_for_the_agent_not_a_command(client, runner, chat):
    set_mode(client, "direct")
    runner.live[chat] = ChatRun()
    text, is_error = runner.call_tool(chat, "open_run", {"run": "TIM-52"})
    assert is_error and "Mehrere Läufe passen" in text and "choose_run" in text
    text, is_error = runner.call_tool(chat, "open_run", {"run": "gibt-es-nicht"})
    assert is_error and "keinen Lauf" in text
    sent = []
    while not runner.live[chat].out.empty():
        sent.append(runner.live[chat].out.get())
    assert not any("command" in item for item in sent)  # nothing went to the browser
    lines = messages(client, chat)  # but both failures are in the chat for Tim
    assert [m["k"] for m in lines] == ["info", "info"] and all(m.get("error") for m in lines)
    assert lines[0]["t"].startswith("open_run: Mehrere Läufe passen") and lines[1]["t"].startswith("open_run: Es gibt keinen Lauf")


def test_find_runs_text_also_matches_the_description(runner):
    def find(text):
        return {r["id"] for r in agent_tools.run_tool(runner.project, "find_runs", {"text": text})["runs"]}

    assert any("TIM-52_best_90" in r for r in find("Horizont 90"))  # short
    assert any("TIM-52_best_90" in r for r in find("denselben Bedingungen"))  # purpose
    assert any("TIM-52_best_90" in r for r in find("Abstand je Horizont-Abschnitt"))  # shows
    assert not any("TIM-52_best_90" in r for r in find("kommt nirgends vor"))
    row = next(r for r in agent_tools.run_tool(runner.project, "find_runs", {"text": "TIM-52_best_90"})["runs"])
    assert row["short"].startswith("Bestes Setup")


def test_help_answers_as_plain_text_through_the_tool_call(runner):
    text, is_error = runner.call_tool("none", "help", {"topic": "modi"})
    assert not is_error and text.startswith("# Modi und Bestätigungen") and "\\n" not in text
    index, is_error = runner.call_tool("none", "help", {})
    assert not is_error and "`faehigkeiten`" in index
    text, is_error = runner.call_tool("none", "help", {"topic": "nix"})
    assert is_error and "Kein Thema" in text


@pytest.fixture(autouse=True)
def debug_off_again(client):
    yield
    client.put("/api/agent/debug", json={"on": False})  # the project of the module is shared between the tests


# --- v0.2.2 · what Tim sees: help, failures, and the debug display ------------------------------------
def lines(client, chat):
    return [(m["k"], m["t"], m.get("error", False), m.get("debug", False)) for m in messages(client, chat)]


def test_a_look_up_that_fails_is_a_line_in_the_chat(client, runner, chat):
    runner.live[chat] = ChatRun()
    text, is_error = runner.call_tool(chat, "read_run", {"run": "gibt-es-nicht"})
    assert is_error
    ((kind, line, error, debug),) = lines(client, chat)
    assert kind == "info" and error and not debug and line.startswith("read_run: ") and line == f"read_run: {text}"


def test_an_unknown_tool_and_a_request_that_is_over_are_lines_too(client, runner, chat):
    runner.call_tool(chat, "gibt_es_nicht", {})
    runner.call_tool(chat, "open_run", {"run": "TIM-83"})  # no request is running in this chat
    assert [(k, e) for k, _, e, _ in lines(client, chat)] == [("info", True), ("info", True)]
    assert lines(client, chat)[0][1] == "gibt_es_nicht: Unbekanntes Werkzeug: gibt_es_nicht"
    assert lines(client, chat)[1][1].startswith("open_run: In diesem Chat läuft gerade keine Anfrage")


def test_help_shows_the_topic_it_looked_at_and_a_wrong_topic_is_an_error(client, runner, chat):
    runner.call_tool(chat, "help", {"topic": "Modi"})
    runner.call_tool(chat, "help", {})
    runner.call_tool(chat, "help", {"topic": "nix"})
    got = lines(client, chat)
    assert [(k, t) for k, t, _, _ in got[:2]] == [("action", "Hilfe gelesen · modi"), ("action", "Hilfe gelesen · Inhaltsverzeichnis")]
    assert got[2][0] == "info" and got[2][2] and got[2][1].startswith("help: Kein Thema")  # an error line, no "gelesen" line
    assert len(got) == 3 and not any(d for *_, d in got)


def test_other_look_ups_stay_out_of_the_chat_unless_debug_is_on(client, runner, chat):
    runner.call_tool(chat, "find_runs", {"text": "TIM-52"})
    assert lines(client, chat) == []
    assert client.put("/api/agent/debug", json={"on": True}).json() == {"debug": True}
    runner.call_tool(chat, "find_runs", {"text": "TIM-52", "limit": 1})
    ((kind, line, error, debug),) = lines(client, chat)
    assert kind == "action" and debug and not error
    assert line.startswith('find_runs {"text": "TIM-52", "limit": 1} → {"count": 3') and len(line) < 330
    runner.call_tool(chat, "list_widgets", {"scope": "one"})
    assert lines(client, chat)[-1][1].startswith('list_widgets {"scope": "one"} → ')


def test_debug_also_shows_what_the_agent_reads_from_the_view(client, runner, chat):
    client.put("/api/agent/debug", json={"on": True})
    call = Call(runner, chat, "get_view")
    reply(client, call.next_command(), data={"area": "runs"})
    call.finish()
    ((kind, line, _, debug),) = lines(client, chat)
    assert kind == "action" and debug and line == 'get_view → {"area": "runs"}'


def test_a_failure_is_one_line_not_two_and_debug_does_not_double_it(client, runner, chat):
    client.put("/api/agent/debug", json={"on": True})
    runner.call_tool(chat, "read_run", {"run": "gibt-es-nicht"})
    runner.call_tool(chat, "help", {"topic": "modi"})
    got = lines(client, chat)
    assert [(k, d) for k, _, _, d in got] == [("info", False), ("action", False)]


def test_debug_is_a_setting_of_the_project_next_to_the_mode(client):
    assert client.get("/api/agent").json()["debug"] is False
    set_mode(client, "direct")
    client.put("/api/agent/debug", json={"on": True})
    set_mode(client, "confirm")  # the one setting does not wipe the other
    overview = client.get("/api/agent").json()
    assert overview["mode"] == "confirm" and overview["debug"] is True
    client.put("/api/agent/debug", json={"on": False})
    assert client.get("/api/agent").json()["debug"] is False and client.get("/api/agent").json()["mode"] == "confirm"


# --- v0.2.3 · M: set_instructions asks in every mode ----------------------------------------------------------------
@pytest.fixture(autouse=True)
def instructions_empty_again(client):
    yield
    client.put("/api/agent/instructions", json={"text": ""})


@pytest.mark.parametrize("mode", ["direct", "mixed", "confirm"])
def test_changing_the_instructions_asks_in_every_mode_also_in_direkt(client, runner, chat, mode):
    set_mode(client, mode)
    client.put("/api/agent/instructions", json={"text": "Kurz antworten."})
    c = Call(runner, chat, "set_instructions", {"text": "Kurz antworten.\nTabellen bevorzugen."})
    card = wait_for_card(client, chat)
    assert card["t"] == "Projekt-Anweisungen ändern" and card["tool"] == "set_instructions" and not card["save"]
    assert card["details"] == [
        "Neuer Text (ersetzt den bisherigen):", "Kurz antworten.", "Tabellen bevorzugen.", "",
        "Bisher:", "Kurz antworten.", "",
        "Gilt ab der nächsten Nachricht. Der Cache dieses Chats ist danach einmal kalt.",
    ]
    assert all("command" not in i for i in list(c.live.out.queue))  # nothing is done before the click
    client.post(f"/api/agent/commands/{card['cid']}/decision", json={"approve": False})
    text, is_error = c.finish()
    assert "abgelehnt" in text and not is_error
    assert client.get("/api/agent/instructions").json()["text"] == "Kurz antworten."  # unchanged


def test_after_the_click_the_browser_is_asked_and_the_answer_goes_back_to_the_agent(client, runner, chat):
    set_mode(client, "direct")
    c = Call(runner, chat, "set_instructions", {"text": "Neu."})
    card = wait_for_card(client, chat)
    client.post(f"/api/agent/commands/{card['cid']}/decision", json={"approve": True})
    cmd = c.next_command()
    assert cmd["tool"] == "set_instructions" and cmd["args"] == {"text": "Neu."}
    reply(client, cmd, summary="Projekt-Anweisungen gespeichert · 4 Zeichen", undoable=True)
    text, is_error = c.finish()
    assert not is_error and "gespeichert" in text
    (line,) = messages(client, chat)
    assert line["k"] == "action" and line["t"] == "Projekt-Anweisungen gespeichert · 4 Zeichen" and not line.get("auto")


def test_a_text_over_the_limit_is_an_error_for_the_agent_and_no_card(client, runner, chat):
    set_mode(client, "direct")
    runner.live[chat] = ChatRun()
    text, is_error = runner.call_tool(chat, "set_instructions", {"text": "x" * 4001})
    assert is_error and "4000" in text and "kürzer" in text
    assert [m["k"] for m in messages(client, chat)] == ["info"] and messages(client, chat)[0]["error"]
    text, is_error = runner.call_tool(chat, "set_instructions", {})
    assert is_error and "text fehlt" in text
    assert not any(m["k"] == "confirm" for m in messages(client, chat))


def test_a_stop_closes_an_open_instructions_card_as_rejected(client, runner, chat):
    set_mode(client, "direct")
    c = Call(runner, chat, "set_instructions", {"text": "Neu."})
    wait_for_card(client, chat)
    runner._procs[chat] = None  # a request is "running"
    assert runner.stop(chat)
    c.finish()
    runner._procs.pop(chat, None)
    runner._sweep(chat)
    (line,) = messages(client, chat)
    assert line["k"] == "action" and line["rejected"] is True
    assert client.get("/api/agent/instructions").json()["text"] == ""
