"""v0.2.1 · H: description in the run tab, one scroll column. Clock fixed at 2026-10-15 12:00."""

from playwright.sync_api import expect

from .helpers import folder, open_run

BEST_90 = folder("TIM-52_best_90")
BEST_30_SECOND = folder("TIM-52_best_30", 1)
TIM45 = folder("TIM-45_g6_combined")  # description with a problem (shows is missing)
TIM39 = folder("TIM-39_grid_multivariate_30")  # no description, a long table
TIM83 = folder("TIM-83_running_sweep")


def view(page):
    return page.locator('[data-testid="exp-view"]:visible')


def start(page, run_id):
    open_run(page, run_id)
    expect(view(page).get_by_test_id("exp-row").first).to_be_visible()


def y(locator):
    return locator.bounding_box()["y"]


def test_the_description_comes_first_then_overview_then_toolbar_and_table(page):
    start(page, BEST_90)
    v = view(page)
    expect(v.get_by_test_id("description-short")).to_have_text("Bestes Setup aus dem Grid mit Horizont 90 gegen die Baselines")
    assert y(v.get_by_test_id("description")) < y(v.get_by_test_id("overview-line")) < y(v.get_by_test_id("overview"))
    assert y(v.get_by_test_id("overview")) < y(v.get_by_test_id("exp-toolbar")) < y(v.locator(".exp-table"))


def test_the_fields_stand_side_by_side_in_a_fixed_order(page):
    start(page, BEST_90)
    fields = view(page).get_by_test_id("description-fields").locator("[data-field]")
    assert fields.evaluate_all("els => els.map(e => e.dataset.field)") == ["purpose", "shows", "expectation", "notes"]
    boxes = fields.evaluate_all("els => els.map(e => e.getBoundingClientRect().toJSON())")
    assert len({round(b["y"]) for b in boxes}) == 1  # one row
    assert boxes[0]["width"] > boxes[1]["width"] * 1.3  # Zweck is the widest column
    expect(fields.first.locator("p")).to_have_count(2)  # one paragraph per line break
    expect(fields.nth(1).locator("li")).to_have_count(2)
    labels = view(page).locator(".desc-field-label").all_text_contents()
    assert labels == ["Zweck", "Soll zeigen", "Erwartung", "Notizen", "Vergleichen mit"]


def test_a_click_on_the_line_folds_and_unfolds_it(page):
    start(page, BEST_90)
    v = view(page)
    toggle = v.get_by_test_id("description-toggle")
    expect(toggle).to_contain_text("zuklappen ▴")
    toggle.click()
    expect(toggle).to_contain_text("aufklappen ▾")
    expect(v.get_by_test_id("description-fields")).to_have_count(0)
    expect(v.get_by_test_id("description-short")).to_be_visible()  # the folded line keeps the short text
    toggle.click()
    expect(v.get_by_test_id("description-fields")).to_be_visible()


def test_the_folded_state_is_kept_for_the_run_across_a_reload(page):
    start(page, BEST_90)
    view(page).get_by_test_id("description-toggle").click()
    page.reload()
    expect(page.get_by_test_id("tab-run").first).to_be_visible()
    expect(view(page).get_by_test_id("description-toggle")).to_contain_text("aufklappen ▾")
    expect(view(page).get_by_test_id("description-fields")).to_have_count(0)


def test_a_run_without_a_description_starts_with_the_overview(page):
    start(page, TIM83)
    v = view(page)
    expect(v.get_by_test_id("description")).to_have_count(0)
    first = v.locator(".exp-main > *").first
    assert first.get_attribute("data-testid") == "overview-line"


def test_a_description_with_problems_warns_and_still_shows_the_fields(page):
    start(page, TIM45)
    v = view(page)
    expect(v.get_by_test_id("description-problems")).to_have_text("Beschreibung unvollständig:shows fehlt")
    expect(v.get_by_test_id("description-fields").locator("[data-field=purpose]")).to_be_visible()
    assert y(v.get_by_test_id("description-problems")) < y(v.get_by_test_id("description-fields"))


