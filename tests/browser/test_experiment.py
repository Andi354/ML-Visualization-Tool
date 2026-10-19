"""Feature D (experiment view) in the browser."""

import re

from playwright.sync_api import expect

from .helpers import folder, open_run

TIM45 = folder("TIM-45_g6_combined")
TIM39 = folder("TIM-39_grid_multivariate_30")
TIM30 = folder("TIM-30_baselines_30")
TIM52 = folder("TIM-52_best_30", 1)


def view(page):
    return page.locator('[data-testid="exp-view"]:visible')


def rows(page):
    return view(page).get_by_test_id("exp-row")


def dim(page, key):
    return view(page).locator(f'[data-testid="dim"][data-dim="{key}"]')


def tag(page, key):
    return dim(page, key).get_by_test_id("dim-tag")


def heads(page):
    return view(page).locator(".col-row th").all_inner_texts()


def start(page, run_id):
    open_run(page, run_id)
    expect(rows(page).first).to_be_visible()


def test_header_shows_breadcrumb_and_epoch(page):
    start(page, TIM45)
    expect(view(page).get_by_test_id("run-title")).to_have_text("TIM-45_g6_combined")
    expect(view(page).locator(".epoch-chip")).to_have_text("Epoche tsrm6")
    view(page).get_by_test_id("back-to-runs").click()
    expect(page.get_by_test_id("tab-pinned")).to_have_class(re.compile("active"))


def test_sidebar_sections_in_config_order_then_replicates_then_channels(page):
    start(page, TIM45)
    sections = view(page).get_by_test_id("section").evaluate_all("els => els.map(e => e.dataset.section)")
    assert sections == ["model", "train", "Wiederholungen", "Kanäle"]
    assert dim(page, "lr_epochs").evaluate("e => e.closest('[data-testid=section]').dataset.section") == "train"


def test_dimensions_are_collapsed_rows_with_a_state_tag(page):
    start(page, TIM45)
    for key in ("lstm_layer", "time_embedding", "lr_epochs"):
        expect(tag(page, key)).to_have_text("geteilt")
        expect(tag(page, key)).to_have_class(re.compile("accent"))
    for key in ("shuffle_seed", "channel"):
        expect(tag(page, key)).to_have_text("Ø")
    expect(dim(page, "lstm_layer").get_by_test_id("mode-split")).to_have_count(0)  # collapsed


def test_expanded_row_has_the_switch_and_values_with_cell_counts(page):
    start(page, TIM45)
    dim(page, "lstm_layer").locator(".dim-head").click()
    expect(dim(page, "lstm_layer").get_by_test_id("mode-split")).to_have_text("Teilen")
    expect(dim(page, "lstm_layer").get_by_test_id("mode-agg")).to_have_text("Ø mitteln")
    values = dim(page, "lstm_layer").locator(".dim-value")
    expect(values).to_have_count(2)
    expect(values.first).to_contain_text("18")  # 36 cells, two values
    dim(page, "channel").locator(".dim-head").click()
    expect(dim(page, "channel").get_by_test_id("mode-split")).to_have_text("je Kanal")
    expect(dim(page, "channel").get_by_test_id("mode-agg")).to_have_text("gesamt")


def test_defaults_axes_split_replicates_averaged_sorted_by_primary_metric(page):
    start(page, TIM45)
    assert heads(page)[:3] == ["lr_epochs", "lstm_layer", "time_embedding"]
    assert rows(page).count() == 12
    expect(rows(page).first.locator(".stat-cell").first).to_have_text("3")  # n: seeds averaged
    means = view(page).locator(f'td[data-metric="test_mse_missing"]').evaluate_all(
        "els => els.map(e => parseFloat(e.childNodes[e.childNodes.length - 2].textContent.replace(',', '.')))"
    )
    assert means == sorted(means)
    expect(view(page).get_by_test_id("summary")).to_have_text("12 Gruppen · 36 Zellen")


def test_table_head_has_a_group_row_and_default_columns(page):
    start(page, TIM45)
    groups = view(page).locator(".group-row th").all_inner_texts()
    assert [g.upper() for g in groups] == ["PARAMETER (3)", "METRIKEN (2/10)", "STATISTIK"]
    assert [h.strip(" ↑↓") for h in heads(page)] == [
        "lr_epochs", "lstm_layer", "time_embedding", "MSE skaliert", "MAPE", "n", "Status",
    ]


