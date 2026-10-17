"""Feature C (the agent operates the tool) in the browser: modes, cards, action lines, undo.

`tests/fake_claude.py` speaks MCP to the tool the way Claude Code does: `[tool name {json}]` in a message makes it
call that tool, and it repeats the answer it got.
"""

import json
import re

import pytest
from playwright.sync_api import expect

from mlviz.fixture import make_project

from .conftest import _fresh, serve
from .test_agent_window import open_window

R83 = "2026-10-15_1100_TIM-83_running_sweep"
R30 = "2026-10-08_1120_TIM-52_best_30"
R30B = "2026-10-06_1000_TIM-52_best_30"


@pytest.fixture
def tool_page(page, tmp_path):
    root = make_project(tmp_path / "p")
    with serve(root) as url:
        _fresh(page, url)
        page.root = root
        open_window(page)
        yield page


def mode(page, key):
    page.get_by_test_id("agent-mode").click()
    page.get_by_test_id(f"agent-mode-{key}").click()


def tool(page, name, /, **args):
    """Asks the stand-in to call a tool, and waits until it has answered."""
    n = page.get_by_test_id("agent-msg-agent").count()
    page.get_by_test_id("agent-input").fill(f"[tool {name} {json.dumps(args)}]")
    page.keyboard.press("Enter")
    expect(page.get_by_test_id("agent-msg-agent")).to_have_count(n + 1, timeout=15000)
    return page.get_by_test_id("agent-msg-agent").last


def tool_nowait(page, name, /, **args):
    page.get_by_test_id("agent-input").fill(f"[tool {name} {json.dumps(args)}]")
    page.keyboard.press("Enter")


def tabs(page):
    return page.get_by_test_id("tab-run")


# --- Direkt ---------------------------------------------------------------------------------------------------
def test_direkt_opens_a_tab_at_once_with_an_action_line_and_the_tab_glows(tool_page):
    page = tool_page
    mode(page, "direct")
    tool_nowait(page, "open_run", run="TIM-83")
    expect(tabs(page)).to_have_count(1)
    line = page.get_by_test_id("agent-action")
    expect(line).to_contain_text("Tab geöffnet · TIM-83_running_sweep")
    expect(line.locator(".agent-action-how")).to_have_text("direkt")
    expect(line.get_by_test_id("agent-undo")).to_have_text("Rückgängig")
    expect(tabs(page)).to_have_class(re.compile("agent-glow"))
    assert page.get_by_test_id("agent-confirm").count() == 0


def test_rueckgaengig_and_wiederholen_revert_and_redo_the_action(tool_page):
    page = tool_page
    mode(page, "direct")
    tool(page, "open_run", run="TIM-83")
    page.get_by_test_id("agent-undo").click()
    expect(tabs(page)).to_have_count(0)
    line = page.get_by_test_id("agent-action")
    expect(line).to_contain_text("↶ Tab geschlossen · TIM-83_running_sweep")
    expect(line).to_have_attribute("data-state", "reverted")
    page.get_by_test_id("agent-redo").click()
    expect(tabs(page)).to_have_count(1)
    expect(line).to_have_attribute("data-state", "done")
    # and the line survived on disk in that state
    page.get_by_test_id("agent-undo").click()
    expect(tabs(page)).to_have_count(0)
    chat = next((page.root / ".mlviz" / "chats").glob("*.json"))
    assert json.loads(chat.read_text())["messages"][-2]["state"] == "reverted"


def test_after_a_reload_the_lines_stay_but_without_rueckgaengig(tool_page):
    page = tool_page
    mode(page, "direct")
    tool(page, "open_run", run="TIM-83")
    page.reload()  # the window stays open across a reload
    expect(page.get_by_test_id("agent-window")).to_be_visible()
    expect(page.get_by_test_id("agent-action")).to_contain_text("Tab geöffnet")
    expect(page.get_by_test_id("agent-undo")).to_have_count(0)


def test_the_agent_can_read_what_the_view_shows(tool_page):
    page = tool_page
    mode(page, "direct")
    tool(page, "open_run", run="TIM-83")
    answer = tool(page, "get_view")
    text = answer.inner_text()
    assert '"area":"runs"' in text.replace(" ", "") or '"area": "runs"' in text
    assert R83 in text and "focused_tab" in text


def test_find_runs_answers_without_a_line(tool_page):
    page = tool_page
    answer = tool(page, "find_runs", issue="TIM-52")
    assert '"count": 3' in answer.inner_text()
    expect(page.get_by_test_id("agent-action")).to_have_count(0)


