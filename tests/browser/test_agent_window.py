"""Feature A (agent window) in the browser: icon, window, capsule, drag, resize, chats, mode."""

import re

from playwright.sync_api import expect

from .helpers import folder, open_run

W, H = 1440, 900  # viewport of the tests; the tool fills it
ICON_BAR, TAB_STRIP = 52, 36


def box(page, testid):
    return page.get_by_test_id(testid).bounding_box()


def window(page):
    return page.get_by_test_id("agent-window")


def open_window(page):
    page.get_by_test_id("agent-icon").click()
    expect(window(page)).to_be_visible()


def drag(page, testid, dx, dy):
    b = box(page, testid)
    x, y = b["x"] + (b["width"] - 6 if testid == "agent-resize" else 150), b["y"] + (b["height"] - 6 if testid == "agent-resize" else 19)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + dx / 2, y + dy / 2, steps=4)
    page.mouse.move(x + dx, y + dy, steps=4)
    page.mouse.up()


# --- icon, window, capsule ---------------------------------------------------------------------------
def test_the_agent_icon_sits_at_the_bottom_of_the_icon_bar_and_the_window_is_closed(agent_page):
    page = agent_page
    icon = box(page, "agent-icon")
    assert icon["y"] > H - 90 and icon["x"] < ICON_BAR
    expect(window(page)).to_have_count(0)
    expect(page.get_by_test_id("agent-capsule")).to_have_count(0)


def test_the_first_opening_is_400_by_520_and_24px_from_the_bottom_right_corner(agent_page):
    page = agent_page
    open_window(page)
    b = box(page, "agent-window")
    assert (round(b["width"]), round(b["height"])) == (400, 520)
    assert round(W - (b["x"] + b["width"])) == 24 and round(H - (b["y"] + b["height"])) == 24


def test_the_icon_minimises_an_open_window_and_opens_a_closed_or_minimised_one(agent_page):
    page = agent_page
    open_window(page)
    page.get_by_test_id("agent-icon").click()
    expect(window(page)).to_have_count(0)
    expect(page.get_by_test_id("agent-capsule")).to_be_visible()
    page.get_by_test_id("agent-icon").click()
    expect(window(page)).to_be_visible()
    page.get_by_test_id("agent-close").click()
    expect(window(page)).to_have_count(0)
    expect(page.get_by_test_id("agent-capsule")).to_have_count(0)
    page.get_by_test_id("agent-icon").click()
    expect(window(page)).to_be_visible()


def test_the_icon_is_lit_while_the_window_is_open_or_minimised_and_not_when_closed(agent_page):
    page = agent_page
    icon = page.get_by_test_id("agent-icon")
    expect(icon).not_to_have_class(re.compile("active"))
    icon.click()
    expect(icon).to_have_class(re.compile("active"))
    page.get_by_test_id("agent-min").click()
    expect(icon).to_have_class(re.compile("active"))
    page.get_by_test_id("agent-capsule-open").click()
    page.get_by_test_id("agent-close").click()
    expect(icon).not_to_have_class(re.compile("active"))


def test_the_capsule_shows_ready_and_opens_the_window_again_where_it_was(agent_page):
    page = agent_page
    open_window(page)
    drag(page, "agent-header", -300, -100)
    before = box(page, "agent-window")
    page.get_by_test_id("agent-min").click()
    capsule = page.get_by_test_id("agent-capsule")
    expect(capsule).to_contain_text("Agent · bereit")
    cb = box(page, "agent-capsule")
    assert round(W - (cb["x"] + cb["width"])) == 20 and round(H - (cb["y"] + cb["height"])) == 20
    page.get_by_test_id("agent-capsule-open-text").click()
    assert box(page, "agent-window") == before
    page.get_by_test_id("agent-min").click()
    page.get_by_test_id("agent-capsule-open").click()
    assert box(page, "agent-window") == before


def test_escape_closes_the_window_but_keeps_the_chats(agent_page):
    page = agent_page
    open_window(page)
    page.get_by_test_id("agent-input").fill("Hallo")
    page.keyboard.press("Enter")
    expect(page.get_by_test_id("agent-msg-user")).to_have_text("Hallo")
    page.keyboard.press("Escape")
    expect(window(page)).to_have_count(0)
    page.get_by_test_id("agent-icon").click()
    expect(page.get_by_test_id("agent-msg-user")).to_have_text("Hallo")


def test_the_microphone_is_disabled_with_a_tooltip_in_the_window_and_the_capsule(agent_page):
    page = agent_page
    open_window(page)
    mic = page.get_by_test_id("agent-mic")
    expect(mic).to_be_disabled()
    expect(mic).to_have_attribute("title", "Sprache kommt in einem späteren Update")
    page.get_by_test_id("agent-min").click()
    mic = page.get_by_test_id("agent-mic")
    expect(mic).to_be_disabled()
    expect(mic).to_have_attribute("title", "Sprache kommt in einem späteren Update")


