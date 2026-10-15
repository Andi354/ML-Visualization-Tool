"""Feature E (two runs, project history) in the browser."""

import json
import re

import pandas as pd
from playwright.sync_api import expect

from mlviz.fixture import RUNS, run_folder

from .helpers import folder, open_run

A30 = folder("TIM-52_best_30", 0)
A30B = folder("TIM-52_best_30", 1)
B90 = folder("TIM-52_best_90")
T45 = folder("TIM-45_g6_combined")
T71 = folder("TIM-71_example")
T83 = folder("TIM-83_running_sweep")
T39 = folder("TIM-39_grid_multivariate_30")
ALONE = folder("sweep_check")

DEFAULT_TWO = ["config-diff", "who-wins", "best-config", "all-combos", "regions-ab", "scope-errors"]


def board(page):
    return page.locator('[data-testid="board-page"] [data-testid="board"]')


def tile(page, key):
    return board(page).locator(f'[data-testid="widget-tile"][data-widget="{key}"]')


def go_two(page, a=A30, b=B90):
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("analysis-view-two").click()
    page.get_by_test_id("run-a").select_option(a)
    page.get_by_test_id("run-b").select_option(b)
    page.wait_for_load_state("networkidle")
    expect(tile(page, "config-diff").get_by_test_id("widget-title")).to_be_visible()


def enable(page, *keys):
    page.get_by_test_id("widgets-menu").click()
    for k in keys:
        page.locator(f'[data-testid="widget-toggle"][data-widget="{k}"]').check()
    page.get_by_test_id("widgets-menu").click()
    page.wait_for_load_state("networkidle")


def api(page, key, body):
    return page.evaluate(
        """async ([key, body]) => (await fetch('/api/widgets/' + key, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)})).json()""",
        [key, body],
    )


# --- entry points and header ---------------------------------------------------------------------------
def test_two_ticked_runs_open_the_two_run_analysis_with_a_and_b(page):
    page.get_by_test_id("area-runs").click()
    page.locator(f'[data-testid="run-row"][data-run="{ALONE}"] [data-testid="sel"]').check()
    page.locator(f'[data-testid="run-row"][data-run="{T71}"] [data-testid="sel"]').check()
    page.get_by_test_id("compare").click()
    expect(page.get_by_test_id("analysis-view-two")).to_have_attribute("aria-pressed", "true")
    expect(page.get_by_test_id("run-a")).to_have_value(ALONE)  # list order: the newer run first
    expect(page.get_by_test_id("run-b")).to_have_value(T71)


def test_more_than_two_ticked_runs_compare_the_first_two_and_say_so(page):
    page.get_by_test_id("area-runs").click()
    for r in (ALONE, T71, B90):
        page.locator(f'[data-testid="run-row"][data-run="{r}"]').get_by_test_id("sel").check()
    page.get_by_test_id("compare").click()
    expect(page.get_by_test_id("compare-note")).to_have_text("Nur die ersten beiden Läufe werden verglichen")


def test_vergleichen_mit_in_a_run_tab(page):
    open_run(page, A30B)
    view = page.locator('[data-testid="exp-view"]:visible')
    view.get_by_test_id("compare-with").click()
    items = view.get_by_test_id("compare-with-item")
    assert A30B not in items.evaluate_all("els => els.map(e => e.dataset.run)")
    view.locator(f'[data-testid="compare-with-item"][data-run="{B90}"]').click()
    expect(page.get_by_test_id("analysis-view-two")).to_have_attribute("aria-pressed", "true")
    expect(page.get_by_test_id("run-a")).to_have_value(A30B)
    expect(page.get_by_test_id("run-b")).to_have_value(B90)


def test_header_colours_the_runs_and_counts_matching_combinations(page):
    go_two(page)
    dots = page.locator(".run-dot")
    assert dots.nth(0).evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(31, 163, 163)"  # A = series 1
    assert dots.nth(1).evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(140, 124, 240)"  # B = series 5
    expect(page.get_by_test_id("both-count")).to_have_text("5 von 5 Kombinationen in beiden Läufen")
    page.get_by_test_id("run-a").select_option(T45)
    page.get_by_test_id("run-b").select_option(T71)
    expect(page.get_by_test_id("both-count")).to_have_text("2 von 2 Kombinationen in beiden Läufen")


