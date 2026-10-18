"""Feature A (v0.3.0): the settings screen, in the browser, on a project copy of its own."""

import json
import re

import pytest
from playwright.sync_api import expect


@pytest.fixture
def sp(writable_page):
    """The page with a clean settings file."""
    (writable_page.writable_root / ".mlviz" / "settings.json").unlink(missing_ok=True)
    writable_page.reload()
    return writable_page


def file_of(page):
    path = page.writable_root / ".mlviz" / "settings.json"
    return json.loads(path.read_text()) if path.exists() else None


def expect_file(page, value):
    """The file has this content soon (the server writes it while the screen already shows the change)."""
    for _ in range(50):
        if file_of(page) == value:
            return
        page.wait_for_timeout(100)
    assert file_of(page) == value


def row(page, key):
    return page.locator(f'[data-testid="setting-row"][data-key="{key}"]')


def open_settings(page):
    page.get_by_test_id("settings-icon").click()
    expect(page.get_by_test_id("settings")).to_be_visible()


def test_the_gear_opens_a_tab_and_lights_up(sp):
    open_settings(sp)
    expect(sp.get_by_test_id("tab-settings")).to_have_class(re.compile("active"))
    expect(sp.get_by_test_id("settings-icon")).to_have_class(re.compile("active"))
    sp.get_by_test_id("area-analysis").click()  # another view: the tab stays open
    expect(sp.get_by_test_id("settings")).to_be_hidden()
    expect(sp.get_by_test_id("tab-settings")).to_be_visible()
    sp.get_by_test_id("tab-settings").click()
    expect(sp.get_by_test_id("settings")).to_be_visible()
    sp.get_by_test_id("settings-close").click()
    expect(sp.get_by_test_id("tab-settings")).to_have_count(0)


def test_ctrl_comma_opens_the_settings(sp):
    expect(sp.get_by_test_id("project-badge")).to_be_visible()  # the app is mounted, the key handler exists
    sp.wait_for_selector("body[data-shortcuts=on]")
    sp.keyboard.press("Control+Comma")
    expect(sp.get_by_test_id("settings")).to_be_visible()


def test_a_change_applies_at_once_and_only_non_defaults_are_written(sp):
    open_settings(sp)
    row(sp, "look.scale").get_by_label("mehr").click()
    expect(row(sp, "look.scale").get_by_test_id("num-value")).to_have_text("105 %")
    expect(row(sp, "look.scale").get_by_test_id("changed-dot")).to_be_visible()
    expect(sp.get_by_test_id("cat-count-look")).to_have_text("1")
    expect_file(sp, {"look.scale": 105})
    expect(sp.locator("html")).to_have_css("zoom", "1.05")
    row(sp, "look.density").get_by_role("radio", name="Kompakt").click()
    expect(sp.locator("html")).to_have_attribute("data-density", "compact")
    row(sp, "look.scale").get_by_test_id("reset").click()
    expect(row(sp, "look.scale").get_by_test_id("changed-dot")).to_have_count(0)
    expect_file(sp, {"look.density": "compact"})


def test_a_change_survives_a_reload(sp):
    open_settings(sp)
    row(sp, "look.motion").get_by_role("switch").click()
    expect(sp.locator("html")).to_have_attribute("data-motion", "off")
    sp.reload()
    expect(sp.locator("html")).to_have_attribute("data-motion", "off")


def test_undo_and_redo_by_button_and_keys(sp):
    open_settings(sp)
    row(sp, "look.scale").get_by_label("mehr").click()
    sp.get_by_test_id("settings-undo").click()
    expect_file(sp, None)
    sp.get_by_test_id("settings-redo").click()
    expect_file(sp, {"look.scale": 105})
    sp.keyboard.press("Control+z")
    expect(row(sp, "look.scale").get_by_test_id("changed-dot")).to_have_count(0)
    sp.keyboard.press("Control+Shift+z")
    expect(row(sp, "look.scale").get_by_test_id("changed-dot")).to_be_visible()


def test_a_preset_is_one_undo_step(sp):
    open_settings(sp)
    sp.get_by_test_id("presets").select_option(label="Große Grids – Kompakt, 90 %, Überblick aus.")
    expect(sp.get_by_test_id("cat-count-look")).to_have_text("2")
    expect_file(sp, {"look.density": "compact", "look.scale": 90, "runs.overview": False})
    sp.get_by_test_id("settings-undo").click()
    expect_file(sp, None)


def test_search_slash_and_the_changed_filter(sp):
    open_settings(sp)
    sp.keyboard.press("/")
    expect(sp.get_by_test_id("settings-search")).to_be_focused()
    sp.keyboard.type("Auflösung")
    expect(sp.get_by_test_id("setting-row")).to_have_count(1)
    expect(row(sp, "exp.scale")).to_be_visible()
    sp.get_by_test_id("settings-search").fill("zzzz")
    expect(sp.get_by_test_id("no-match")).to_have_text("Keine Einstellung zu „zzzz“")
    sp.get_by_test_id("settings-search").fill("")
    sp.get_by_test_id("cat-agent").click()
    row(sp, "agent.debug").get_by_role("switch").click()
    sp.get_by_test_id("only-changed").click()
    expect(sp.get_by_test_id("setting-row")).to_have_count(1)
    expect(sp.get_by_test_id("only-changed")).to_have_text("Geändert 1")


def test_an_unreadable_file_warns_and_is_not_overwritten_until_a_change(sp):
    path = sp.writable_root / ".mlviz" / "settings.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text("{oops")
    sp.reload()
    open_settings(sp)
    expect(sp.get_by_test_id("settings-warning")).to_be_visible()
    assert path.read_text() == "{oops"
    row(sp, "look.scale").get_by_label("mehr").click()
    expect(sp.get_by_test_id("settings-warning")).to_have_count(0)
    expect_file(sp, {"look.scale": 105})


def test_about_shows_version_and_paths(sp):
    open_settings(sp)
    sp.get_by_test_id("cat-about").click()
    expect(sp.get_by_test_id("about")).to_contain_text(".mlviz/settings.json")


def test_all_reset_is_undoable_and_chats_are_deleted_after_confirmation(sp):
    open_settings(sp)
    row(sp, "look.scale").get_by_label("mehr").click()
    sp.get_by_test_id("cat-data").click()
    sp.get_by_test_id("action-data.all").click()
    expect_file(sp, None)
    sp.get_by_test_id("settings-undo").click()
    expect_file(sp, {"look.scale": 105})
    sp.evaluate("fetch('/api/agent/chats', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'})")
    sp.get_by_test_id("action-data.chats").click()
    sp.get_by_test_id("confirm-yes").click()
    expect(sp.get_by_test_id("action-note")).to_contain_text("Chats gelöscht")


def test_settings_reach_the_tool(sp):
    """Number format and the time column follow the settings."""
    open_settings(sp)
    row(sp, "look.decimal").get_by_role("radio", name="412.8").click()
    sp.get_by_test_id("area-runs").click()
    runs = sp.get_by_test_id("runs-view")
    expect(runs).to_contain_text(re.compile(r"\d\.\d\d"))  # 2.83 %, not 2,83 %
    expect(runs).not_to_contain_text(re.compile(r"\d,\d\d"))
