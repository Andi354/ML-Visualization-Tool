"""Feature C (Läufe) in the browser. Clock fixed at 2026-10-15 12:00."""

import re

from playwright.sync_api import expect

from mlviz.fixture import RUNS

from .helpers import folder

TIM52_OLD = folder("TIM-52_best_30", 0)
TIM52_NEW = folder("TIM-52_best_30", 1)
TIM45 = folder("TIM-45_g6_combined")
TIM39 = folder("TIM-39_grid_multivariate_30")
TIM71 = folder("TIM-71_example")
TIM83 = folder("TIM-83_running_sweep")
ALONE = folder("sweep_check")


def row(page, run_id):
    return page.locator(f'[data-testid="run-row"][data-run="{run_id}"]')


def block(page, issue):
    return page.locator(f'[data-testid="issue-block"][data-issue="{issue}"]')


def test_start_page_is_the_list_view_with_breadcrumb(page):
    expect(page.get_by_test_id("view-list")).to_have_attribute("aria-pressed", "true")
    expect(page.locator(".crumb")).to_have_text("Demo Bench / Läufe")


def test_issues_with_a_run_in_the_last_7_days_are_expanded_others_collapsed(page):
    for issue in ("TIM-52", "TIM-71", "TIM-83"):
        expect(block(page, issue).get_by_test_id("issue-toggle")).to_have_attribute("aria-expanded", "true")
    for issue in ("TIM-45", "TIM-39", "TIM-30"):
        expect(block(page, issue).get_by_test_id("issue-toggle")).to_have_attribute("aria-expanded", "false")
    expect(row(page, TIM45)).to_have_count(0)


def test_click_on_issue_head_expands_and_collapses(page):
    toggle = block(page, "TIM-45").get_by_test_id("issue-toggle")
    toggle.click()
    expect(row(page, TIM45)).to_be_visible()
    toggle.click()
    expect(row(page, TIM45)).to_have_count(0)


def test_blocks_are_sorted_by_their_newest_run_standalone_rows_at_their_own_date(page):
    keys = page.locator("[data-testid=issue-block], [data-testid=run-row].standalone").evaluate_all(
        "els => els.map(e => e.dataset.issue || e.dataset.run)"
    )
    assert keys == ["TIM-83", ALONE, "TIM-71", "TIM-52", "TIM-45", "TIM-39", "TIM-30"]


def test_newest_run_card(page):
    card = page.get_by_test_id("newest")
    expect(card).to_contain_text("Neuester Lauf · heute 11:00")
    expect(card).to_contain_text(TIM83)
    expect(card).to_contain_text("TIM-83")
    expect(card).to_contain_text("läuft · 9 / 24 Zellen")
    expect(card).to_contain_text("bester MAPE bisher · pred_len 30")
    page.get_by_test_id("newest-open").click()
    expect(page.locator(f'[data-testid="tab-run"][data-run="{TIM83}"]')).to_have_class(re.compile("active"))


def test_newest_card_is_hidden_while_search_or_status_filter_is_active(page):
    page.get_by_test_id("search").fill("sweep")
    expect(page.get_by_test_id("newest")).to_have_count(0)
    page.get_by_test_id("search").fill("")
    expect(page.get_by_test_id("newest")).to_have_count(1)
    page.get_by_role("button", name="Läuft", exact=True).click()
    expect(page.get_by_test_id("newest")).to_have_count(0)


def test_row_shows_name_without_issue_prefix_and_flags_only_for_deviations(page):
    r = row(page, TIM83)
    expect(r.locator(".run-name")).to_have_text("running_sweep")
    expect(r.locator(".flag.running")).to_have_text("● läuft")
    expect(row(page, TIM71).locator(".flag")).to_have_count(0)  # current epoch, finished
    block(page, "TIM-45").get_by_test_id("issue-toggle").click()
    expect(row(page, TIM45).locator(".flag.warn")).to_have_text("Epoche tsrm6")