def test_default_widgets_are_the_six_required_ones_the_three_optional_ones_are_off(page):
    go_two(page)
    order = board(page).get_by_test_id("widget-tile").evaluate_all("els => els.map(e => e.dataset.widget)")
    assert order == DEFAULT_TWO
    expect(page.get_by_test_id("widgets-menu")).to_have_text("Widgets · 6 von 9")
    page.get_by_test_id("widgets-menu").click()
    optional = page.locator('[data-testid="widget-toggle"]').evaluate_all("els => els.filter(e => !e.checked).map(e => e.dataset.widget)")
    assert optional == ["param-effect", "rank-stability", "rank-jumps"]


# --- the widgets -----------------------------------------------------------------------------------------
def test_config_differences_as_chips_with_a_warning_for_a_lauf_merkmal(page):
    go_two(page)
    t = tile(page, "config-diff")
    chip = t.locator('[data-testid="diff-chip"][data-key="data.pred_len"]')
    expect(chip).to_have_text("data.pred_len 30 → 90")
    expect(t.locator('[data-testid="diff-chip"][data-key="commit"]')).to_be_visible()
    warn = t.locator('[data-testid="diff-warning"][data-kind="merkmal"]')
    expect(warn).to_contain_text("absolute Werte sind nicht fair vergleichbar, Rang und Effekt schon")
    assert warn.evaluate("e => getComputedStyle(e).color") == "rgb(240, 180, 76)"  # warn
    assert warn.locator("svg").count() == 1  # with icon


def test_different_epochs_warn_in_the_config_differences(page):
    go_two(page, T45, T71)
    warn = tile(page, "config-diff").locator('[data-testid="diff-warning"][data-kind="epoch"]')
    expect(warn).to_contain_text("tsrm6")
    expect(tile(page, "who-wins")).to_be_visible()  # the comparison stays possible


def test_who_wins_rows_best_value_bars_and_verdict(page):
    go_two(page)
    t = tile(page, "who-wins")
    expect(t.get_by_test_id("wins-row")).to_have_count(10)
    expect(t.get_by_test_id("scaled-tag")).to_have_count(4)  # scaled metrics are marked
    expect(t.get_by_test_id("widget-title")).to_have_text("A ist bei 8 von 10 Metriken besser. Nicht eindeutig: B gewinnt bei 2.")
    row = t.locator('[data-testid="wins-row"][data-metric="test_mape"]')
    assert row.get_by_test_id("wins-a").evaluate("e => e.classList.contains('best')")
    assert not row.get_by_test_id("wins-b").evaluate("e => e.classList.contains('best')")
    fills = t.get_by_test_id("wins-fill")
    expect(fills).to_have_count(10)
    # the diverging bar grows from the centre towards the better run (A = left)
    assert row.get_by_test_id("wins-fill").evaluate("e => e.classList.contains('a')")
    widths = fills.evaluate_all("els => els.map(e => e.getBoundingClientRect().width)")
    assert max(widths) > 40 and all(w > 0 for w in widths)


def test_who_wins_switches_between_best_value_and_median(page):
    go_two(page)
    t = tile(page, "who-wins")
    best = t.locator('[data-metric="test_mape"] [data-testid="wins-a"]').inner_text()
    t.get_by_test_id("tile-settings").click()
    t.get_by_test_id("set-mode-median").click()
    expect(t.locator(".w-sub")).to_contain_text("Median")
    assert t.locator('[data-metric="test_mape"] [data-testid="wins-a"]').inner_text() != best


def test_who_wins_hides_scaled_metrics_when_the_forecasters_differ(page):
    go_two(page, T45, T71)
    t = tile(page, "who-wins")
    expect(t.get_by_test_id("wins-row")).to_have_count(6)
    expect(t.get_by_test_id("scaled-tag")).to_have_count(0)
    expect(t).to_contain_text("Skalierte Metriken sind ausgeblendet")


def test_best_config_per_run_with_the_rank_in_the_other_run(page):
    go_two(page)
    t = tile(page, "best-config")
    expect(t.get_by_test_id("widget-title")).to_have_text("Das Beste von A ist in B auf Rang 1 von 5")
    expect(t.locator('[data-testid="bc-a"] .chip')).to_have_text("forecaster = rep-net")
    other = t.get_by_test_id("bc-other-a")
    expect(other).to_contain_text("Rang 1 von 5")
    expect(other).to_have_attribute("data-flag", "best")  # rank <= 3
    assert other.evaluate("e => getComputedStyle(e).color") == "rgb(95, 212, 160)"


