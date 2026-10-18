"""Feature C (v0.3.0): the command palette, in the browser."""

import re

import pytest
from playwright.sync_api import expect


@pytest.fixture
def pp(writable_page):
    (writable_page.writable_root / ".mlviz" / "settings.json").unlink(missing_ok=True)
    writable_page.evaluate("localStorage.removeItem('mlviz:v1:palette-recent')")
    writable_page.reload()
    expect(writable_page.get_by_test_id("palette-box")).to_be_visible()
    return writable_page


def items(page):
    return page.get_by_test_id("palette-item")


def type_in(page, text):
    page.get_by_test_id("palette-input").fill(text)


def test_the_search_box_shows_the_project_and_opens_the_palette(pp):
    expect(pp.get_by_test_id("palette-box")).to_have_text("Demo Bench")
    pp.get_by_test_id("palette-box").click()
    expect(pp.get_by_test_id("palette")).to_be_visible()
    expect(pp.get_by_test_id("palette-input")).to_be_focused()
    expect(pp.get_by_test_id("palette-input")).to_have_value("")
    expect(pp.get_by_text("zuletzt geöffnet")).to_be_visible()
    expect(items(pp)).to_have_count(8)  # 5 runs, 3 issues


def test_keys_open_it_in_a_mode_and_escape_closes_it(pp):
    pp.keyboard.press("Control+Shift+P")
    expect(pp.get_by_test_id("palette-input")).to_have_value(">")
    pp.keyboard.press("Escape")
    expect(pp.get_by_test_id("palette")).to_have_count(0)
    pp.keyboard.press("F1")
    expect(pp.get_by_test_id("palette-input")).to_have_value(">")
    pp.keyboard.press("Escape")
    pp.keyboard.press("Control+p")
    expect(pp.get_by_test_id("palette-input")).to_have_value("")


def test_commands_list_recent_ones_first(pp):
    pp.keyboard.press("F1")
    expect(pp.get_by_text("weitere Befehle")).to_be_visible()
    type_in(pp, ">dichte")
    items(pp).first.click()
    expect(pp.locator("html")).to_have_attribute("data-density", "compact")
    pp.keyboard.press("F1")
    expect(pp.get_by_text("zuletzt verwendet")).to_be_visible()
    expect(items(pp).first).to_contain_text("Dichte umschalten")


def test_letters_that_start_words_match_and_are_highlighted(pp):
    pp.keyboard.press("F1")
    type_in(pp, ">zl")
    expect(items(pp).first).to_contain_text("Zwei Läufe vergleichen")
    expect(items(pp).first.locator("mark")).to_have_count(2)


def test_arrow_keys_wrap_and_enter_runs(pp):
    pp.keyboard.press("F1")
    type_in(pp, ">liste")
    pp.keyboard.press("ArrowUp")  # wraps to the last item, the agent question
    expect(items(pp).last).to_have_attribute("data-selected", "true")
    pp.keyboard.press("ArrowDown")
    pp.keyboard.press("Enter")
    expect(pp.get_by_test_id("palette")).to_have_count(0)


def test_a_run_is_opened_from_the_list(pp):
    pp.keyboard.press("Control+p")
    type_in(pp, "running_sweep")
    expect(items(pp)).to_have_count(2)  # the run and the question to the agent (the runs load while the palette opens)
    items(pp).first.click()
    expect(pp.get_by_test_id("tab-run")).to_have_count(1)
    expect(pp.get_by_test_id("tab-run")).to_have_attribute("data-run", re.compile("running_sweep"))


def test_a_command_with_dots_opens_a_second_step_and_back_returns(pp):
    pp.keyboard.press("F1")
    type_in(pp, ">lauf öffnen")
    pp.keyboard.press("Enter")
    expect(pp.get_by_test_id("palette-back")).to_be_visible()
    expect(pp.get_by_test_id("palette-input")).to_have_value("")
    pp.keyboard.press("Backspace")
    expect(pp.get_by_test_id("palette-input")).to_have_value(">")
    expect(pp.get_by_test_id("palette-back")).to_have_count(0)


def test_two_runs_compare_in_a_step(pp):
    pp.keyboard.press("F1")
    type_in(pp, ">zwei")
    pp.keyboard.press("Enter")
    expect(items(pp).nth(1)).to_be_visible()  # the runs are loaded
    items(pp).nth(1).click()
    expect(pp.get_by_test_id("tab-pinned")).to_have_text("Analyse")


def test_disabled_commands_are_listed_with_a_note(pp):
    pp.keyboard.press("F1")
    type_in(pp, ">filter")
    expect(items(pp).first).to_have_attribute("aria-disabled", "true")
    expect(items(pp).first).to_contain_text("nur im Lauf-Tab")
    pp.keyboard.press("Enter")
    expect(pp.get_by_test_id("palette")).to_be_visible()  # nothing happened


def test_settings_prefix_opens_the_tab_at_the_row(pp):
    pp.keyboard.press("Control+p")
    type_in(pp, "@Auflösung")
    expect(items(pp).first).to_contain_text("Export")
    pp.keyboard.press("Enter")
    expect(pp.get_by_test_id("settings")).to_be_visible()
    expect(pp.locator('[data-key="exp.scale"]')).to_have_class(re.compile("flash"))
    expect(pp.get_by_test_id("cat-export")).to_have_class(re.compile("active"))


def test_the_question_mark_lists_the_prefixes(pp):
    pp.keyboard.press("Control+p")
    type_in(pp, "?")
    expect(items(pp)).to_have_count(3)
    items(pp).nth(1).click()
    expect(pp.get_by_test_id("palette-input")).to_have_value(">")


def test_what_matches_nothing_goes_to_the_agent(pp):
    pp.keyboard.press("F1")
    type_in(pp, ">wie war der Lauf gestern")
    expect(items(pp)).to_have_count(1)
    expect(items(pp).first).to_contain_text("Agent fragen")
    expect(items(pp).first).to_contain_text("kein Befehl passt")
    pp.keyboard.press("Enter")
    expect(pp.get_by_test_id("agent-window")).to_be_visible()


def test_ctrl_j_toggles_the_agent_and_ctrl_plus_sets_the_size(pp):
    pp.keyboard.press("Control+j")
    expect(pp.get_by_test_id("agent-window")).to_be_visible()
    pp.keyboard.press("Control+j")
    expect(pp.get_by_test_id("agent-window")).to_have_count(0)
    pp.keyboard.press("Control+Equal")
    expect(pp.locator("html")).to_have_css("zoom", "1.05")
    pp.keyboard.press("Control+Minus")
    pp.keyboard.press("Control+Minus")
    expect(pp.locator("html")).to_have_css("zoom", "0.95")


def test_shortcut_help_lists_the_keys(pp):
    pp.keyboard.press("F1")
    type_in(pp, ">tastenkürzel")
    pp.keyboard.press("Enter")
    expect(pp.get_by_test_id("palette")).to_contain_text("Ctrl+Shift+P")