def test_set_run_view_filters_the_table_and_rueckgaengig_removes_the_filter(tool_page):
    page = tool_page
    mode(page, "direct")
    tool(page, "set_run_view", run=R30, filters={"forecaster": ["rep-net"]})
    expect(page.get_by_test_id("agent-action")).to_contain_text("Ansicht eingestellt · forecaster ∈ rep-net")
    expect(page.get_by_label("forecaster ∈ rep-net entfernen")).to_be_visible()
    page.get_by_test_id("agent-undo").click()
    expect(page.get_by_label("forecaster ∈ rep-net entfernen")).to_have_count(0)


def test_set_run_view_with_an_unknown_value_tells_the_agent(tool_page):
    page = tool_page
    mode(page, "direct")
    answer = tool(page, "set_run_view", run=R30, filters={"forecaster": ["gibt-es-nicht"]})
    assert "kennt gibt-es-nicht nicht" in answer.inner_text() or "kennt" in answer.inner_text()
    expect(page.get_by_test_id("agent-info").last).to_contain_text("gibt-es-nicht")


# --- Gemischt -----------------------------------------------------------------------------------------------------
def test_gemischt_runs_navigation_at_once_but_asks_before_a_change(tool_page):
    page = tool_page
    mode(page, "mixed")
    tool(page, "open_analysis", scope="project")
    expect(page.get_by_test_id("analysis-view")).to_have_attribute("data-view", "project")
    tool(page, "open_analysis", scope="one", runs=[R30])
    expect(page.get_by_test_id("analysis-view")).to_have_attribute("data-view", "run")
    expect(page.get_by_test_id("widget-tile").first).to_be_visible()
    n = page.get_by_test_id("widget-tile").count()
    tool_nowait(page, "add_widget", type="per-region")
    card = page.get_by_test_id("agent-confirm")
    expect(card).to_contain_text("Bestätigen")
    expect(card).to_contain_text("Widget hinzufügen · per-region")
    expect(card.get_by_test_id("agent-confirm-ok")).to_have_text("Ausführen")
    assert page.get_by_test_id("widget-tile").count() == n  # nothing changed before the click
    card.get_by_test_id("agent-confirm-ok").click()
    expect(page.get_by_test_id("agent-action").last).to_contain_text("Widget hinzugefügt")
    expect(page.get_by_test_id("widget-tile")).to_have_count(n + 1)
    expect(page.get_by_test_id("agent-confirm")).to_have_count(0)  # the card became the line
    page.get_by_test_id("agent-undo").last.click()
    expect(page.get_by_test_id("widget-tile")).to_have_count(n)


def test_ablehnen_changes_nothing_and_the_agent_goes_on(tool_page):
    page = tool_page
    mode(page, "mixed")
    tool(page, "open_analysis", scope="one", runs=[R30])
    expect(page.get_by_test_id("widget-tile").first).to_be_visible()
    n = page.get_by_test_id("widget-tile").count()
    tool_nowait(page, "remove_widget", widget="stability")
    page.get_by_test_id("agent-confirm-no").click()
    expect(page.get_by_test_id("agent-action").last).to_contain_text("Abgelehnt · Widget entfernen · stability")
    expect(page.get_by_test_id("agent-action").last).to_have_attribute("data-state", "rejected")
    expect(page.get_by_test_id("agent-msg-agent").last).to_contain_text("abgelehnt")
    assert page.get_by_test_id("widget-tile").count() == n


def test_enter_on_the_last_card_executes_it(tool_page):
    page = tool_page
    mode(page, "mixed")
    tool(page, "open_analysis", scope="one", runs=[R30])
    expect(page.get_by_test_id("widget-tile").first).to_be_visible()
    n = page.get_by_test_id("widget-tile").count()
    tool_nowait(page, "remove_widget", widget="stability")
    expect(page.get_by_test_id("agent-confirm")).to_be_visible()
    page.get_by_test_id("agent-input").focus()
    page.keyboard.press("Enter")
    expect(page.get_by_test_id("widget-tile")).to_have_count(n - 1)