def test_best_config_rank_above_ten_is_flagged_warn(writable_page):
    page = writable_page
    root = page.writable_root
    import shutil

    from mlviz.fixture import RUNS as R

    src = root / "runs" / run_folder(R[1])
    copy = root / "runs" / "2026-09-19_140500_TIM-39_reversed"
    if not copy.exists():
        shutil.copytree(src, copy)
        cells = pd.read_parquet(copy / "cells.parquet")
        cells["test_mape"] = cells["test_mape"].max() + cells["test_mape"].min() - cells["test_mape"]
        cells.to_parquet(copy / "cells.parquet")
    page.reload()
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("analysis-view-two").click()
    page.get_by_test_id("run-a").select_option(run_folder(R[1]))
    page.get_by_test_id("run-b").select_option(copy.name)
    page.wait_for_load_state("networkidle")
    other = tile(page, "best-config").get_by_test_id("bc-other-a")
    expect(other).to_have_attribute("data-flag", "warn")
    assert other.evaluate("e => getComputedStyle(e).color") == "rgb(240, 180, 76)"


def test_all_combinations_strip_plot_per_run(page):
    go_two(page)
    t = tile(page, "all-combos")
    expect(t.get_by_test_id("dot-a")).to_have_count(5)
    expect(t.get_by_test_id("dot-b")).to_have_count(5)
    expect(t.get_by_test_id("best-a")).to_have_count(1)
    expect(t.get_by_test_id("median-b")).to_have_count(1)
    assert float(t.get_by_test_id("best-a").get_attribute("r")) > 3  # enlarged
    assert t.get_by_test_id("best-a").get_attribute("stroke")  # with ring
    expect(t.get_by_test_id("widget-title")).to_contain_text("A liegt in der Mitte besser")


def test_regions_two_bars_per_channel_and_the_difference(page):
    go_two(page)
    t = tile(page, "regions-ab")
    expect(t.get_by_test_id("region-pair")).to_have_count(4)
    expect(t.get_by_test_id("bar-a")).to_have_count(4)
    texts = t.get_by_test_id("region-diff").evaluate_all("els => els.map(e => e.textContent)")
    assert len(texts) == 4 and all(re.match(r"^[+−]\d+,\d\u202f?%$|^[+−]\d+,\d %$", x) for x in texts)
    expect(t.get_by_test_id("widget-title")).to_have_text("A ist in 4 von 4 Regionen besser")


def test_scope_and_errors_table_and_the_error_limit(writable_page):
    page = writable_page
    root = page.writable_root
    path = root / "runs" / T39.split("/")[-1] / "cells.parquet"
    df = pd.read_parquet(path)
    ok = df.index[df["status"] == "ok"][:60]
    df.loc[ok, "status"] = "error"
    df.loc[ok, "test_mape"] = None
    df.to_parquet(path)
    page.reload()
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("analysis-view-two").click()
    page.get_by_test_id("run-a").select_option(T39)
    page.get_by_test_id("run-b").select_option(A30)
    page.wait_for_load_state("networkidle")
    t = tile(page, "scope-errors")
    rows = {r: t.locator(f'[data-testid="scope-row"][data-label="{r}"]') for r in ("Zellen", "Fehler", "Dauer", "pred_len", "Epoche")}
    expect(rows["Zellen"]).to_contain_text("294")
    errors = rows["Fehler"].get_by_test_id("errors-value")
    expect(errors.first).to_have_attribute("data-over", "true")
    assert errors.first.evaluate("e => getComputedStyle(e).color") == "rgb(255, 107, 107)"
    expect(errors.nth(1)).to_have_attribute("data-over", "false")
    expect(rows["pred_len"]).to_contain_text("30")
    expect(rows["Epoche"]).to_contain_text("tsrm6")
    assert re.search(r"\d+ min|\d+ h", rows["Dauer"].inner_text())


def test_a_running_run_shows_läuft_instead_of_a_duration(page):
    go_two(page, T83, A30)
    expect(tile(page, "scope-errors").locator('[data-label="Dauer"]')).to_contain_text("läuft")


