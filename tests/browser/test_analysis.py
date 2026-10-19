"""Feature G (analysis of one run, deliverables) in the browser."""

import re
import struct

from playwright.sync_api import expect

from .helpers import folder, open_run

RUN = folder("TIM-52_best_30", 1)
KEYS = ["compare-table", "per-region", "config", "axis-effect", "stability"]


def board(page):
    return page.get_by_test_id("board")


def tile(page, key):
    return board(page).locator(f'[data-testid="widget-tile"][data-widget="{key}"]')


def go(page, run_id=RUN):
    page.get_by_test_id("area-analysis").click()
    expect(page.get_by_test_id("widget-title").first).to_be_visible()
    page.get_by_test_id("run-select").select_option(run_id)
    page.wait_for_load_state("networkidle")  # the tiles reload for the chosen run
    expect(tile(page, "compare-table").get_by_test_id("widget-title")).to_be_visible()


def png_size(path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    return struct.unpack(">II", data[16:24])


# --- board ----------------------------------------------------------------------------------------
def test_the_area_opens_with_all_one_run_widgets_in_catalog_order(page):
    go(page)
    order = board(page).get_by_test_id("widget-tile").evaluate_all("els => els.map(e => e.dataset.widget)")
    assert order == KEYS
    expect(page.get_by_test_id("widgets-menu")).to_have_text("Widgets · 5 von 5")
    expect(page.locator('[data-testid="analysis-view"] .crumb')).to_have_text("Analyse/Ein Lauf")
    expect(page.get_by_test_id("analysis-view-run")).to_have_attribute("aria-pressed", "true")
    expect(page.get_by_test_id("analysis-view-run")).to_have_text("Ein Lauf")


def test_tile_header_has_name_question_settings_remove_and_a_small_save_button(page):
    go(page)
    t = tile(page, "compare-table")
    expect(t.locator(".w-label")).to_have_text("Vergleichstabelle")
    expect(t.locator(".w-question")).to_contain_text("bei welcher Metrik")
    expect(t.get_by_test_id("tile-settings")).to_have_text("Einstellen")
    expect(t.get_by_test_id("tile-remove")).to_be_visible()
    save = t.get_by_test_id("tile-save")
    expect(save).to_have_attribute("title", "Als Deliverable speichern")
    expect(save).to_have_text("")  # no text, an icon only
    assert save.locator("svg").count() == 1
    box = save.bounding_box()
    assert box["width"] == 26 and box["height"] == 26
    assert save.evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(110, 155, 245)"
    # the save button is the rightmost control of the header
    xs = t.locator(".w-head > *").evaluate_all("els => els.map(e => e.getBoundingClientRect().left)")
    assert xs == sorted(xs)


def test_the_run_can_be_chosen_and_the_widgets_follow(page):
    go(page)
    first = tile(page, "compare-table").get_by_test_id("widget-title").inner_text()
    page.get_by_test_id("run-select").select_option(folder("TIM-45_g6_combined"))
    expect(tile(page, "compare-table").locator(".w-sub")).to_contain_text("lr_epochs ×")
    assert tile(page, "compare-table").get_by_test_id("widget-title").inner_text() != first


# --- the widgets -----------------------------------------------------------------------------------
def test_compare_table_best_per_column_first_row_bold_and_texts(page):
    go(page)
    t = tile(page, "compare-table")
    expect(t.get_by_test_id("widget-title")).to_have_text("rep-net ist in allen 6 Spalten am besten")
    expect(t.locator(".w-sub")).to_contain_text("forecaster × MAPE, MAE, MSE, RMSE, Commitment Cost, Asymmetrische Kosten")
    expect(t.locator(".w-note")).to_have_text("niedriger = besser · grün = bester Wert je Spalte")
    rows = t.get_by_test_id("ct-row")
    expect(rows).to_have_count(5)
    assert rows.first.evaluate("e => getComputedStyle(e.cells[0]).fontWeight") == "600"  # own model
    best = t.locator('[data-testid="ct-cell"][data-best="true"]')
    expect(best).to_have_count(6)  # one per column
    assert best.first.evaluate("e => getComputedStyle(e).color") == "rgb(95, 212, 160)"
    expect(t.get_by_test_id("ct-cell").first).to_have_text(re.compile(r"^\d,\d{3} %$"))


def test_compare_table_settings_rows_and_column_groups(page):
    go(page, folder("TIM-45_g6_combined"))
    t = tile(page, "compare-table")
    t.get_by_test_id("tile-settings").click()
    t.get_by_test_id("set-rows").select_option("lstm_layer")
    expect(t.get_by_test_id("ct-row")).to_have_count(2)
    t.get_by_test_id("set-groups").select_option("time_embedding")
    expect(t.locator(".group-head")).to_have_text(["time_embedding calendar", "time_embedding none"])
    expect(t.locator(".w-sub")).to_contain_text("Spalten nach time_embedding")
    assert t.locator("tr.own").count() == 0  # not the project's own model: no bold row


def test_per_region_table_and_bars(page):
    go(page)
    t = tile(page, "per-region")
    expect(t.get_by_test_id("region-row")).to_have_count(4)
    expect(t.get_by_test_id("widget-title")).to_have_text("rep-net ist in 4 von 4 Regionen am besten")
    expect(t.locator('[data-testid="region-cell"][data-best="true"]')).to_have_count(4)  # best per row
    t.get_by_test_id("tile-settings").click()
    t.get_by_test_id("set-format-bars").click()
    expect(t.get_by_test_id("chart-region-bars")).to_be_visible()
    expect(t.get_by_test_id("region-bar")).to_have_count(20)  # 4 regions x 5 series
    t.get_by_test_id("set-metric").select_option("test_mae")
    expect(t.locator(".w-sub")).to_contain_text("MAE je Region")


def test_config_tile_shows_the_best_combination_with_blocks_open(page):
    go(page)
    t = tile(page, "config")
    expect(t.get_by_test_id("widget-title")).to_have_text("Beste Config: forecaster = rep-net")
    expect(t.get_by_test_id("cfg-entry").first).to_be_visible()  # not folded in the analysis
    expect(t.locator('[data-axis="forecaster"] .cfg-chip.current')).to_have_text("rep-net")


def test_axis_effect_and_stability(page):
    go(page, folder("TIM-45_g6_combined"))
    effect = tile(page, "axis-effect")
    expect(effect.get_by_test_id("effect-row")).to_have_count(3)
    spreads = effect.get_by_test_id("effect-row").locator(".effect-value").all_inner_texts()
    nums = [float(s.replace(" %", "").replace(",", ".")) for s in spreads]
    assert nums == sorted(nums, reverse=True) and len(nums) == 3
    expect(effect.get_by_test_id("widget-title")).to_contain_text("wirkt am stärksten")
    stab = tile(page, "stability")
    expect(stab.get_by_test_id("stab-row")).to_have_count(3)
    expect(stab.get_by_test_id("rep-dot")).to_have_count(9)  # 3 rows x 3 seeds
    expect(stab.get_by_test_id("mean-tick")).to_have_count(3)
    expect(stab.locator(".w-note")).to_contain_text("deterministische Modelle variieren nur über Folds")


# --- board control ------------------------------------------------------------------------------------
def test_plus_widget_adds_one_from_the_catalog_the_same_type_may_appear_twice(page):
    go(page)
    page.get_by_test_id("add-widget").click()
    items = page.get_by_test_id("add-widget-menu").get_by_test_id("add-widget-item")
    assert items.evaluate_all("els => els.map(e => e.dataset.widget)") == KEYS
    page.locator('[data-testid="add-widget-item"][data-widget="compare-table"]').click()
    expect(board(page).locator('[data-widget="compare-table"]')).to_have_count(2)
    tile(page, "stability").get_by_test_id("tile-remove").click()
    expect(tile(page, "stability")).to_have_count(0)


def test_widgets_menu_shows_and_hides_widgets_and_is_remembered_per_project(page):
    go(page)
    page.get_by_test_id("widgets-menu").click()
    page.locator('[data-testid="widget-toggle"][data-widget="per-region"]').uncheck()
    expect(tile(page, "per-region")).to_have_count(0)
    expect(page.get_by_test_id("widgets-menu")).to_have_text("Widgets · 4 von 5")
    page.reload()
    page.get_by_test_id("area-analysis").click()
    expect(page.get_by_test_id("widget-title").first).to_be_visible()
    expect(tile(page, "per-region")).to_have_count(0)
    page.get_by_test_id("widgets-menu").click()
    page.locator('[data-testid="widget-toggle"][data-widget="per-region"]').check()
    expect(tile(page, "per-region")).to_have_count(1)


def test_analyse_from_a_run_tab_and_from_a_combination(page):
    open_run(page, RUN)
    page.locator('[data-testid="exp-view"]:visible').get_by_test_id("analyse-run").click()
    expect(page.get_by_test_id("run-select")).to_have_value(RUN)
    expect(page.get_by_test_id("filter-chip")).to_have_count(0)
    page.get_by_test_id("tab-run").first.click()
    page.locator('[data-testid="exp-view"]:visible [data-testid="exp-row"]').nth(1).click()
    page.get_by_test_id("open-analysis").click()
    chips = page.get_by_test_id("filter-chip")
    expect(chips).to_have_count(1)
    expect(tile(page, "compare-table").locator(".w-sub")).to_contain_text("forecaster")
    expect(tile(page, "compare-table").get_by_test_id("ct-row")).to_have_count(1)  # filtered to one value
    chips.first.click()
    expect(tile(page, "compare-table").get_by_test_id("ct-row")).to_have_count(5)


# --- save dialog -----------------------------------------------------------------------------------------
def test_header_button_opens_the_dialog_with_nothing_preselected(page):
    go(page)
    page.get_by_test_id("save-deliverable").click()
    dialog = page.get_by_test_id("save-dialog")
    expect(dialog).to_be_visible()
    expect(dialog.get_by_test_id("image-item")).to_have_count(5)
    expect(dialog.get_by_test_id("image-check").locator("visible=true")).to_have_count(5)
    assert dialog.locator('[data-testid="image-check"]:checked').count() == 0
    button = dialog.get_by_test_id("save-images")
    expect(button).to_have_text("Widgets auswählen")
    expect(button).to_be_disabled()
    dialog.get_by_test_id("image-check").nth(0).check()
    expect(button).to_have_text("1 Bild speichern")
    dialog.get_by_test_id("image-check").nth(1).check()
    expect(button).to_have_text("2 Bilder speichern")
    expect(button).to_be_enabled()


def test_tile_save_button_opens_the_dialog_with_only_that_widget_selected_and_previewed(page):
    go(page)
    tile(page, "per-region").get_by_test_id("tile-save").click()
    dialog = page.get_by_test_id("save-dialog")
    checked = dialog.locator('[data-testid="image-item"]:has([data-testid="image-check"]:checked)')
    expect(checked).to_have_count(1)
    expect(checked).to_contain_text("Je Region")
    expect(dialog.get_by_test_id("image-title")).to_have_value("rep-net ist in 4 von 4 Regionen am besten")
    card = dialog.get_by_test_id("export-card")
    expect(card).to_be_visible()
    expect(card).to_have_attribute("data-theme", "light")
    assert card.evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(255, 255, 255)"
    expect(card.get_by_test_id("widget-title")).to_have_text("rep-net ist in 4 von 4 Regionen am besten")


def test_preview_shows_the_image_exactly_as_exported_width_background_footer(page):
    go(page)
    tile(page, "compare-table").get_by_test_id("tile-save").click()
    dialog = page.get_by_test_id("save-dialog")
    card = dialog.get_by_test_id("export-card")
    assert card.evaluate("e => e.offsetWidth") == 1200  # laid out at export size, scaled to fit the box
    expect(card.get_by_test_id("export-footer")).to_have_text(re.compile(rf"^{re.escape(RUN)} · Epoche eval-all-windows · [0-9a-f]{{7}}$"))
    dialog.get_by_test_id("bg-dark").click()
    expect(card).to_have_attribute("data-theme", "dark")
    assert card.evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(13, 16, 22)"
    dialog.get_by_test_id("bg-light").click()
    expect(card).to_have_attribute("data-theme", "light")


def test_title_hints_and_footer_are_switchable_per_image(page):
    go(page)
    tile(page, "compare-table").get_by_test_id("tile-save").click()
    dialog = page.get_by_test_id("save-dialog")
    card = dialog.get_by_test_id("export-card")
    dialog.get_by_test_id("image-title").fill("Mein eigener Titel")
    expect(card.get_by_test_id("widget-title")).to_have_text("Mein eigener Titel")
    expect(card.locator(".w-sub")).to_have_count(1)
    dialog.get_by_test_id("hints-check").uncheck()
    expect(card.locator(".w-sub")).to_have_count(0)
    expect(card.locator(".w-note")).to_have_count(0)
    expect(card.get_by_test_id("widget-title")).to_be_visible()  # the title stays
    dialog.get_by_test_id("footer-check").uncheck()
    expect(card.get_by_test_id("export-footer")).to_have_count(0)


def test_file_names_have_defaults_and_are_editable(page):
    go(page)
    page.get_by_test_id("save-deliverable").click()
    dialog = page.get_by_test_id("save-dialog")
    dialog.get_by_test_id("image-check").nth(1).check()
    dialog.get_by_test_id("image-check").nth(3).check()
    names = dialog.get_by_test_id("image-name")
    expect(names.nth(1)).to_have_value("01_per-region.png")
    expect(names.nth(3)).to_have_value("02_axis-effect.png")
    names.nth(1).fill("regionen.png")
    dialog.get_by_test_id("image-check").nth(0).check()
    expect(names.nth(1)).to_have_value("regionen.png")  # an edited name stays
    expect(names.nth(0)).to_have_value("01_compare-table.png")


def test_saving_writes_pngs_a_readme_and_the_configs_and_shows_the_path(writable_page):
    page = writable_page
    go(page)
    tile(page, "compare-table").get_by_test_id("tile-save").click()
    dialog = page.get_by_test_id("save-dialog")
    dialog.get_by_test_id("image-check").nth(1).check()
    dialog.get_by_test_id("with-configs").check()
    dialog.get_by_test_id("folder-title").fill("Test Speichern")
    expect(dialog.get_by_test_id("save-images")).to_have_text("2 Bilder speichern")  # both are loaded
    expect(dialog.get_by_test_id("target-path")).to_have_text("deliverables/2026-10-15 Test Speichern")
    dialog.get_by_test_id("save-images").click()
    expect(page.get_by_test_id("toast")).to_have_text("2 Bilder gespeichert: deliverables/2026-10-15 Test Speichern")
    expect(page.get_by_test_id("save-dialog")).to_have_count(0)
    out = page.writable_root / "deliverables" / "2026-10-15 Test Speichern"
    assert sorted(p.name for p in out.glob("*.png")) == ["01_compare-table.png", "02_per-region.png"]
    width, height = png_size(out / "01_compare-table.png")
    assert width == 2400 and height > 400  # 1200 px at pixel ratio 2
    assert (out / "configs" / f"{RUN}.yaml").is_file()
    readme = (out / "README.md").read_text()
    assert "Issue: TIM-52" in readme and RUN in readme and "01_compare-table.png" in readme


def test_the_saved_image_has_the_light_background_and_text(writable_page):
    page = writable_page
    go(page)
    tile(page, "axis-effect").get_by_test_id("tile-save").click()
    dialog = page.get_by_test_id("save-dialog")
    dialog.get_by_test_id("folder-title").fill("Hell")
    dialog.get_by_test_id("save-images").click()
    expect(page.get_by_test_id("toast")).to_be_visible()
    out = page.writable_root / "deliverables" / "2026-10-15 Hell" / "01_axis-effect.png"
    from PIL import Image

    img = Image.open(out).convert("RGB")
    assert img.getpixel((5, 5)) == (255, 255, 255)  # light card
    dark = [p for p in img.getdata() if sum(p) < 200]
    assert len(dark) > 100  # there is dark text on it


def test_existing_files_are_not_overwritten_without_asking(writable_page):
    page = writable_page
    go(page)
    for attempt in range(2):
        tile(page, "stability").get_by_test_id("tile-save").click()
        dialog = page.get_by_test_id("save-dialog")
        dialog.get_by_test_id("folder-title").fill("Doppelt")
        dialog.get_by_test_id("save-images").click()
        if attempt == 0:
            expect(page.get_by_test_id("toast")).to_be_visible()
    error = page.get_by_test_id("dialog-error")
    expect(error).to_contain_text("Diese Dateien gibt es schon")
    expect(error).to_contain_text("01_stability.png")
    page.get_by_test_id("overwrite").click()
    expect(page.get_by_test_id("save-dialog")).to_have_count(0)


def test_the_target_folder_can_be_chosen_inside_the_project(writable_page):
    page = writable_page
    go(page)
    tile(page, "stability").get_by_test_id("tile-save").click()
    dialog = page.get_by_test_id("save-dialog")
    dialog.get_by_test_id("change-folder").click()
    picker = dialog.get_by_test_id("folder-picker")
    expect(picker).to_be_visible()
    picker.get_by_test_id("fp-up").click()  # it starts in the current target base, deliverables
    picker.locator('[data-testid="fp-dir"]:text-is("analysis")').wait_for()
    dirs = picker.get_by_test_id("fp-dir").all_inner_texts()
    assert "analysis" in dirs and "deliverables" in dirs and "runs" not in dirs
    picker.locator('[data-testid="fp-dir"]:text-is("analysis")').click()
    picker.get_by_test_id("fp-choose").click()
    dialog.get_by_test_id("folder-title").fill("Anderer Ort")
    expect(dialog.get_by_test_id("target-path")).to_have_text("analysis/2026-10-15 Anderer Ort")
    dialog.get_by_test_id("save-images").click()
    expect(page.get_by_test_id("toast")).to_contain_text("analysis/2026-10-15 Anderer Ort")
    assert (page.writable_root / "analysis" / "2026-10-15 Anderer Ort" / "01_stability.png").is_file()


# --- width and order of the tiles (v0.2, feature E) -----------------------------------------------
def _tile_widths(page):
    board = page.get_by_test_id("board").bounding_box()["width"]
    return {
        t.get_attribute("data-widget"): round(t.bounding_box()["width"] / board, 2)
        for t in page.get_by_test_id("widget-tile").all()
    }


def _order(page):
    return page.get_by_test_id("widget-tile").evaluate_all("els => els.map(e => e.dataset.widget)")


def test_the_comparison_table_is_full_width_by_default_all_other_tiles_are_half(page):
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("widget-tile").first.wait_for()
    widths = _tile_widths(page)
    assert widths["compare-table"] > 0.95
    assert all(0.4 < w < 0.55 for k, w in widths.items() if k != "compare-table")


def test_a_full_width_tile_starts_a_new_row(page):
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("widget-tile").first.wait_for()
    tiles = page.get_by_test_id("widget-tile")
    full = tiles.first.bounding_box()
    after = tiles.nth(1).bounding_box()
    assert tiles.first.get_attribute("data-widget") == "compare-table"
    assert after["y"] >= full["y"] + full["height"]  # the next tile is below, not beside


def test_settings_have_a_width_control_that_changes_the_tile_at_once(page):
    page.get_by_test_id("area-analysis").click()
    tile = page.locator('[data-testid="widget-tile"][data-widget="per-region"]')
    tile.wait_for()
    assert 0.4 < _tile_widths(page)["per-region"] < 0.55
    tile.get_by_test_id("tile-settings").click()
    tile.get_by_test_id("set-width-full").click()
    expect(tile).to_have_attribute("data-width", "full")
    assert _tile_widths(page)["per-region"] > 0.95
    tile.get_by_test_id("set-width-half").click()
    assert 0.4 < _tile_widths(page)["per-region"] < 0.55


def test_the_arrows_move_a_tile_one_position_and_are_disabled_at_the_ends(page):
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("widget-tile").first.wait_for()
    before = _order(page)
    tiles = page.get_by_test_id("widget-tile")
    expect(tiles.first.get_by_test_id("tile-up")).to_be_disabled()
    expect(tiles.last.get_by_test_id("tile-down")).to_be_disabled()
    tiles.nth(1).get_by_test_id("tile-up").click()
    assert _order(page) == [before[1], before[0], *before[2:]]
    first_one = page.locator(f'[data-testid="widget-tile"][data-widget="{before[0]}"]')
    first_one.get_by_test_id("tile-down").click()
    assert _order(page) == [before[1], before[2], before[0], *before[3:]]


def test_width_and_order_are_remembered_per_project(page):
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("widget-tile").first.wait_for()
    before = _order(page)
    page.get_by_test_id("widget-tile").nth(2).get_by_test_id("tile-up").click()
    tile = page.locator('[data-testid="widget-tile"][data-widget="per-region"]')
    tile.get_by_test_id("tile-settings").click()
    tile.get_by_test_id("set-width-full").click()
    moved = _order(page)
    assert moved != before
    page.reload()
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("widget-tile").first.wait_for()
    assert _order(page) == moved
    assert _tile_widths(page)["per-region"] > 0.95