def test_second_line_lists_axes_then_extras(page):
    expect(row(page, TIM71).locator(".sub")).to_have_text("forecaster · lstm_layer   —   Kurven · Vorhersagen")
    block(page, "TIM-45").get_by_test_id("issue-toggle").click()
    expect(row(page, TIM45).locator(".sub")).to_have_text(
        "lr_epochs · lstm_layer · time_embedding   —   migriert"
    )


def test_standalone_row_starts_with_ohne_issue(page):
    expect(row(page, ALONE).locator(".sub")).to_have_text("ohne Issue · time_embedding")
    expect(row(page, ALONE).locator(".run-name")).to_have_text("sweep_check")


def test_cell_progress_and_errors(page):
    expect(row(page, TIM83).locator(".cell-text")).to_have_text("9 / 24")
    block(page, "TIM-39").get_by_test_id("issue-toggle").click()
    text = row(page, TIM39).locator(".cell-text")
    expect(text).to_have_text(re.compile(r"294 Zellen · \d+ Fehler"))
    expect(text).to_have_class(re.compile("has-errors"))
    assert row(page, TIM39).locator(".bar-err").evaluate("e => e.getBoundingClientRect().width") > 0


def test_best_value_with_metric_and_horizon_provisional_while_running(page):
    expect(row(page, TIM83).locator(".run-best .note")).to_have_text("MAPE · pred_len 30 · vorläufig")
    expect(row(page, TIM71).locator(".run-best .note")).to_have_text("MAPE · pred_len 30")
    expect(row(page, TIM71).locator(".best-value")).to_have_text(re.compile(r"^\d,\d\d %$"))


def test_older_runs_of_an_experiment_unfold_dimmed_and_named_by_timestamp(page):
    toggle = row(page, TIM52_NEW).get_by_test_id("older-toggle")
    expect(toggle).to_have_text("▸ 1 älterer Lauf")
    expect(row(page, TIM52_OLD)).to_have_count(0)
    toggle.click()
    expect(toggle).to_have_text("▾ 1 älterer Lauf")
    older = page.locator(f'[data-testid="older-row"][data-run="{TIM52_OLD}"]')
    expect(older.locator(".run-name")).to_have_text("↳ 2026-10-06_1000")
    assert float(older.evaluate("e => getComputedStyle(e).opacity")) < 1


def test_search_matches_axis_names_and_expands_the_matching_issue(page):
    page.get_by_test_id("search").fill("conv_dims")
    expect(row(page, TIM39)).to_be_visible()
    expect(page.get_by_test_id("count")).to_have_text("1 von 9 Läufen")
    expect(page.locator("[data-testid=issue-block]")).to_have_count(1)


def test_search_matches_issue_id_and_run_name(page):
    page.get_by_test_id("search").fill("TIM-45")
    expect(row(page, TIM45)).to_be_visible()
    page.get_by_test_id("search").fill("sweep_check")
    expect(row(page, ALONE)).to_be_visible()


def test_status_filters(page):
    page.get_by_role("button", name="Läuft", exact=True).click()
    expect(page.get_by_test_id("count")).to_have_text("1 von 9 Läufen")
    expect(row(page, TIM83)).to_be_visible()
    page.get_by_role("button", name="Mit Fehlern").click()
    expect(row(page, TIM39)).to_be_visible()  # its issue was collapsed and is expanded by the filter
    expect(page.get_by_test_id("count")).to_have_text("1 von 9 Läufen")
    page.get_by_role("button", name="Alle", exact=True).click()
    expect(page.get_by_test_id("count")).to_have_text("9 von 9 Läufen")


def test_epoch_filter(page):
    page.get_by_role("button", name="tsrm6", exact=True).click()
    expect(page.get_by_test_id("count")).to_have_text("3 von 9 Läufen")
    page.get_by_role("button", name="Alle Epochen").click()
    expect(page.get_by_test_id("count")).to_have_text("9 von 9 Läufen")