def test_a_new_message_rejects_an_open_card_and_is_handled(tool_page):
    page = tool_page
    mode(page, "mixed")
    tool(page, "open_analysis", scope="one", runs=[R30])
    expect(page.get_by_test_id("widget-tile").first).to_be_visible()
    n = page.get_by_test_id("widget-tile").count()
    tool_nowait(page, "remove_widget", widget="stability")
    expect(page.get_by_test_id("agent-confirm")).to_be_visible()
    page.get_by_test_id("agent-input").fill("Hallo zwischendurch")
    page.keyboard.press("Enter")
    expect(page.get_by_test_id("agent-action").last).to_have_attribute("data-state", "rejected")
    expect(page.get_by_test_id("agent-msg-agent").last).to_have_text("Antwort auf: Hallo zwischendurch", timeout=15000)
    assert page.get_by_test_id("widget-tile").count() == n


def test_configure_move_and_resize_a_widget_with_undo(tool_page):
    page = tool_page
    mode(page, "direct")
    tool(page, "open_analysis", scope="one", runs=[R30])
    order = lambda: page.get_by_test_id("widget-tile").evaluate_all("els => els.map(e => e.dataset.widget)")
    expect(page.get_by_test_id("widget-tile").first).to_be_visible()
    first = order()[0]
    tool(page, "move_widget", widget=order()[1], direction="up")
    assert order()[0] != first
    page.get_by_test_id("agent-undo").last.click()
    assert order()[0] == first
    tile = page.locator('[data-testid="widget-tile"][data-widget="per-region"]')
    tool(page, "resize_widget", widget="per-region", width="full")
    expect(tile).to_have_attribute("data-width", "full")
    page.get_by_test_id("agent-undo").last.click()
    expect(tile).to_have_attribute("data-width", "half")
    tool(page, "configure_widget", widget="axis-effect", settings={"nope": "x"})
    expect(page.get_by_test_id("agent-info").last).to_contain_text("kennt nope nicht")


# --- Bestätigen ---------------------------------------------------------------------------------------------------
def test_bestaetigen_asks_even_for_navigation(tool_page):
    page = tool_page
    mode(page, "confirm")
    tool_nowait(page, "show_runs", view="issues")
    expect(page.get_by_test_id("agent-confirm")).to_contain_text("Läufe · Issues")
    page.get_by_test_id("agent-confirm-ok").click()
    expect(page.get_by_test_id("agent-action")).to_contain_text("Läufe · Issues")
    expect(page.get_by_test_id("agent-action").locator(".agent-action-how")).to_have_count(0)  # not "direkt": Tim said yes


# --- run cards ----------------------------------------------------------------------------------------------------
def test_several_matching_runs_become_cards_and_the_click_continues(tool_page):
    page = tool_page
    mode(page, "direct")
    tool_nowait(page, "choose_run", question="TIM-52, welcher?", runs=[R30, R30B])
    cards = page.get_by_test_id("agent-run-card")
    expect(cards).to_have_count(2)
    expect(page.get_by_test_id("agent-choice")).to_contain_text("TIM-52, welcher?")
    expect(cards.first).to_contain_text("2026-10-08")
    cards.nth(1).click()
    expect(page.get_by_test_id("agent-msg-agent").last).to_contain_text(R30B, timeout=15000)
    expect(page.get_by_test_id("agent-action").last).to_contain_text("Lauf gewählt · ")


# --- save ---------------------------------------------------------------------------------------------------------
def test_saving_shows_the_target_on_the_card_writes_files_and_rueckgaengig_deletes_them(tool_page):
    page = tool_page
    mode(page, "mixed")
    tool(page, "open_analysis", scope="one", runs=[R30])
    tool_nowait(page, "save_deliverable", title="Agent-Meeting", widgets=["compare-table"])
    card = page.get_by_test_id("agent-confirm")
    expect(card.get_by_test_id("agent-confirm-detail")).to_contain_text("Ziel: deliverables/2026-10-15 Agent-Meeting/")
    expect(card.get_by_test_id("agent-confirm-ok")).to_have_text("Speichern")
    out = page.root / "deliverables" / "2026-10-15 Agent-Meeting"
    assert not out.exists()
    card.get_by_test_id("agent-confirm-ok").click()
    expect(page.get_by_test_id("agent-action").last).to_contain_text("Gespeichert · 1 Bild → deliverables/2026-10-15 Agent-Meeting/", timeout=20000)
    assert (out / "01_compare-table.png").read_bytes()[:4] == b"\x89PNG" and (out / "README.md").exists()
    page.get_by_test_id("agent-undo").last.click()
    expect(page.get_by_test_id("agent-action").last).to_contain_text("Gespeichertes gelöscht")
    assert not out.exists()


