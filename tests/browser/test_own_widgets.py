"""Feature E (own widgets): the draft, keeping it, the catalog "Eigene", the image export."""

import copy
import json
import re
import shutil

import pytest
from playwright.sync_api import expect

from .helpers import folder

RUN = folder("TIM-52_best_30", 1)
BOARD_KEY = "mlviz:v1:Demo Bench:board:run"

DEFN = {
    "name": "MAPE je Region",
    "question": "Wie verteilt sich der Fehler über die Regionen?",
    "scope": "one",
    "width": "half",
    "title": "MAPE je Region",
    "subtitle": "Mittel über Seeds und Folds",
    "params": [{"name": "model", "label": "Modell", "options": ["rep-net", "ets", "sarima"], "default": "rep-net"}],
    "data": {"source": "channels", "filter": {"forecaster": "{{param.model}}"}},
    "spec": {
        "title": "Modell {{param.model}}",
        "mark": "bar",
        "encoding": {
            "x": {"field": "channel", "type": "nominal", "title": "Region"},
            "y": {"aggregate": "mean", "field": "test_mape", "type": "quantitative", "title": "MAPE"},
            "color": {"field": "channel", "type": "nominal"},
        },
    },
}


@pytest.fixture
def own_page(writable_page):
    """The writable demo project with no own widgets, on the analysis area of one run."""
    root = writable_page.writable_root
    shutil.rmtree(root / ".mlviz" / "widgets", ignore_errors=True)
    return writable_page


def seed_draft(page, definition=DEFN, width="half"):
    """Puts a draft on the board of one run, the way the agent will (the board keeps it in the browser).
    An init script writes it before the app starts, once per tab: leaving the page flushes the board."""
    board = json.dumps({"scope": "run", "widgets": [], "draft": {"definition": definition, "width": width}})
    page.add_init_script(
        f"if (!sessionStorage.getItem('seeded')) {{ localStorage.setItem({json.dumps(BOARD_KEY)}, {json.dumps(board)}); sessionStorage.setItem('seeded', '1'); }}"
    )
    page.reload()
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("run-select").select_option(RUN)
    page.get_by_test_id("draft").wait_for()


def bars(page):
    return page.locator('[data-testid="own-chart"] svg .mark-rect path')


def wait_chart(page, scope="draft"):
    expect(page.locator('[data-testid="own-chart"][data-pending]')).to_have_count(0)


def widths(page):
    board = page.get_by_test_id("analysis-view").bounding_box()["width"]
    box = page.get_by_test_id("draft-box").bounding_box()["width"]
    return box / board


# --- draft ------------------------------------------------------------------------------------------
def test_a_draft_is_the_first_row_labelled_with_its_title_and_drawn_by_the_tool(own_page):
    page = own_page
    seed_draft(page)
    draft = page.get_by_test_id("draft")
    expect(draft).to_contain_text("Entwurf · vom Agenten")
    expect(page.get_by_test_id("draft-title")).to_have_text("MAPE je Region")
    wait_chart(page)
    expect(bars(page)).to_have_count(4)  # one bar per region
    expect(page.locator('[data-testid="own-chart"] svg')).to_contain_text("Modell rep-net")  # param filled in
    assert draft.bounding_box()["y"] < page.get_by_test_id("board").bounding_box()["y"]  # above the tiles


def test_a_half_width_draft_sits_centred_with_hints_a_full_one_fills_the_row(own_page):
    page = own_page
    seed_draft(page)
    assert 0.4 < widths(page) < 0.55
    expect(page.get_by_test_id("draft")).to_contain_text("halbe Breite")
    page.get_by_test_id("draft-width-full").click()
    assert widths(page) > 0.9
    expect(page.get_by_test_id("draft")).not_to_contain_text("halbe Breite")
    page.get_by_test_id("draft-width-half").click()
    assert 0.4 < widths(page) < 0.55


