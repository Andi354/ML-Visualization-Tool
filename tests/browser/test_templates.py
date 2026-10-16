"""Feature D (templates): applying, changed state, saving, updating, per scope, first opening."""

import json
import re
import shutil

import pytest
from playwright.sync_api import expect

from .helpers import folder

RUN = folder("TIM-52_best_30", 1)


@pytest.fixture
def tpl_page(writable_page):
    root = writable_page.writable_root
    shutil.rmtree(root / ".mlviz" / "templates.json", ignore_errors=True)
    (root / ".mlviz" / "templates.json").unlink(missing_ok=True)
    return writable_page


def open_board(page):
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("analysis-view-run").click()
    page.get_by_test_id("run-select").select_option(RUN)
    page.get_by_test_id("widget-tile").first.wait_for()


def tiles(page):
    return page.get_by_test_id("widget-tile").evaluate_all("els => els.map(e => e.dataset.widget)")


def save_as(page, name):
    page.get_by_test_id("template-save-open").click()
    if name:
        page.get_by_test_id("template-name").fill(name)
    page.get_by_test_id("template-save").click()
    page.wait_for_function("() => !document.querySelector('[data-testid=template-save-popover]') || !!document.querySelector('[data-testid=template-error]')")


def test_standard_is_current_and_not_dirty_at_first(tpl_page):
    open_board(tpl_page)
    expect(tpl_page.get_by_test_id("template-current")).to_have_text("Standard")
    expect(tpl_page.get_by_test_id("template-dirty")).to_have_count(0)
    expect(tpl_page.get_by_test_id("template-update")).to_have_count(0)
    tpl_page.get_by_test_id("template-menu").click()
    expect(tpl_page.get_by_test_id("template-menu-list")).to_contain_text("Vorlagen für „Ein Lauf“")
    expect(tpl_page.get_by_test_id("template-meta")).to_have_text(["eingebaut"])
    expect(tpl_page.get_by_test_id("template-delete")).to_have_count(0)


def test_changing_the_board_shows_geaendert_and_update_clears_it(tpl_page):
    open_board(tpl_page)
    save_as(tpl_page, "Meeting")
    expect(tpl_page.get_by_test_id("template-current")).to_have_text("Meeting")
    tpl_page.get_by_test_id("tile-remove").first.click()
    expect(tpl_page.get_by_test_id("template-dirty")).to_have_text(re.compile("geändert"))
    tpl_page.get_by_test_id("template-update").click()
    expect(tpl_page.get_by_test_id("template-dirty")).to_have_count(0)
    stored = json.loads((tpl_page.writable_root / ".mlviz" / "templates.json").read_text())["templates"]
    assert len(stored) == 1 and stored[0]["name"] == "Meeting" and stored[0]["scope"] == "one"


def test_standard_cannot_be_updated_and_its_name_is_refused(tpl_page):
    open_board(tpl_page)
    tpl_page.get_by_test_id("tile-remove").first.click()
    expect(tpl_page.get_by_test_id("template-dirty")).to_be_visible()
    expect(tpl_page.get_by_test_id("template-update")).to_have_count(0)
    save_as(tpl_page, "Standard")
    expect(tpl_page.get_by_test_id("template-error")).to_contain_text("eingebaut")


def test_applying_replaces_the_board_and_glows(tpl_page):
    open_board(tpl_page)
    before = tiles(tpl_page)
    tpl_page.get_by_test_id("tile-remove").first.click()
    after = tiles(tpl_page)
    save_as(tpl_page, "Kurz")
    tpl_page.get_by_test_id("template-menu").click()
    tpl_page.locator('[data-testid="template-item"][data-template="Standard"]').click()
    assert tiles(tpl_page) == before
    expect(tpl_page.get_by_test_id("board")).to_have_attribute("data-glow", "true")
    expect(tpl_page.get_by_test_id("board")).to_have_attribute("data-glow", "false", timeout=4000)
    tpl_page.get_by_test_id("template-menu").click()
    tpl_page.locator('[data-testid="template-item"][data-template="Kurz"]').click()
    assert tiles(tpl_page) == after
    expect(tpl_page.get_by_test_id("template-current")).to_have_text("Kurz")


def test_same_name_overwrites_and_empty_name_is_neue_vorlage(tpl_page):
    open_board(tpl_page)
    save_as(tpl_page, "")
    expect(tpl_page.get_by_test_id("template-current")).to_have_text("Neue Vorlage")
    tpl_page.get_by_test_id("tile-remove").first.click()
    save_as(tpl_page, "neue vorlage")
    stored = json.loads((tpl_page.writable_root / ".mlviz" / "templates.json").read_text())["templates"]
    assert len(stored) == 1


def test_hint_names_the_widget_count_and_scope(tpl_page):
    open_board(tpl_page)
    n = len(tiles(tpl_page))
    tpl_page.get_by_test_id("template-save-open").click()
    expect(tpl_page.get_by_test_id("template-save-hint")).to_have_text(f"Speichert die {n} Widgets mit Reihenfolge und Einstellungen, ohne den Lauf. Anwendbar auf jeden Lauf in „Ein Lauf“.")


def test_templates_are_per_scope_and_survive_a_reload(tpl_page):
    open_board(tpl_page)
    save_as(tpl_page, "Nur eins")
    tpl_page.get_by_test_id("analysis-view-project").click()
    tpl_page.get_by_test_id("template-menu").click()
    expect(tpl_page.get_by_test_id("template-item")).to_have_count(1)  # only Standard
    tpl_page.keyboard.press("Escape")
    tpl_page.reload()
    open_board(tpl_page)
    expect(tpl_page.get_by_test_id("template-current")).to_have_text("Nur eins")
    tpl_page.get_by_test_id("template-menu").click()
    expect(tpl_page.get_by_test_id("template-item")).to_have_count(2)
    expect(tpl_page.locator('[data-template="Nur eins"] [data-testid="template-meta"]')).to_contain_text("zuletzt")


def test_delete_a_template_falls_back_to_standard(tpl_page):
    open_board(tpl_page)
    save_as(tpl_page, "Weg")
    tpl_page.get_by_test_id("template-menu").click()
    tpl_page.get_by_test_id("template-delete").click()
    expect(tpl_page.get_by_test_id("template-current")).to_have_text("Standard")
    assert json.loads((tpl_page.writable_root / ".mlviz" / "templates.json").read_text())["templates"] == []


def test_first_opening_of_a_scope_applies_the_template_used_last(tpl_page):
    open_board(tpl_page)
    tpl_page.get_by_test_id("tile-remove").first.click()
    expected = tiles(tpl_page)
    save_as(tpl_page, "Zuletzt")
    # forget the board and the chosen template once, before the app starts (leaving the page would write them again)
    tpl_page.add_init_script(
        "if (!sessionStorage.getItem('wiped')) { sessionStorage.setItem('wiped', '1'); Object.keys(localStorage).filter(k => k.includes(':board:') || k.includes(':template:')).forEach(k => localStorage.removeItem(k)); }"
    )
    tpl_page.reload()
    open_board(tpl_page)
    expect(tpl_page.get_by_test_id("template-current")).to_have_text("Zuletzt")
    assert tiles(tpl_page) == expected