def test_best_value_of_the_sort_metric_is_marked_with_colour_and_tag(page):
    start(page, TIM45)
    best = view(page).locator("td.best")
    expect(best).to_have_count(1)
    expect(best).to_contain_text("Bestwert")
    expect(best).to_have_css("color", "rgb(95, 212, 160)")
    assert best.evaluate("e => e.parentElement.rowIndex") == 2  # first body row (after the two head rows, 0-based)


def test_axis_switched_to_average_drops_its_column_and_adds_a_chip(page):
    start(page, TIM45)
    dim(page, "time_embedding").locator(".dim-head").click()
    dim(page, "time_embedding").get_by_test_id("mode-agg").click()
    expect(tag(page, "time_embedding")).to_have_text("Ø")
    expect(rows(page)).to_have_count(6)
    assert "time_embedding" not in heads(page)
    expect(view(page).get_by_test_id("chip")).to_have_text(re.compile("Ø time_embedding"))


def test_value_selection_filters_and_shows_a_chip_and_a_tag(page):
    start(page, TIM45)
    dim(page, "lstm_layer").locator(".dim-head").click()
    dim(page, "lstm_layer").locator('[data-value="1"]').check()
    expect(tag(page, "lstm_layer")).to_have_text("= 1")
    expect(rows(page)).to_have_count(6)
    expect(view(page).get_by_test_id("chip")).to_have_text(re.compile("lstm_layer ∈ 1"))
    expect(view(page).get_by_test_id("summary")).to_have_text("6 Gruppen · 18 Zellen")
    dim(page, "lstm_layer").locator('[data-value="0"]').check()
    expect(tag(page, "lstm_layer")).to_have_text("geteilt".replace("geteilt", "2 von 2"))


def test_cross_on_a_chip_returns_the_dimension_to_its_default(page):
    start(page, TIM45)
    dim(page, "lstm_layer").locator(".dim-head").click()
    dim(page, "lstm_layer").get_by_test_id("mode-agg").click()
    dim(page, "lstm_layer").locator('[data-value="1"]').check()
    expect(view(page).get_by_test_id("chip")).to_have_count(2)
    view(page).get_by_test_id("chip").first.click()
    expect(view(page).get_by_test_id("chip")).to_have_count(0)
    expect(tag(page, "lstm_layer")).to_have_text("geteilt")
    expect(rows(page)).to_have_count(12)


def test_replicates_switched_to_split_become_columns_one_row_per_cell(page):
    start(page, TIM45)
    dim(page, "shuffle_seed").locator(".dim-head").click()
    dim(page, "shuffle_seed").get_by_test_id("mode-split").click()
    expect(rows(page)).to_have_count(36)
    assert "shuffle_seed" in heads(page)
    expect(rows(page).first.locator(".stat-cell").first).to_have_text("1")


def test_channels_split_adds_a_channel_column_and_filters_by_channel(page):
    start(page, TIM45)
    dim(page, "channel").locator(".dim-head").click()
    dim(page, "channel").get_by_test_id("mode-split").click()
    expect(rows(page)).to_have_count(48)
    assert "channel" in heads(page)
    dim(page, "channel").locator('[data-value="us"]').check()
    expect(rows(page)).to_have_count(12)
    expect(rows(page).first.locator(".param-cell").last).to_have_text("us")


def test_clicking_a_metric_head_sorts_ascending_then_descending(page):
    start(page, TIM45)
    head = view(page).locator('[data-testid="metric-head"][data-metric="test_mape"]')
    head.click()
    expect(head).to_contain_text("↑")
    asc = view(page).locator('td[data-metric="test_mape"]').evaluate_all("els => els.map(e => e.textContent)")
    head.click()
    expect(head).to_contain_text("↓")
    desc = view(page).locator('td[data-metric="test_mape"]').evaluate_all("els => els.map(e => e.textContent)")
    assert asc == list(reversed(desc)) or asc[0] != desc[0]