def test_the_description_shows_the_json_read_only_and_toggles_back_to_the_chart(own_page):
    page = own_page
    seed_draft(page)
    page.get_by_test_id("draft-spec").click()
    json_text = page.get_by_test_id("draft-json").inner_text()
    assert json.loads(json_text)["name"] == "MAPE je Region"
    expect(page.locator('[data-testid="own-chart"]')).to_have_count(0)
    page.get_by_test_id("draft-spec").click()
    expect(page.get_by_test_id("draft-json")).to_have_count(0)
    wait_chart(page)
    expect(bars(page)).to_have_count(4)


def test_the_draft_is_kept_for_the_board_over_a_reload_and_discarding_removes_it(own_page):
    page = own_page
    seed_draft(page)
    page.get_by_test_id("draft-width-full").click()
    page.reload()
    page.get_by_test_id("area-analysis").click()
    expect(page.get_by_test_id("draft")).to_have_attribute("data-width", "full")
    page.get_by_test_id("draft-discard").click()
    expect(page.get_by_test_id("draft")).to_have_count(0)
    page.reload()
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("add-widget").wait_for()
    expect(page.get_by_test_id("draft")).to_have_count(0)
    assert not (page.writable_root / ".mlviz" / "widgets").exists()  # nothing was kept


def test_a_description_that_cannot_be_drawn_says_why_and_cannot_be_kept(own_page):
    page = own_page
    bad = copy.deepcopy(DEFN)
    bad["spec"]["mark"] = {"type": "bar", "color": "#ff0000"}
    seed_draft(page, bad)
    expect(page.get_by_test_id("draft").get_by_test_id("widget-unavailable")).to_contain_text("Widget kann nicht gezeichnet werden")
    page.get_by_test_id("draft-keep").click()
    expect(page.get_by_test_id("draft-keep-error")).to_contain_text("Nicht behalten")
    expect(page.get_by_test_id("draft")).to_be_visible()
    assert not (page.writable_root / ".mlviz" / "widgets").exists()


def test_a_draft_for_a_column_the_run_does_not_have_says_so(own_page):
    page = own_page
    odd = copy.deepcopy(DEFN)
    odd["data"]["filter"] = {"nonexistent": "x"}
    seed_draft(page, odd)
    expect(page.get_by_test_id("draft").get_by_test_id("widget-unavailable")).to_contain_text("nonexistent")


# --- keeping ----------------------------------------------------------------------------------------
def keep(page, width="half"):
    seed_draft(page, DEFN, width)
    wait_chart(page)
    page.get_by_test_id("draft-keep").click()
    expect(page.get_by_test_id("draft")).to_have_count(0)


def own_tile(page):
    return page.locator('[data-testid="widget-tile"][data-widget="own:mape-je-region"]')


def test_keeping_saves_the_widget_and_puts_a_tile_in_the_place_of_the_draft(own_page):
    page = own_page
    keep(page)
    saved = page.writable_root / ".mlviz" / "widgets" / "mape-je-region.json"
    assert json.loads(saved.read_text())["question"] == DEFN["question"]
    tile = own_tile(page)
    expect(tile).to_be_visible()
    first = page.get_by_test_id("widget-tile").first
    assert first.get_attribute("data-widget") == "own:mape-je-region"  # at the position of the draft
    expect(tile.locator(".w-label")).to_contain_text("MAPE je Region")
    expect(tile.locator(".own-tag")).to_have_text("eigen")
    wait_chart(page)
    expect(tile.locator('[data-testid="own-chart"] svg .mark-rect path')).to_have_count(4)


def test_a_kept_full_width_draft_keeps_its_width(own_page):
    page = own_page
    keep(page, "full")
    expect(own_tile(page)).to_have_attribute("data-width", "full")


def test_a_kept_widget_has_its_params_and_width_under_einstellen(own_page):
    page = own_page
    keep(page)
    tile = own_tile(page)
    tile.get_by_test_id("tile-settings").click()
    expect(tile.get_by_test_id("tile-settings-row")).to_contain_text("Modell")
    tile.get_by_test_id("set-model-ets").click()
    wait_chart(page)
    expect(tile.locator('[data-testid="own-chart"] svg')).to_contain_text("Modell ets")
    expect(tile.get_by_test_id("tile-settings-row")).to_contain_text("Breite")
    tile.get_by_test_id("set-width-full").click()
    expect(tile).to_have_attribute("data-width", "full")