# --- optional widgets -------------------------------------------------------------------------------------------
def test_param_effect_dumbbells_and_flips(page):
    go_two(page, T45, T71)
    enable(page, "param-effect")
    t = tile(page, "param-effect")
    pairs = t.get_by_test_id("effect-pair")
    expect(pairs).to_have_count(2)  # lstm_layer 0 and 1
    expect(t.get_by_test_id("effect-a")).to_have_count(2)
    data = api(page, "param-effect", {"scope": "two-runs", "runs": [T45, T71]})
    flips = sum(1 for r in data["data"]["rows"] if r["flips"])
    expect(t.get_by_test_id("flip-tag")).to_have_count(flips)
    expect(t.get_by_test_id("widget-title")).to_have_text(data["title"])
    t.get_by_test_id("tile-settings").click()
    t.get_by_test_id("set-sort-difference").click()
    expect(t.locator(".w-sub")).to_be_visible()


def test_rank_stability_scatter_and_numbers(page):
    go_two(page, A30, A30B)
    enable(page, "rank-stability")
    t = tile(page, "rank-stability")
    expect(t.get_by_test_id("rank-point")).to_have_count(5)
    expect(t.get_by_test_id("diagonal")).to_have_count(1)
    data = api(page, "rank-stability", {"scope": "two-runs", "runs": [A30, A30B]})["data"]
    expect(t.get_by_test_id("spearman")).to_have_text(re.compile(r"^Spearman "))
    expect(t.get_by_test_id("top-overlap")).to_have_text(f"Top 5: {data['top_overlap'][0]} gemeinsam")
    expect(t.get_by_test_id("best-rank")).to_have_text(f"Bestes von A ist in B Rang {data['best_a_rank_in_b']}")


def test_rank_jumps_lists_up_to_seven_combinations(page):
    go_two(page, T39, T39)
    enable(page, "rank-jumps")
    t = tile(page, "rank-jumps")
    expect(t.get_by_test_id("widget-title")).to_have_text("Keine Rangänderung: Die Rangfolge ist in beiden Läufen gleich")
    expect(t.get_by_test_id("jump-row")).to_have_count(7)


def test_runs_without_shared_axes_say_so_and_cannot_be_saved(page):
    go_two(page, T83, ALONE)
    enable(page, "param-effect")
    t = tile(page, "param-effect")
    expect(t.get_by_test_id("widget-unavailable")).to_have_text("Keine gemeinsamen Kombinationen")
    expect(t.get_by_test_id("tile-save")).to_be_disabled()


def test_a_two_run_image_names_both_runs_in_its_footer(page):
    go_two(page)
    tile(page, "who-wins").get_by_test_id("tile-save").click()
    footer = page.get_by_test_id("save-dialog").get_by_test_id("export-footer")
    expect(footer).to_contain_text(A30)
    expect(footer).to_contain_text(B90)
    expect(page.get_by_test_id("save-dialog").get_by_test_id("folder-title")).to_have_value("TIM-52_best_30 gegen TIM-52_best_90")


# --- Projektverlauf ----------------------------------------------------------------------------------------------
def go_project(page):
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("analysis-view-project").click()
    page.wait_for_load_state("networkidle")
    expect(tile(page, "project-best").get_by_test_id("widget-title")).to_be_visible()


def test_project_view_has_the_history_widget_and_the_optional_map(page):
    go_project(page)
    assert board(page).get_by_test_id("widget-tile").evaluate_all("els => els.map(e => e.dataset.widget)") == ["project-best"]
    expect(page.get_by_test_id("widgets-menu")).to_have_text("Widgets · 1 von 2")
    expect(page.get_by_test_id("color-by")).to_be_visible()


def test_best_value_per_run_points_labels_lines_and_epochs(page):
    go_project(page)
    t = tile(page, "project-best")
    points = t.get_by_test_id("pb-point")
    expect(points).to_have_count(9)
    expect(t.locator(f'[data-testid="pb-point"][data-run="{B90}"] text')).to_have_text("TIM-52")  # label = issue key
    older = t.locator('[data-testid="pb-point"][data-older="true"]')
    expect(older).to_have_count(3)  # runs of the older epoch
    assert older.first.locator("circle").last.get_attribute("fill") == "var(--bg)"  # hollow
    expect(t.get_by_test_id("best-line")).to_have_count(2)  # one per Lauf-Merkmal value
    expect(t.get_by_test_id("epoch-line")).to_have_count(1)
    expect(t.locator(f'[data-testid="pb-point"][data-run="{T83}"] text')).to_contain_text("vorläufig")
    expect(t.get_by_test_id("widget-title")).to_have_text("Bestes Ergebnis der aktuellen Epoche: 2,674 % (TIM-52, pred_len 30)")


