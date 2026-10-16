"""Feature F (detail of one combination) in the browser."""

import re

from playwright.sync_api import expect

from .helpers import folder, open_run

NEW = folder("TIM-71_example")
OLD = folder("TIM-52_best_30", 1)


def view(page):
    return page.locator('[data-testid="exp-view"]:visible')


def rows(page):
    return view(page).get_by_test_id("exp-row")


def panel(page):
    return view(page).get_by_test_id("detail-panel")


def tile(page, widget):
    return panel(page).locator(f'[data-testid="widget-tile"][data-widget="{widget}"]')


def start(page, run_id=NEW, row=0):
    open_run(page, run_id)
    expect(rows(page).first).to_be_visible()
    rows(page).nth(row).click()
    expect(panel(page)).to_be_visible()


# --- opening, switching, closing ------------------------------------------------------------------
def test_click_on_a_row_marks_it_and_opens_a_640px_panel(page):
    start(page)
    assert panel(page).bounding_box()["width"] == 640
    row = rows(page).first
    expect(row).to_have_class(re.compile("selected"))
    assert row.evaluate("e => getComputedStyle(e.cells[0]).boxShadow").endswith("3px 0px 0px 0px inset") or "3px" in row.evaluate(
        "e => getComputedStyle(e.cells[0]).boxShadow"
    )
    assert row.evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(23, 34, 56)"


def test_clicking_another_row_switches_the_panel_and_the_cross_closes_it(page):
    start(page)
    expect(panel(page).get_by_test_id("dp-chips")).to_contain_text("forecaster = rep-net")
    rows(page).nth(2).click()
    expect(panel(page).get_by_test_id("dp-chips")).to_contain_text("forecaster = ets")
    expect(rows(page).first).not_to_have_class(re.compile("selected"))
    expect(rows(page).nth(2)).to_have_class(re.compile("selected"))
    panel(page).get_by_test_id("dp-close").click()
    expect(panel(page)).to_have_count(0)
    expect(view(page).locator("tr.selected")).to_have_count(0)


def test_the_experiment_view_keeps_its_structure_while_the_panel_is_open(page):
    start(page)
    assert view(page).get_by_test_id("sidebar").bounding_box()["width"] == 270
    assert view(page).locator(".exp-table-wrap").evaluate("e => e.scrollWidth > e.clientWidth")  # scrolls, no wrapping
    assert view(page).locator(".exp-table th").first.evaluate("e => getComputedStyle(e).whiteSpace") == "nowrap"


# --- head -------------------------------------------------------------------------------------------
def test_panel_head_shows_cells_combination_chips_and_metrics_with_sd(page):
    start(page)
    head = panel(page).locator(".dp-head")
    expect(head).to_contain_text("Kombination")
    expect(panel(page).get_by_test_id("dp-cells")).to_have_text("4 Zellen")
    expect(panel(page).get_by_test_id("dp-chips")).to_have_text(re.compile(r"forecaster = rep-net\s*lstm_layer = 1"))
    metrics = panel(page).locator(".dp-metric")
    expect(metrics).to_have_count(10)  # the catalogue metrics
    expect(metrics.first).to_contain_text("MSE skaliert")
    expect(metrics.first).to_contain_text("±")


def test_als_analyse_oeffnen_opens_the_analysis_with_this_combination(page):
    start(page)
    panel(page).get_by_test_id("open-analysis").click()
    expect(page.get_by_test_id("analysis-view")).to_be_visible()
    expect(page.get_by_test_id("run-select")).to_have_value(NEW)
    chips = page.get_by_test_id("filter-chip")
    expect(chips).to_have_count(2)
    expect(chips.first).to_contain_text("forecaster = rep-net")


# --- tiles ---------------------------------------------------------------------------------------------
def test_mini_board_tiles_in_order_config_last(page):
    start(page)
    order = panel(page).get_by_test_id("widget-tile").evaluate_all("els => els.map(e => e.dataset.widget)")
    assert order == ["curves", "forecast", "replicates", "config"]
    first = tile(page, "curves")
    expect(first.locator(".w-label")).to_have_text("Loss-Kurven")
    expect(first.locator(".w-question")).to_contain_text("überanpassen")
    expect(first.get_by_test_id("tile-settings")).to_have_text("Einstellen")
    expect(first.get_by_test_id("tile-remove")).to_be_visible()


def test_curves_tile_title_per_seed_lines_mean_and_best_epoch(page):
    start(page)
    t = tile(page, "curves")
    expect(t.get_by_test_id("widget-title")).to_have_text(re.compile(r"^val_loss am niedrigsten in Epoche \d+ von 40$"))
    expect(t.get_by_test_id("seed-line")).to_have_count(4)  # two seeds, train and val
    expect(t.get_by_test_id("mean-line")).to_have_count(2)
    expect(t.get_by_test_id("best-epoch")).to_have_count(1)
    assert float(t.get_by_test_id("seed-line").first.evaluate("e => getComputedStyle(e).opacity")) == 0.25


def test_curves_setting_mean_only(page):
    start(page)
    t = tile(page, "curves")
    t.get_by_test_id("tile-settings").click()
    t.get_by_test_id("set-mode-mean").click()
    expect(t.get_by_test_id("seed-line")).to_have_count(0)
    expect(t.get_by_test_id("mean-line")).to_have_count(2)