def test_a_chip_opens_the_run_as_a_tab_or_focuses_it(page):
    start(page, BEST_90)
    chip = view(page).locator(f'[data-testid="description-chip"][data-run="{BEST_30_SECOND}"]')
    expect(chip).to_have_text("TIM-52_best_30")
    chip.click()
    expect(page.get_by_test_id("tab-run")).to_have_count(2)
    expect(page.locator('[data-testid="tab-run"][aria-selected="true"]')).to_contain_text("best_30")
    page.get_by_test_id("tab-run").first.click()
    view(page).locator(f'[data-testid="description-chip"][data-run="{BEST_30_SECOND}"]').click()
    expect(page.get_by_test_id("tab-run")).to_have_count(2)  # already open: it only gets the focus


def test_an_unknown_run_name_is_a_struck_through_chip_that_does_nothing(page):
    start(page, BEST_90)
    unknown = view(page).get_by_test_id("description-chip").filter(has_text="TIM-99_gibt_es_nicht")
    assert unknown.get_attribute("title") == "TIM-99_gibt_es_nicht · nicht gefunden"
    assert "line-through" in unknown.evaluate("e => getComputedStyle(e).textDecorationLine")
    assert unknown.evaluate("e => e.tagName") == "SPAN"
    unknown.click()
    expect(page.get_by_test_id("tab-run")).to_have_count(1)


def test_the_overview_line_and_the_toolbar_button_fold_the_same_graphs(page):
    start(page, BEST_90)
    v = view(page)
    expect(v.get_by_test_id("overview")).to_be_visible()
    v.get_by_test_id("overview-line").click()
    expect(v.get_by_test_id("overview")).to_have_count(0)
    expect(v.get_by_test_id("overview-line")).to_contain_text("aufklappen ▾")
    expect(v.get_by_test_id("toggle-overview")).to_have_attribute("aria-pressed", "false")
    v.get_by_test_id("toggle-overview").click()
    expect(v.get_by_test_id("overview")).to_be_visible()
    expect(v.get_by_test_id("overview-line")).to_contain_text("zuklappen ▴")


def test_toolbar_and_table_header_stick_while_the_column_scrolls(page):
    page.set_viewport_size({"width": 1400, "height": 600})
    start(page, TIM39)
    v = view(page)
    main = v.get_by_test_id("exp-main")
    overview_before = y(v.get_by_test_id("overview-line"))
    assert main.evaluate("e => e.scrollHeight > e.clientHeight")
    main.evaluate("e => { e.scrollTop = 400; }")
    top = main.bounding_box()["y"]
    toolbar = v.get_by_test_id("exp-toolbar").bounding_box()
    assert abs(toolbar["y"] - top) < 2  # the toolbar sticks to the top of the column
    head = v.locator(".exp-table .group-row th").first.bounding_box()
    assert abs(head["y"] - (top + toolbar["height"])) < 2  # the header row sticks right below it
    col_head = v.locator(".exp-table .col-row th").first.bounding_box()
    assert abs(col_head["y"] - (head["y"] + head["height"])) < 2
    assert y(v.get_by_test_id("overview-line")) < overview_before - 100  # the rest scrolled away


def test_the_toolbar_height_is_measured_not_fixed(page):
    start(page, TIM39)
    v = view(page)
    height = v.get_by_test_id("exp-toolbar").bounding_box()["height"]
    value = v.get_by_test_id("exp-main").evaluate("e => parseFloat(e.style.getPropertyValue('--toolbar-h'))")
    assert abs(value - height) < 2


def test_the_detail_panel_stays_beside_the_scroll_column(page):
    start(page, BEST_90)
    v = view(page)
    v.get_by_test_id("exp-row").first.click()
    panel = v.get_by_test_id("detail-panel")
    expect(panel).to_be_visible()
    main_box = v.get_by_test_id("exp-main").bounding_box()
    assert panel.bounding_box()["x"] >= main_box["x"] + main_box["width"] - 2