def test_colouring_by_the_lauf_merkmal_or_not_at_all(page):
    go_project(page)
    t = tile(page, "project-best")
    options = page.get_by_test_id("color-by").locator("option").all_inner_texts()
    assert options == ["keins", "pred_len"]
    expect(t.locator(".legend")).to_have_count(2)
    page.get_by_test_id("color-by").select_option("none")
    expect(t.locator(".legend")).to_have_count(0)  # one series
    expect(t.get_by_test_id("best-line")).to_have_count(1)


def test_clicking_a_point_toggles_the_run_for_the_map_and_is_remembered(page):
    go_project(page)
    t = tile(page, "project-best")
    point = t.locator(f'[data-testid="pb-point"][data-run="{B90}"]')
    expect(point).to_have_attribute("data-selected", "true")  # default selection: finished runs of the current epoch
    point.click()
    expect(point).to_have_attribute("data-selected", "false")
    expect(t.get_by_test_id("selected-ring")).to_have_count(4)
    page.reload()
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("analysis-view-project").click()
    expect(tile(page, "project-best").locator(f'[data-testid="pb-point"][data-run="{B90}"]')).to_have_attribute("data-selected", "false")
    page.get_by_test_id("reset-selection").click()
    expect(tile(page, "project-best").locator(f'[data-testid="pb-point"][data-run="{B90}"]')).to_have_attribute("data-selected", "true")


def test_parameter_map_cells_empty_cells_and_consistency(page):
    go_project(page)
    enable(page, "param-map")
    t = tile(page, "param-map")
    expect(t.get_by_test_id("pm-row").first).to_be_visible()
    rows = t.get_by_test_id("pm-row")
    row = t.locator('[data-testid="pm-row"][data-axis="forecaster"][data-value="rep-net"]')
    cells = row.get_by_test_id("pm-cell")
    assert cells.evaluate_all("els => els.filter(e => e.dataset.empty === 'true').length") == 1  # sweep_check: forecaster not varied
    assert row.locator('[data-direction="better"]').count() == 4  # lower error = better = diverging teal
    assert row.locator('[data-direction="better"]').first.evaluate("e => e.style.background").startswith("color-mix")
    assert t.locator('[data-axis="forecaster"][data-value="snaive"] [data-direction="worse"]').count() >= 3
    expect(row.get_by_test_id("pm-consistency").first).to_have_text("immer besser")
    assert rows.count() == 9
    header = t.locator(".group-head").all_inner_texts()
    assert any("pred_len 30" in h for h in header) and any("pred_len 90" in h for h in header)


def test_parameter_map_warns_when_the_direction_flips_between_lauf_merkmal_values(writable_page):
    page = writable_page
    root = page.writable_root
    path = root / "runs" / B90.split("/")[-1] / "cells.parquet"
    df = pd.read_parquet(path)
    df.loc[df["forecaster"] == "ets", "test_mape"] = df["test_mape"].min() * 0.5
    df.loc[df["forecaster"] == "rep-net", "test_mape"] = df["test_mape"].max() * 2
    df.to_parquet(path)
    page.reload()
    go_project(page)
    enable(page, "param-map")
    t = tile(page, "param-map")
    flipped = t.locator('[data-testid="pm-row"][data-flips="true"]')
    expect(flipped.first).to_be_visible()
    cons = flipped.first.get_by_test_id("pm-consistency").first
    assert cons.evaluate("e => getComputedStyle(e).color") == "rgb(240, 180, 76)"
    expect(t.get_by_test_id("widget-title")).to_contain_text("verschieden")


def test_a_project_image_names_the_project_in_its_footer(page):
    go_project(page)
    tile(page, "project-best").get_by_test_id("tile-save").click()
    expect(page.get_by_test_id("save-dialog").get_by_test_id("export-footer")).to_have_text("Projekt Demo Bench · 9 Läufe")