def test_sorting_is_global_not_only_over_the_rendered_rows(page):
    start(page, TIM39)
    head = view(page).locator('[data-testid="metric-head"][data-metric="test_mape"]')
    head.click()
    head.click()  # descending by MAPE
    expect(head).to_contain_text("↓")
    first = view(page).locator('td[data-metric="test_mape"]').first.inner_text()
    value = float(first.replace("Bestwert", "").split(" ")[0].replace(",", ".").strip())
    ranked = page.evaluate(
        """async (id) => {
          const t = await (await fetch(`/api/runs/${id}/table`, {method:'POST', headers:{'content-type':'application/json'},
            body: JSON.stringify({sort:{metric:'test_mape', dir:'desc'}, limit: 1000, overview:false})})).json();
          return t.rows.filter(r => r.metrics.test_mape.mean !== null)[0].metrics.test_mape.mean * 100;
        }""",
        TIM39,
    )
    assert abs(value - ranked) < 0.01


def test_more_than_200_groups_render_200_and_say_sorted_over_all(page):
    start(page, TIM39)
    expect(rows(page)).to_have_count(200)
    expect(view(page).get_by_test_id("summary")).to_have_text("294 Gruppen · 294 Zellen · sortiert über alle")


def test_failed_cells_show_an_error_count_and_n_counts_only_successes(page, demo_project):
    from mlviz.project import Project
    from mlviz.runs import get_run

    run = get_run(Project.load(demo_project), TIM39)
    failed = run.cells[run.cells["status"] == "error"].iloc[0]
    start(page, TIM39)
    # limit the groups to those of one conv_dims value so that all of them are rendered
    dim(page, "conv_dims").locator(".dim-head").click()
    dim(page, "conv_dims").locator(f'[data-value="{failed["conv_dims"]}"]').check()
    expect(rows(page).first).to_be_visible()
    err = view(page).locator("td.stat-cell.error")
    expect(err.first).to_have_text("1 Fehler")
    row = err.first.locator("xpath=..")
    expect(row.locator(".stat-cell").first).to_have_text("0")  # n counts only successful cells
    expect(row.locator('td[data-metric="test_mape"]')).to_have_text("–")
    assert err.first.evaluate("e => getComputedStyle(e).color") == "rgb(255, 107, 107)"
    # a group whose cells all failed sorts last
    last = rows(page).last
    expect(last.locator("td.stat-cell.error")).to_have_text("1 Fehler")


def test_overview_toggle_hides_and_shows_the_strip(page):
    start(page, TIM45)
    expect(view(page).get_by_test_id("overview")).to_be_visible()
    view(page).get_by_test_id("toggle-overview").click()
    expect(view(page).get_by_test_id("overview")).to_have_count(0)
    view(page).get_by_test_id("toggle-overview").click()
    expect(view(page).get_by_test_id("overview")).to_be_visible()


def test_overview_cards_by_spread_with_a_histogram_last(page):
    start(page, TIM45)
    cards = view(page).get_by_test_id("ov-card")
    keys = cards.evaluate_all("els => els.map(e => e.dataset.dim)")
    assert set(keys) == {"channel", "lstm_layer", "lr_epochs", "time_embedding"}
    spreads = view(page).get_by_test_id("ov-spread").all_inner_texts()
    nums = [float(s.replace("Spanne", "").replace(",", ".")) for s in spreads]
    assert nums == sorted(nums, reverse=True)
    expect(view(page).get_by_test_id("histogram")).to_be_visible()
    assert view(page).locator(".hist-bar.best").count() == 1
    assert view(page).locator(".ov-dot.best").count() == len(keys)  # one best value per card


def test_click_on_an_overview_value_selects_it_in_the_sidebar(page):
    start(page, TIM45)
    view(page).locator('[data-testid="ov-card"][data-dim="lstm_layer"] [data-value="1"]').click()
    expect(tag(page, "lstm_layer")).to_have_text("= 1")
    expect(rows(page)).to_have_count(6)


def test_columns_menu_lists_metrics_with_family_and_statistics(page):
    start(page, TIM45)
    view(page).get_by_test_id("columns-button").click()
    menu = view(page).get_by_test_id("columns-menu")
    expect(menu.get_by_test_id("col-metric")).to_have_count(10)
    expect(menu).to_contain_text("MAPE")
    expect(menu).to_contain_text("real")
    expect(menu).to_contain_text("scaled")
    expect(menu.get_by_test_id("col-stat")).to_have_count(4)
    expect(view(page).get_by_test_id("columns-button")).to_contain_text("4/14")