def test_rueckgaengig_of_a_save_keeps_a_file_that_changed(tool_page):
    page = tool_page
    mode(page, "direct")
    tool(page, "open_analysis", scope="one", runs=[R30])
    tool(page, "save_deliverable", title="Geändert", widgets=["compare-table"])
    out = page.root / "deliverables" / "2026-10-15 Geändert"
    expect(page.get_by_test_id("agent-action").last).to_contain_text("Gespeichert")
    (out / "README.md").write_text("von Hand ergänzt")
    page.get_by_test_id("agent-undo").last.click()
    expect(page.get_by_test_id("agent-action").last).to_contain_text("Datei wurde inzwischen geändert, nicht gelöscht")
    assert (out / "README.md").read_text() == "von Hand ergänzt" and not (out / "01_compare-table.png").exists()


# --- templates and drafts ------------------------------------------------------------------------------------------
def test_the_agent_saves_and_applies_a_template(tool_page):
    page = tool_page
    mode(page, "direct")
    tool(page, "open_analysis", scope="one", runs=[R30])
    tool(page, "remove_widget", widget="stability")
    tool(page, "save_template", name="Ohne Stabilität")
    expect(page.get_by_test_id("template-current")).to_have_text("Ohne Stabilität")
    n = page.get_by_test_id("widget-tile").count()
    tool(page, "apply_template", name="Standard")
    expect(page.get_by_test_id("template-current")).to_have_text("Standard")
    assert page.get_by_test_id("widget-tile").count() == n + 1
    page.get_by_test_id("agent-undo").last.click()  # back to the board before
    expect(page.get_by_test_id("widget-tile")).to_have_count(n)
    answer = tool(page, "apply_template", name="gibt-es-nicht")
    assert "Keine Vorlage" in answer.inner_text()


def test_the_agent_drafts_a_widget_and_keeps_it(tool_page):
    page = tool_page
    mode(page, "mixed")
    tool(page, "open_analysis", scope="one", runs=[R30])
    definition = {
        "name": "MAPE je Region", "question": "Wie verteilt sich der Fehler?", "scope": "one", "width": "half",
        "data": {"source": "channels", "filter": {}},
        "spec": {"mark": "bar", "encoding": {"x": {"field": "channel", "type": "nominal"}, "y": {"aggregate": "mean", "field": "test_mape", "type": "quantitative"}}},
    }
    tool(page, "draft_widget", definition=definition)  # a draft is navigation: no card in Gemischt
    expect(page.get_by_test_id("draft")).to_be_visible()
    tool_nowait(page, "keep_draft")
    page.get_by_test_id("agent-confirm-ok").click()
    expect(page.get_by_test_id("draft")).to_have_count(0)
    assert (page.root / ".mlviz" / "widgets" / "mape-je-region.json").exists()
    expect(page.get_by_test_id("agent-action").last).to_contain_text("Eigenes Widget behalten · MAPE je Region")
    page.get_by_test_id("agent-undo").last.click()
    expect(page.get_by_test_id("draft")).to_be_visible()
    assert not (page.root / ".mlviz" / "widgets" / "mape-je-region.json").exists()


def test_an_invalid_draft_is_refused_with_reasons(tool_page):
    page = tool_page
    mode(page, "direct")
    tool(page, "open_analysis", scope="one", runs=[R30])
    answer = tool(page, "draft_widget", definition={"name": "kaputt", "spec": {"mark": "arc"}})
    assert "nicht gültig" in answer.inner_text()
    expect(page.get_by_test_id("draft")).to_have_count(0)


def test_unknown_widgets_and_runs_are_reported_to_the_agent(tool_page):
    page = tool_page
    mode(page, "direct")
    tool(page, "open_analysis", scope="one", runs=[R30])
    assert "Unbekanntes Widget" in tool(page, "add_widget", type="gibt-es-nicht").inner_text()
    assert "Kein Widget" in tool(page, "remove_widget", widget="gibt-es-nicht").inner_text()
    assert "Mehrere Läufe passen" in tool(page, "open_run", run="TIM-52").inner_text()


# --- v0.2.2 · help ----------------------------------------------------------------------------------
def test_help_answers_through_the_mcp_server_without_an_action_line(tool_page):
    page = tool_page
    reply = tool(page, "help", topic="modi")
    expect(reply).to_contain_text("help: # Modi und Bestätigungen")
    expect(page.get_by_test_id("agent-action")).to_have_count(0)  # a look-up is not an action
    reply = tool(page, "help")
    expect(reply).to_contain_text("Themen der Agent-Hilfe")
    reply = tool(page, "help", topic="nix")
    expect(reply).to_contain_text("Kein Thema")