def test_empty_search_result_says_so(page):
    page.get_by_test_id("search").fill("zzzz-nothing")
    expect(page.get_by_test_id("empty")).to_have_text("Keine Läufe passen zu Suche und Filtern.")


def test_project_without_runs(empty_page):
    expect(empty_page.get_by_test_id("empty")).to_have_text("Dieses Projekt hat noch keine Läufe.")
    expect(empty_page.get_by_test_id("count")).to_have_text("0 von 0 Läufen")


def test_click_on_name_or_row_opens_the_experiment_in_a_tab(page):
    row(page, TIM71).locator(".run-name").click()
    expect(page.locator(f'[data-testid="tab-run"][data-run="{TIM71}"]')).to_have_class(re.compile("active"))
    page.get_by_test_id("tab-pinned").click()
    row(page, TIM83).click(position={"x": 400, "y": 10})
    expect(page.get_by_test_id("tab-run")).to_have_count(2)


def test_compare_needs_two_ticked_runs_and_opens_the_analysis(page):
    button = page.get_by_test_id("compare")
    expect(button).to_be_disabled()
    row(page, TIM71).get_by_test_id("sel").check()
    expect(button).to_be_disabled()
    row(page, ALONE).get_by_test_id("sel").check()
    expect(button).to_be_enabled()
    expect(button).to_have_text("Vergleichen (2)")
    assert page.get_by_test_id("tab-run").count() == 0  # ticking does not open the run
    button.click()
    expect(page.get_by_test_id("analysis-view")).to_be_visible()
    expect(page.get_by_test_id("compare-runs")).to_contain_text(TIM71)
    expect(page.get_by_test_id("compare-runs")).to_contain_text(ALONE)


def test_timeline_is_collapsed_by_default_and_opens_with_one_dot_per_run(page):
    expect(page.get_by_test_id("timeline")).to_have_count(0)
    page.get_by_test_id("toggle-timeline").click()
    expect(page.get_by_test_id("timeline")).to_be_visible()
    expect(page.get_by_test_id("timeline-dot")).to_have_count(9)
    # two horizons -> two series colours, runs of the older epoch at 40 % opacity
    colours = set(page.get_by_test_id("timeline-dot").evaluate_all("els => els.map(e => e.style.background)"))
    assert len(colours) == 2
    dim = page.locator(f'[data-testid="timeline-dot"][data-run="{TIM45}"]')
    assert float(dim.evaluate("e => e.style.opacity")) == 0.4
    expect(page.locator(".timeline .epoch-line")).to_have_count(1)


def test_click_on_a_timeline_point_expands_its_issue_and_marks_the_run(page):
    page.get_by_test_id("toggle-timeline").click()
    page.locator(f'[data-testid="timeline-dot"][data-run="{TIM45}"]').click()
    expect(row(page, TIM45)).to_be_visible()
    expect(row(page, TIM45)).to_have_class(re.compile("focused"))


def test_switching_between_list_and_issues_keeps_the_search(page):
    page.get_by_test_id("search").fill("TIM-52")
    page.get_by_test_id("view-issues").click()
    expect(page.get_by_test_id("search")).to_have_value("TIM-52")
    expect(page.get_by_test_id("issue-item")).to_have_count(1)
    page.get_by_test_id("view-list").click()
    expect(page.get_by_test_id("search")).to_have_value("TIM-52")


def test_without_linear_key_issue_head_shows_only_the_id(page):
    head = block(page, "TIM-52").locator(".issue-head")
    expect(head.locator(".issue-key")).to_have_text("TIM-52")
    expect(head.locator(".issue-title")).to_have_count(0)
    expect(head.locator(".status-dot")).to_have_count(0)


def test_with_linear_key_issue_head_has_title_status_and_dot(linear_page):
    head = linear_page.locator('[data-testid="issue-block"][data-issue="TIM-52"] .issue-head')
    expect(head.locator(".issue-title")).to_have_text("Beste Config zusammenführen")
    expect(head.locator(".issue-status")).to_have_text("In Progress")
    assert head.locator(".status-dot").evaluate("e => e.style.background") == "var(--accent)"