# --- drag and resize -----------------------------------------------------------------------------------
def test_dragging_the_header_moves_the_window(agent_page):
    page = agent_page
    open_window(page)
    before = box(page, "agent-window")
    drag(page, "agent-header", -200, -80)
    after = box(page, "agent-window")
    assert round(after["x"] - before["x"]) == -200 and round(after["y"] - before["y"]) == -80
    assert (after["width"], after["height"]) == (before["width"], before["height"])


def test_the_window_stays_right_of_the_icon_bar_and_below_the_tab_strip(agent_page):
    page = agent_page
    open_window(page)
    drag(page, "agent-header", -3000, -3000)
    b = box(page, "agent-window")
    assert b["x"] >= ICON_BAR and b["y"] >= TAB_STRIP
    drag(page, "agent-header", 5000, 5000)
    b = box(page, "agent-window")
    assert b["x"] + b["width"] <= W and b["y"] + b["height"] <= H


def test_dragging_the_corner_resizes_with_a_minimum_and_never_beyond_the_tool(agent_page):
    page = agent_page
    open_window(page)
    drag(page, "agent-header", -400, -200)  # make room to the left and top
    before = box(page, "agent-window")
    drag(page, "agent-resize", 60, 40)
    b = box(page, "agent-window")
    assert (round(b["width"]), round(b["height"])) == (round(before["width"] + 60), round(before["height"] + 40))
    drag(page, "agent-resize", -2000, -2000)
    b = box(page, "agent-window")
    assert (round(b["width"]), round(b["height"])) == (320, 280)
    drag(page, "agent-resize", 5000, 5000)
    b = box(page, "agent-window")
    assert b["x"] + b["width"] <= W and b["y"] + b["height"] <= H


def test_position_size_and_state_survive_a_reload(agent_page):
    page = agent_page
    open_window(page)
    drag(page, "agent-header", -250, -120)
    drag(page, "agent-resize", 40, 30)
    before = box(page, "agent-window")
    page.reload()
    expect(window(page)).to_be_visible()
    assert box(page, "agent-window") == before
    page.get_by_test_id("agent-min").click()
    page.reload()
    expect(page.get_by_test_id("agent-capsule")).to_be_visible()
    page.get_by_test_id("agent-capsule-open").click()
    page.get_by_test_id("agent-close").click()
    page.reload()
    page.get_by_test_id("project-badge").wait_for()
    expect(window(page)).to_have_count(0)
    expect(page.get_by_test_id("agent-capsule")).to_have_count(0)


def test_a_smaller_tool_pushes_and_shrinks_the_window_to_fit(agent_page):
    page = agent_page
    open_window(page)
    page.set_viewport_size({"width": 700, "height": 500})
    page.wait_for_timeout(200)
    b = box(page, "agent-window")
    assert b["x"] >= ICON_BAR and b["y"] >= TAB_STRIP
    assert b["x"] + b["width"] <= 700 and b["y"] + b["height"] <= 500


# --- context chip -------------------------------------------------------------------------------------
def test_the_context_chip_follows_the_view(agent_page):
    page = agent_page
    open_window(page)
    chip = page.get_by_test_id("agent-context")
    expect(chip).to_have_text("Läufe · Liste")
    page.get_by_test_id("view-issues").click()
    expect(chip).to_have_text("Läufe · Issues")
    page.get_by_test_id("area-analysis").click()
    expect(chip).to_have_text("Analyse")
    page.get_by_test_id("area-runs").click()
    page.get_by_test_id("view-list").click()
    expect(chip).to_have_text("Läufe · Liste")


def test_the_context_chip_names_the_open_run_without_its_timestamp(page):
    open_run(page, folder("TIM-52_best_30", 0))
    page.get_by_test_id("agent-icon").click()
    expect(page.get_by_test_id("agent-context")).to_have_text("Lauf · TIM-52_best_30")
    page.get_by_test_id("tab-pinned").click()
    expect(page.get_by_test_id("agent-context")).to_have_text("Läufe · Issues")


# --- chats --------------------------------------------------------------------------------------------
def test_a_message_is_appended_to_the_chat_which_is_named_after_it(agent_page):
    page = agent_page
    open_window(page)
    expect(page.get_by_test_id("agent-chats-button")).to_contain_text("Neuer Chat")
    page.get_by_test_id("agent-input").fill("Öffne das Experiment von gestern")
    page.get_by_test_id("agent-send").click()
    expect(page.get_by_test_id("agent-msg-user")).to_have_text("Öffne das Experiment von gestern")
    expect(page.get_by_test_id("agent-chats-button")).to_contain_text("Öffne das Experiment von gestern")
    expect(page.get_by_test_id("agent-input")).to_have_value("")


