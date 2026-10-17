"""Feature F (agent connection) in the browser, with the stand-in for `claude` (tests/fake_claude.py)."""

import json
import re
from datetime import timedelta

import pytest
from playwright.sync_api import expect

from mlviz.project import now

from .conftest import _fresh, serve
from .test_agent_window import open_window


@pytest.fixture
def agent(page, tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_CLAUDE_LOG", str(tmp_path / "calls.log"))
    with serve(tmp_path) as url:
        _fresh(page, url)
        page.root = tmp_path
        yield page


def seed_chat(root, tokens, minutes_ago, title="Alter Chat"):
    """A chat of a given size whose last turn was some minutes ago (the clock of the tests is fixed)."""
    d = root / ".mlviz" / "chats"
    d.mkdir(parents=True, exist_ok=True)
    at = (now() - timedelta(minutes=minutes_ago)).isoformat()
    chat = {
        "id": "aaaaaaaaaaaa", "title": title, "created_at": at, "updated_at": at, "session_id": "sess-1", "tokens": tokens,
        "last_turn_at": at, "cache_ttl_s": 3600, "messages": [{"k": "user", "t": "Frühere Frage", "at": at}, {"k": "agent", "t": "Frühere Antwort", "at": at}],
    }
    (d / "aaaaaaaaaaaa.json").write_text(json.dumps(chat))


def open_seeded(page):
    page.reload()
    open_window(page)
    expect(page.get_by_test_id("agent-msg-agent")).to_have_text("Frühere Antwort")  # the chat is loaded


def sent(page):
    """The arguments of every message sent (the login check is logged too, but is no message)."""
    f = page.root / "calls.log"
    calls = [json.loads(l)["args"] for l in f.read_text().splitlines()] if f.exists() else []
    return [a for a in calls if "-p" in a]


def say(page, text):
    page.get_by_test_id("agent-input").fill(text)
    page.keyboard.press("Enter")


def test_a_message_is_answered_and_the_view_goes_along(agent):
    open_window(agent)
    say(agent, "Wie sieht es aus?")
    expect(agent.get_by_test_id("agent-msg-agent")).to_have_text("Antwort auf: Wie sieht es aus?")
    expect(agent.get_by_test_id("agent-working")).to_have_count(0)
    (call,) = sent(agent)
    assert call[call.index("-p") + 1].startswith("[Ansicht: Läufe · Liste, Modus: ")
    # the numbers behind the header come from the usage of that turn
    expect(agent.get_by_test_id("agent-cache")).to_have_text(re.compile("Cache warm"))
    assert agent.get_by_test_id("agent-context-meter").get_attribute("title") == "Kontext: 2k von 200k Tokens"  # the stand-in counts the prompt, with its first line


def test_while_working_the_send_button_is_a_stop_button_and_the_capsule_says_so(agent):
    open_window(agent)
    say(agent, "[sleep] lange")
    stop = agent.get_by_test_id("agent-stop")
    expect(stop).to_be_visible()
    expect(agent.get_by_test_id("agent-working")).to_be_visible()
    assert stop.evaluate("e => getComputedStyle(e).backgroundColor") != agent.evaluate("getComputedStyle(document.body).backgroundColor")
    agent.get_by_test_id("agent-min").click()
    expect(agent.get_by_test_id("agent-capsule")).to_have_attribute("data-state", "busy")
    expect(agent.get_by_test_id("agent-capsule-open-text")).to_have_text("Agent · arbeitet …")
    agent.get_by_test_id("agent-capsule-open").click()
    stop.click()
    expect(agent.get_by_test_id("agent-info").last).to_have_text("Abgebrochen")
    expect(agent.get_by_test_id("agent-send")).to_be_visible()


def test_an_error_stays_in_the_chat_and_erneut_senden_asks_again(agent):
    open_window(agent)
    say(agent, "[error] bitte")
    err = agent.get_by_test_id("agent-error")
    expect(err).to_contain_text("Usage limit reached")
    agent.get_by_test_id("agent-min").click()
    expect(agent.get_by_test_id("agent-capsule")).to_have_attribute("data-state", "error")
    expect(agent.get_by_test_id("agent-capsule-open-text")).to_have_text("Agent · Fehler")
    agent.get_by_test_id("agent-capsule-open").click()
    agent.get_by_test_id("agent-resend").click()
    expect(agent.get_by_test_id("agent-error")).to_have_count(1)
    expect(agent.get_by_test_id("agent-msg-user")).to_have_count(1)  # asking again is not a second question


def test_a_cold_big_chat_holds_the_message_back_with_a_hint(agent):
    seed_chat(agent.root, 80_000, 120)
    open_seeded(agent)
    say(agent, "Neue Frage")
    hint = agent.get_by_test_id("agent-cold-hint")
    expect(hint).to_contain_text("Cache abgelaufen. Diese Nachricht liest den ganzen Chat neu ein (~80k Tokens). Noch nichts gesendet.")
    expect(agent.get_by_test_id("agent-msg-user")).to_have_count(1)  # only the earlier question
    assert sent(agent) == []
    agent.get_by_test_id("agent-hint-cancel").click()
    expect(hint).to_have_count(0)
    expect(agent.get_by_test_id("agent-input")).to_have_value("Neue Frage")  # the text stays in the input


def test_trotzdem_senden_goes_to_the_same_chat(agent):
    seed_chat(agent.root, 80_000, 120)
    open_seeded(agent)
    say(agent, "Neue Frage")
    agent.get_by_test_id("agent-send-anyway").click()
    expect(agent.get_by_test_id("agent-msg-user")).to_have_text(["Frühere Frage", "Neue Frage"])
    expect(agent.get_by_test_id("agent-msg-agent")).to_have_count(2)
    (a,) = sent(agent)
    assert a[a.index("--resume") + 1] == "sess-1"


def test_in_neuem_chat_senden_starts_an_empty_chat_with_the_message(agent):
    seed_chat(agent.root, 80_000, 120)
    open_seeded(agent)
    say(agent, "Neue Frage")
    agent.get_by_test_id("agent-send-new").click()
    expect(agent.get_by_test_id("agent-msg-user")).to_have_text("Neue Frage")
    expect(agent.get_by_test_id("agent-msg-agent")).to_have_count(1)
    (a,) = sent(agent)
    assert "--resume" not in a  # no summary, a new session


def test_a_warm_or_small_chat_is_not_held_back(agent):
    seed_chat(agent.root, 80_000, 10)  # warm
    open_seeded(agent)
    say(agent, "Warm")
    expect(agent.get_by_test_id("agent-msg-agent")).to_have_count(2)
    expect(agent.get_by_test_id("agent-cold-hint")).to_have_count(0)


def test_not_logged_in_shows_the_step_and_blocks_sending_until_rechecked(agent, monkeypatch):
    monkeypatch.setenv("FAKE_CLAUDE_LOGGED_OUT", "1")
    open_window(agent)
    box = agent.get_by_test_id("agent-setup-problem")
    expect(box).to_contain_text("Claude Code ist nicht angemeldet")
    expect(box).to_contain_text("Im Terminal `claude` ausführen und anmelden.")
    expect(agent.get_by_test_id("agent-input")).to_be_disabled()
    agent.get_by_test_id("agent-min").click()
    expect(agent.get_by_test_id("agent-capsule-open-text")).to_have_text("Agent · nicht eingerichtet")
    expect(agent.get_by_test_id("agent-capsule")).to_have_attribute("data-state", "unset")
    agent.get_by_test_id("agent-capsule-open").click()
    monkeypatch.delenv("FAKE_CLAUDE_LOGGED_OUT")
    agent.get_by_test_id("agent-recheck").click()
    expect(box).to_have_count(0)
    expect(agent.get_by_test_id("agent-input")).to_be_enabled()


def test_an_api_key_is_warned_about(agent, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    open_window(agent)
    expect(agent.get_by_test_id("agent-api-key")).to_have_text("Der Agent läuft über API-Key, nicht über das Abo.")


def test_the_chat_menu_offers_compact_session_id_and_the_abo_line(agent):
    seed_chat(agent.root, 40_000, 10)
    open_seeded(agent)
    agent.get_by_test_id("agent-chats-button").click()
    expect(agent.get_by_test_id("agent-limits")).to_have_count(0)  # nothing reported yet
    expect(agent.get_by_test_id("agent-compact")).to_be_enabled()
    agent.get_by_test_id("agent-compact").click()
    expect(agent.get_by_test_id("agent-info").last).to_have_text("Chat komprimiert · 52k → 2k Tokens")
    # compacted to 2k: too small to compact again; the usage of the subscription arrives with the next answer
    say(agent, "Und jetzt?")
    expect(agent.get_by_test_id("agent-msg-agent")).to_have_count(2)
    agent.get_by_test_id("agent-chats-button").click()
    expect(agent.get_by_test_id("agent-limits")).to_have_text("Abo · 5 h: 24 % · Woche: 65 %")
    expect(agent.get_by_test_id("agent-compact")).to_be_disabled()
    expect(agent.get_by_test_id("agent-copy-session")).to_be_enabled()


def test_a_cold_chat_cannot_be_compacted(agent):
    seed_chat(agent.root, 40_000, 120)
    open_seeded(agent)
    agent.get_by_test_id("agent-chats-button").click()
    expect(agent.get_by_test_id("agent-compact")).to_be_disabled()


# --- v0.2.3 · J: the answers are formatted text ---------------------------------------------------------
def test_an_answer_is_drawn_as_formatted_text_and_your_own_message_stays_plain(agent):
    open_window(agent)
    say(agent, "[markdown] **nicht fett**")
    answer = agent.get_by_test_id("agent-msg-agent")
    expect(answer.locator("strong")).to_have_text("Ergebnis")
    expect(answer.locator(".md-code").first).to_have_text("find_runs")
    items = answer.locator("ul > li")
    expect(items).to_have_count(2)
    assert items.nth(0).bounding_box()["y"] < items.nth(1).bounding_box()["y"]  # one below the other
    expect(items.nth(1).locator("em")).to_have_text("Betonung")
    expect(answer.locator("table th")).to_have_text(["Lauf", "Wert"])
    expect(answer.locator("tbody td")).to_have_text(["best_90", "3,46"])
    link = answer.locator("a.md-link")
    assert link.get_attribute("href") == "https://example.org/doku" and link.get_attribute("target") == "_blank"
    assert link.get_attribute("rel") == "noopener noreferrer"
    expect(answer.locator("pre")).to_have_text("x = 1")
    expect(agent.get_by_test_id("agent-msg-user")).to_have_text("[markdown] **nicht fett**")  # plain, no bold
    assert agent.get_by_test_id("agent-msg-user").locator("strong").count() == 0


def test_a_wide_table_scrolls_inside_the_message_instead_of_widening_the_window(agent):
    open_window(agent)
    say(agent, "[wide] breit")
    table = agent.get_by_test_id("agent-msg-agent").locator(".md-table-wrap")
    expect(table).to_be_visible()
    window = agent.get_by_test_id("agent-window").bounding_box()
    before = window["width"]
    box = table.bounding_box()
    assert box["x"] + box["width"] <= window["x"] + window["width"] + 1
    assert table.evaluate("e => e.scrollWidth > e.clientWidth")  # the table is wider than the message and scrolls
    assert agent.get_by_test_id("agent-window").bounding_box()["width"] == before