def test_search_finds_the_issue_title_from_linear(linear_page):
    linear_page.get_by_test_id("search").fill("zusammenführen")
    expect(linear_page.locator("[data-testid=issue-block]")).to_have_count(1)


def test_report_and_deliverables_links_appear_only_when_they_exist(page):
    head = block(page, "TIM-52").locator(".issue-head")
    expect(head.get_by_test_id("link-report")).to_have_count(1)
    expect(head.get_by_test_id("link-deliverables")).to_have_count(1)
    expect(block(page, "TIM-71").get_by_test_id("link-report")).to_have_count(0)
    head.get_by_test_id("link-report").click()
    expect(page.get_by_test_id("toast")).to_have_text("Pfad kopiert: analysis/TIM-52_best_config")


# --- view Issues ------------------------------------------------------------------------------
def test_issues_view_selects_the_issue_of_the_newest_run_first(page):
    page.get_by_test_id("view-issues").click()
    expect(page.get_by_test_id("issue-detail")).to_have_attribute("data-issue", "TIM-83")
    expect(page.locator('[data-testid="issue-item"].active')).to_have_attribute("data-issue", "TIM-83")


def test_issues_list_has_the_order_of_the_list_view_and_an_entry_for_runs_without_issue(page):
    page.get_by_test_id("view-issues").click()
    keys = page.get_by_test_id("issue-item").evaluate_all("els => els.map(e => e.dataset.issue)")
    assert keys == ["TIM-83", "—", "TIM-71", "TIM-52", "TIM-45", "TIM-39", "TIM-30"]
    expect(page.locator('[data-testid="issue-item"][data-issue="TIM-83"]')).to_contain_text("● läuft")
    expect(page.locator('[data-testid="issue-item"][data-issue="—"]')).to_contain_text("Ohne Issue")


def test_issue_detail_shows_figures_and_one_card_per_experiment_with_all_runs(page):
    page.get_by_test_id("view-issues").click()
    page.locator('[data-testid="issue-item"][data-issue="TIM-52"]').click()
    detail = page.get_by_test_id("issue-detail")
    stats = detail.locator(".stat")
    expect(stats.nth(0)).to_contain_text("Läufe")
    expect(stats.nth(0)).to_contain_text("3")
    expect(stats.nth(1)).to_have_text(re.compile(r"Zellen\s*90\s*0 Fehler"))  # 3 runs x 30 cells
    expect(detail.locator(".stat", has_text="pred_len 30")).to_have_count(1)
    expect(detail.locator(".stat", has_text="pred_len 90")).to_have_count(1)
    cards = detail.get_by_test_id("exp-card")
    expect(cards).to_have_count(2)
    # experiments by their newest run: best_90 (one run) before best_30 (two runs)
    expect(cards.nth(0).get_by_test_id("exp-run")).to_have_count(1)
    expect(cards.nth(1).get_by_test_id("exp-run")).to_have_count(2)


def test_issues_view_open_button_opens_the_run(page):
    page.get_by_test_id("view-issues").click()
    page.get_by_test_id("issue-detail").get_by_test_id("open").first.click()
    expect(page.locator(f'[data-testid="tab-run"][data-run="{TIM83}"]')).to_have_class(re.compile("active"))


def test_issues_view_with_linear_has_link_and_status_pill(linear_page):
    linear_page.get_by_test_id("view-issues").click()
    linear_page.locator('[data-testid="issue-item"][data-issue="TIM-52"]').click()
    detail = linear_page.get_by_test_id("issue-detail")
    expect(detail.locator("h1")).to_have_text("Beste Config zusammenführen")
    expect(detail.get_by_role("link", name="In Linear ↗")).to_have_attribute("href", "https://linear.example/TIM-52")
    expect(detail.locator(".status-pill")).to_have_text(re.compile("In Progress"))