def test_columns_choices_change_the_table_and_are_remembered(page):
    start(page, TIM45)
    view(page).get_by_test_id("columns-button").click()
    menu = view(page).get_by_test_id("columns-menu")
    menu.locator('[data-metric="test_mae"]').check()
    menu.locator('[data-stat="min"]').check()
    menu.locator('[data-stat="n"]').uncheck()
    labels = [h.strip(" ↑↓") for h in heads(page)]
    assert "MAE" in labels and "n" not in labels and any(h.startswith("min") for h in labels)
    expect(view(page).get_by_test_id("columns-button")).to_contain_text("5/14")
    page.get_by_test_id("area-analysis").click()  # leave and come back: same page, state kept
    page.reload()
    page.get_by_test_id("tab-run").first.click()
    expect(view(page).get_by_test_id("columns-button")).to_contain_text("5/14")


def test_sd_modes(page):
    start(page, TIM45)
    assert view(page).locator("td.metric-cell .sd").count() > 0  # default: under the value
    view(page).get_by_test_id("columns-button").click()
    view(page).get_by_test_id("sd-column").click()
    assert view(page).locator("td.metric-cell .sd").count() == 0
    assert heads(page).count("± sd") == 2
    view(page).get_by_test_id("sd-off").click()
    assert heads(page).count("± sd") == 0 and view(page).locator("td.metric-cell .sd").count() == 0


def test_constants_are_collapsed_read_only_and_listed_by_block(page):
    start(page, TIM45)
    box = view(page).get_by_test_id("constants")
    expect(box.locator(".badge")).to_have_text("16")
    expect(box.locator(".constants-body")).to_have_count(0)
    box.locator(".constants-head").click()
    expect(box.locator(".const-row", has_text="pred_len")).to_contain_text("30")
    expect(box.locator("input")).to_have_count(0)
    blocks = box.locator(".const-block .section-head").all_inner_texts()
    assert blocks[0].lower() == "data"
    assert box.evaluate("e => e.getBoundingClientRect().bottom") > 700  # pushed down to the bottom


def test_search_filters_dimensions_values_and_constants_and_expands_matches(page):
    start(page, TIM45)
    view(page).get_by_test_id("dim-search").fill("calendar")
    expect(dim(page, "time_embedding")).to_be_visible()
    expect(dim(page, "time_embedding").locator('[data-value="calendar"]')).to_be_visible()  # expanded
    expect(dim(page, "lstm_layer")).to_have_count(0)
    expect(view(page).get_by_test_id("constants").locator(".const-row", has_text="calendar_mode")).to_be_visible()
    view(page).get_by_test_id("dim-search").fill("zzz-nothing")
    expect(view(page).get_by_test_id("dim")).to_have_count(0)
    expect(view(page).get_by_test_id("constants")).to_have_count(0)


def test_each_tab_keeps_its_own_state(page):
    start(page, TIM45)
    dim(page, "lstm_layer").locator(".dim-head").click()
    dim(page, "lstm_layer").get_by_test_id("mode-agg").click()
    expect(rows(page)).to_have_count(6)
    start(page, TIM52)
    expect(view(page).get_by_test_id("chip")).to_have_count(0)  # other run, own state
    page.locator(f'[data-testid="tab-run"][data-run="{TIM45}"]').click()
    expect(rows(page)).to_have_count(6)
    expect(view(page).get_by_test_id("chip")).to_have_count(1)


def test_migrated_run_works_the_same(page):
    start(page, TIM30)
    expect(rows(page)).to_have_count(5)
    expect(view(page).locator(".epoch-chip")).to_have_text("Epoche tsrm6")


def test_sidebar_stays_270px_and_the_table_scrolls_instead_of_wrapping(page):
    start(page, TIM45)
    assert view(page).get_by_test_id("sidebar").bounding_box()["width"] == 270
    page.set_viewport_size({"width": 900, "height": 800})
    assert view(page).get_by_test_id("sidebar").bounding_box()["width"] == 270
    assert view(page).locator(".exp-table-wrap").evaluate("e => e.scrollWidth > e.clientWidth")