def test_an_empty_message_is_not_sent(agent_page):
    page = agent_page
    open_window(page)
    page.get_by_test_id("agent-input").fill("   ")
    page.keyboard.press("Enter")
    expect(page.get_by_test_id("agent-msg-user")).to_have_count(0)


def test_plus_starts_a_new_chat_and_the_chat_list_switches_between_chats(agent_page):
    page = agent_page
    open_window(page)
    page.get_by_test_id("agent-input").fill("Erster Chat")
    page.keyboard.press("Enter")
    expect(page.get_by_test_id("agent-msg-user")).to_have_text("Erster Chat")
    page.get_by_test_id("agent-new").click()
    expect(page.get_by_test_id("agent-chats-button")).to_contain_text("Neuer Chat")
    expect(page.get_by_test_id("agent-msg-user")).to_have_count(0)
    page.get_by_test_id("agent-input").fill("Zweiter Chat")
    page.keyboard.press("Enter")
    expect(page.get_by_test_id("agent-msg-user")).to_have_text("Zweiter Chat")
    page.get_by_test_id("agent-chats-button").click()
    rows = page.get_by_test_id("agent-chat-row")
    expect(rows).to_have_count(2)
    expect(rows.nth(0)).to_contain_text("Zweiter Chat")  # newest first
    expect(rows.nth(0)).to_contain_text("heute")
    expect(rows.nth(1)).to_contain_text("Erster Chat")
    expect(rows.nth(0)).to_have_class(re.compile("current"))
    rows.nth(1).click()
    expect(page.get_by_test_id("agent-chat-list")).to_have_count(0)
    expect(page.get_by_test_id("agent-msg-user")).to_have_text("Erster Chat")


def test_plus_on_an_empty_chat_does_not_pile_up_empty_chats(agent_page):
    page = agent_page
    open_window(page)
    page.get_by_test_id("agent-new").click()
    page.get_by_test_id("agent-new").click()
    page.get_by_test_id("agent-chats-button").click()
    expect(page.get_by_test_id("agent-chat-row")).to_have_count(1)  # one empty chat, not two


def test_chats_and_the_current_chat_survive_a_reload(agent_page):
    page = agent_page
    open_window(page)
    page.get_by_test_id("agent-input").fill("Bleibt")
    page.keyboard.press("Enter")
    expect(page.get_by_test_id("agent-msg-user")).to_have_text("Bleibt")
    page.reload()
    expect(page.get_by_test_id("agent-msg-user")).to_have_text("Bleibt")
    expect(page.get_by_test_id("agent-chats-button")).to_contain_text("Bleibt")


def test_a_new_chat_shows_empty_context_and_cache_chip(agent_page):
    page = agent_page
    open_window(page)
    expect(page.get_by_test_id("agent-context-meter")).to_contain_text("0 %")
    expect(page.get_by_test_id("agent-cache")).to_have_text("neu")


def test_the_chat_list_closes_on_a_click_elsewhere(agent_page):
    page = agent_page
    open_window(page)
    page.get_by_test_id("agent-chats-button").click()
    expect(page.get_by_test_id("agent-chat-list")).to_be_visible()
    page.get_by_test_id("agent-messages").click()
    expect(page.get_by_test_id("agent-chat-list")).to_have_count(0)


# --- mode ---------------------------------------------------------------------------------------------
def test_the_mode_menu_lists_three_modes_and_the_choice_is_kept(agent_page):
    page = agent_page
    open_window(page)
    mode = page.get_by_test_id("agent-mode")
    expect(mode).to_contain_text("Gemischt")  # default of a new project
    mode.click()
    menu = page.get_by_test_id("agent-mode-menu")
    expect(menu).to_contain_text("Direkt")
    expect(menu).to_contain_text("Gemischt")
    expect(menu).to_contain_text("Bestätigen")
    expect(menu).to_contain_text("Handelt sofort. Jede Aktion lässt sich rückgängig machen.")
    page.get_by_test_id("agent-mode-direct").click()
    expect(menu).to_have_count(0)
    expect(mode).to_contain_text("Direkt")
    expect(page.locator(".agent-mode-row")).to_contain_text("handelt ohne Rückfrage")
    page.reload()
    expect(page.get_by_test_id("agent-mode")).to_contain_text("Direkt")


def test_shift_tab_in_the_input_cycles_the_mode(agent_page):
    page = agent_page
    open_window(page)
    page.get_by_test_id("agent-input").focus()
    expect(page.get_by_test_id("agent-mode")).to_contain_text("Gemischt")
    page.keyboard.press("Shift+Tab")
    expect(page.get_by_test_id("agent-mode")).to_contain_text("Bestätigen")
    page.keyboard.press("Shift+Tab")
    expect(page.get_by_test_id("agent-mode")).to_contain_text("Direkt")
    page.keyboard.press("Shift+Tab")
    expect(page.get_by_test_id("agent-mode")).to_contain_text("Gemischt")
    expect(page.get_by_test_id("agent-input")).to_be_focused()