def test_forecast_tile_title_channel_and_compare(page):
    start(page)
    t = tile(page, "forecast")
    expect(t.get_by_test_id("widget-title")).to_have_text(re.compile(r"^Region us: MAPE \d,\d %$"))
    expect(t.get_by_test_id("compare-line")).to_have_count(0)
    t.get_by_test_id("tile-settings").click()
    t.get_by_test_id("set-channel").select_option("asia")
    expect(t.get_by_test_id("widget-title")).to_contain_text("Region asia")
    t.get_by_test_id("set-compare").select_option("forecaster=ets")
    expect(t.get_by_test_id("compare-line")).to_have_count(1)
    expect(t.get_by_test_id("widget-title")).to_have_text(re.compile(r"MAPE \d,\d % gegenüber \d,\d % bei ets$"))
    assert t.get_by_test_id("compare-line").evaluate("e => getComputedStyle(e).strokeDasharray") != "none"
    expect(t.get_by_test_id("band")).to_be_visible()
    expect(t.get_by_test_id("zero-line")).to_have_count(1)  # error panel with its zero line


def test_forecast_plots_one_window_and_the_strip_marks_it(page):
    start(page)
    t = tile(page, "forecast")
    expect(t.locator(".w-sub")).to_contain_text("Fenster 2026-03-02 bis 2026-03-31")
    marker = t.get_by_test_id("window-marker")
    right = marker.evaluate("e => parseFloat(e.getAttribute('x'))")
    assert right > 300  # the last window sits at the end of the strip


def test_clicking_the_strip_moves_the_window(page):
    start(page)
    t = tile(page, "forecast")
    before = t.locator(".w-sub").inner_text()
    strip = t.get_by_test_id("forecast-overview")
    width = strip.evaluate("e => e.getBoundingClientRect().width")
    strip.click(position={"x": width * 0.05, "y": 20})
    expect(t.locator(".w-sub")).not_to_have_text(before)
    expect(t.locator(".w-sub")).to_contain_text("Fenster 2026-01-01")  # nearest stored window
    assert t.get_by_test_id("window-marker").evaluate("e => parseFloat(e.getAttribute('x'))") < 50


def test_replicates_tile_grid_and_best(page):
    start(page)
    t = tile(page, "replicates")
    expect(t.get_by_test_id("rep-cell")).to_have_count(4)
    expect(t.get_by_test_id("widget-title")).to_have_text(re.compile(r"^Beste Wiederholung: shuffle_seed \d, cv_fold \d"))
    expect(t.locator(".rep-cell.best")).to_have_count(1)
    t.get_by_test_id("tile-settings").click()
    t.get_by_test_id("set-metric").select_option("test_mape")
    expect(t.get_by_test_id("rep-cell").first).to_contain_text("%")


def test_config_tile_is_last_with_the_grid_box_open_and_blocks_folded(page):
    start(page)
    t = tile(page, "config")
    expect(t.get_by_test_id("cfg-grid")).to_be_visible()
    expect(t.get_by_test_id("cfg-block")).to_have_count(4)
    expect(t.get_by_test_id("cfg-entry")).to_have_count(0)  # folded
    chip = t.locator('[data-axis="forecaster"] .cfg-chip.current')
    expect(chip).to_have_text("rep-net")
    t.locator('[data-block="model"] .cfg-block-head').click()
    expect(t.locator('[data-testid="cfg-entry"][data-key="forecaster"]')).to_have_class(re.compile("swept"))


def test_config_tile_switches_between_blocks_and_yaml_in_its_settings(page):
    start(page, row=2)  # forecaster = ets
    t = tile(page, "config")
    expect(t.locator('[data-axis="forecaster"] .cfg-chip.current')).to_have_text("ets")
    t.get_by_test_id("tile-settings").click()
    t.get_by_test_id("set-view-yaml").click()
    expect(t.get_by_test_id("cfg-yaml")).to_be_visible()
    expect(t.get_by_test_id("cfg-grid-chips")).to_contain_text("forecaster = ets")
    assert t.get_by_test_id("yaml-line").filter(has_text="forecaster: ets").count() == 1


# --- runs without curves / predictions ------------------------------------------------------------------
def test_run_without_curves_and_predictions_says_so_instead_of_drawing(page):
    start(page, OLD)
    expect(tile(page, "curves").get_by_test_id("widget-unavailable")).to_have_text("Dieser Lauf hat keine Lernkurven gespeichert")
    expect(tile(page, "forecast").get_by_test_id("widget-unavailable")).to_have_text("Dieser Lauf hat keine Vorhersagen gespeichert")
    expect(tile(page, "curves").locator("svg")).to_have_count(0)
    expect(tile(page, "replicates").get_by_test_id("rep-cell").first).to_be_visible()  # the others still work


# --- + Widget, removing, remembering ----------------------------------------------------------------------
def test_add_widget_offers_only_the_detail_widgets(page):
    start(page)
    panel(page).get_by_test_id("add-widget").click()
    items = panel(page).get_by_test_id("add-widget-item")
    assert sorted(items.evaluate_all("els => els.map(e => e.dataset.widget)")) == ["config", "curves", "forecast", "replicates"]
    panel(page).locator('[data-testid="add-widget-item"][data-widget="curves"]').click()
    expect(panel(page).locator('[data-testid="widget-tile"][data-widget="curves"]')).to_have_count(2)  # same type twice


def test_removed_tiles_stay_removed_after_a_reload_per_project(page):
    start(page)
    tile(page, "forecast").get_by_test_id("tile-remove").click()
    expect(panel(page).get_by_test_id("widget-tile")).to_have_count(3)
    page.reload()
    page.get_by_test_id("tab-run").first.click()
    rows(page).first.click()
    expect(panel(page).get_by_test_id("widget-tile")).to_have_count(3)
    assert tile(page, "forecast").count() == 0