def test_the_kept_widget_works_like_a_built_in_one_move_remove_and_reload(own_page):
    page = own_page
    seed_draft(page)
    page.get_by_test_id("add-widget").click()
    page.get_by_test_id("add-widget-item").first.click()  # a built-in tile besides the own one
    wait_chart(page)
    page.get_by_test_id("draft-keep").click()
    expect(page.get_by_test_id("draft")).to_have_count(0)
    own_tile(page).get_by_test_id("tile-down").click()
    order = page.get_by_test_id("widget-tile").evaluate_all("els => els.map(e => e.dataset.widget)")
    assert order[1] == "own:mape-je-region"
    page.reload()
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("run-select").select_option(RUN)
    expect(own_tile(page)).to_be_visible()
    own_tile(page).get_by_test_id("tile-remove").click()
    expect(own_tile(page)).to_have_count(0)
    assert (page.writable_root / ".mlviz" / "widgets" / "mape-je-region.json").is_file()  # still in the catalog


def test_the_widget_menu_lists_builtin_widgets_under_katalog_and_own_ones_under_eigene(own_page):
    page = own_page
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("add-widget").click()
    menu = page.get_by_test_id("add-widget-menu")
    expect(menu).to_contain_text("Katalog")
    expect(page.get_by_test_id("add-widget-own-head")).to_have_text("Eigene")
    expect(page.get_by_test_id("add-widget-own-empty")).to_have_text("Noch keine. Beschreib dem Agenten ein Widget, und behalte es.")
    keep(page)
    page.get_by_test_id("add-widget").click()
    item = page.get_by_test_id("add-widget-own-item")
    expect(item).to_contain_text("MAPE je Region")
    expect(item).to_contain_text("eigen")
    expect(item).to_contain_text("Wie verteilt sich der Fehler über die Regionen?")
    item.click()  # an own widget can be added any number of times
    expect(page.locator('[data-widget="own:mape-je-region"]')).to_have_count(2)


def test_deleting_an_own_widget_in_the_menu_leaves_a_note_on_the_tiles_that_use_it(own_page):
    page = own_page
    keep(page)
    page.get_by_test_id("add-widget").click()
    page.get_by_test_id("own-delete").click()
    expect(page.get_by_test_id("add-widget-own-empty")).to_be_visible()
    assert not (page.writable_root / ".mlviz" / "widgets" / "mape-je-region.json").exists()
    page.reload()
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("run-select").select_option(RUN)
    expect(own_tile(page).get_by_test_id("widget-gone")).to_have_text("Widget gelöscht")


def test_own_widgets_only_show_for_their_scope(own_page):
    page = own_page
    keep(page)
    page.get_by_test_id("analysis-view-two").click()
    page.get_by_test_id("add-widget").click()
    expect(page.get_by_test_id("add-widget-own-empty")).to_be_visible()  # this one is for one run


# --- image export -------------------------------------------------------------------------------------
def test_an_own_widget_is_saved_as_an_image_like_a_built_in_one(own_page):
    page = own_page
    keep(page)
    wait_chart(page)
    own_tile(page).get_by_test_id("tile-save").click()
    dialog = page.get_by_test_id("save-dialog")
    dialog.get_by_test_id("folder-title").fill("Eigenes Widget")
    dialog.get_by_test_id("save-images").click()
    expect(page.get_by_test_id("toast")).to_contain_text("1 Bild gespeichert")
    out = page.writable_root / "deliverables" / "2026-10-15 Eigenes Widget"
    png = next(out.glob("*.png"))
    from PIL import Image

    img = Image.open(png).convert("RGB")
    assert img.width == 2400  # 1200 px at pixel ratio 2
    assert img.getpixel((5, 5)) == (255, 255, 255)  # the light export palette
    colours = {p for p in img.getdata() if max(p) - min(p) > 60}
    assert len(colours) > 20  # the bars are in it, drawn with the series colours of the export
    assert re.search(r"\d+_own-mape-je-region\.png$", png.name) or "mape" in png.name
