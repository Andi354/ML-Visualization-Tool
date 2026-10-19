"""Feature B (frame) in the browser."""

import re

from playwright.sync_api import expect

from .helpers import folder, open_run

A = folder("TIM-52_best_30", 0)
B = folder("TIM-52_best_90")
RUNS_FOR_TABS = [folder("TIM-52_best_30", 0), folder("TIM-52_best_90"), folder("TIM-71_example"), folder("TIM-83_running_sweep")]


def test_icon_bar_shows_project_badge_with_tooltip(page):
    badge = page.get_by_test_id("project-badge")
    expect(badge).to_have_text("DB")
    expect(badge).to_have_attribute("title", "Demo Bench")


def test_icon_bar_has_the_two_areas_and_marks_the_active_one(page):
    expect(page.get_by_test_id("area-runs")).to_have_class(re.compile("active"))
    expect(page.get_by_test_id("area-analysis")).not_to_have_class(re.compile("active"))


def test_frame_dimensions_follow_the_tokens(page):
    assert page.get_by_test_id("tab-strip").bounding_box()["height"] == 36
    assert page.locator(".icon-bar").bounding_box()["width"] == 52
    assert page.locator("body").evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(13, 16, 22)"


def test_pinned_tab_shows_the_area_and_has_no_close_button(page):  # also: area label follows the icon
    pinned = page.get_by_test_id("tab-pinned")
    expect(pinned).to_have_text("Läufe")
    assert pinned.locator(".tab-close").count() == 0
    page.get_by_test_id("area-analysis").click()
    expect(pinned).to_have_text("Analyse")
    expect(page.get_by_test_id("analysis-view")).to_be_visible()


def test_opening_a_run_creates_a_focused_tab_labelled_without_timestamp(page):
    open_run(page, A)
    tab = page.get_by_test_id("tab-run")
    expect(tab).to_have_count(1)
    expect(tab.locator(".tab-label")).to_have_text("TIM-52_best_30")
    expect(tab).to_have_attribute("title", A)
    expect(tab).to_have_class(re.compile("active"))
    expect(page.get_by_test_id("run-body")).to_be_visible()


def test_opening_the_same_run_again_focuses_the_existing_tab(page):
    open_run(page, A)
    open_run(page, A)
    expect(page.get_by_test_id("tab-run")).to_have_count(1)
    expect(page.get_by_test_id("tab-run")).to_have_class(re.compile("active"))


def test_closing_the_active_tab_focuses_the_tab_to_its_left(page):
    open_run(page, A)
    open_run(page, B)
    page.locator(f'[data-testid="tab-run"][data-run="{B}"] [data-testid="tab-close"]').click()
    expect(page.locator(f'[data-testid="tab-run"][data-run="{A}"]')).to_have_class(re.compile("active"))
    page.locator(f'[data-testid="tab-run"][data-run="{A}"] [data-testid="tab-close"]').click()
    expect(page.get_by_test_id("tab-pinned")).to_have_class(re.compile("active"))
    expect(page.get_by_test_id("runs-view")).to_be_visible()
    expect(page.get_by_test_id("view-issues")).to_have_attribute("aria-pressed", "true")


def test_middle_click_closes_a_run_tab(page):
    open_run(page, A)
    page.locator(f'[data-testid="tab-run"][data-run="{A}"]').click(button="middle")
    expect(page.get_by_test_id("tab-run")).to_have_count(0)


def test_switching_area_keeps_run_tabs(page):
    open_run(page, A)
    page.get_by_test_id("area-analysis").click()
    expect(page.get_by_test_id("tab-run")).to_have_count(1)
    expect(page.get_by_test_id("tab-pinned")).to_have_class(re.compile("active"))


def test_open_tabs_and_active_tab_survive_a_reload(page):
    open_run(page, A)
    open_run(page, B)
    page.reload()
    expect(page.get_by_test_id("tab-run")).to_have_count(2)
    expect(page.locator(f'[data-testid="tab-run"][data-run="{B}"]')).to_have_class(re.compile("active"))


def test_many_tabs_keep_their_width_and_the_strip_wraps_instead_of_scrolling(page):
    page.set_viewport_size({"width": 700, "height": 900})
    ids = [r["id"] for r in page.evaluate("fetch('/api/runs').then(r => r.json())")]
    for rid in ids:
        open_run(page, rid)
    tabs = page.get_by_test_id("tab-run")
    assert tabs.count() == len(ids)
    widths = [tabs.nth(i).bounding_box()["width"] for i in range(tabs.count())]
    assert min(widths) >= 80
    strip = page.get_by_test_id("tab-strip")
    assert not strip.evaluate("e => e.scrollWidth > e.clientWidth")
    assert strip.bounding_box()["height"] > 36 * 2 - 10  # several rows


def test_deleted_run_keeps_its_tab_and_says_so(page):
    # An init script runs before the app on the next load, after the old page flushed its state.
    page.add_init_script(
        """localStorage.setItem('mlviz:v1:Demo Bench:frame',
            JSON.stringify({area: 'runs', tabs: ['2020-01-01_000000_gone'], active: '2020-01-01_000000_gone', runsView: 'list'}))"""
    )
    page.reload()
    expect(page.get_by_test_id("tab-run")).to_have_count(1)
    expect(page.get_by_test_id("run-missing")).to_contain_text("Lauf nicht mehr vorhanden")
    page.get_by_test_id("run-missing").get_by_role("button", name="Tab schließen").click()
    expect(page.get_by_test_id("tab-run")).to_have_count(0)


def test_keyboard_focus_is_visible(page):
    page.keyboard.press("Tab")
    outline = page.evaluate("getComputedStyle(document.activeElement).outlineStyle")
    assert outline == "solid"


def test_the_runs_area_remembers_its_view_across_area_switches(page):
    page.get_by_test_id("view-issues").click()
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("area-runs").click()
    expect(page.get_by_test_id("view-issues")).to_have_attribute("aria-pressed", "true")


def test_project_files_in_no_known_form_are_shown_not_dropped(page, tmp_path_factory):
    from mlviz.fixture import make_project

    from .conftest import serve

    root = make_project(tmp_path_factory.mktemp("bad_epochs"))
    (root / "epochs.yaml").write_text("some: thing\n")
    with serve(root) as url:
        page.goto(url)
        warn = page.get_by_test_id("project-warnings")
        expect(warn).to_be_visible()
        expect(warn).to_contain_text("epochs.yaml")


def test_no_warning_for_a_project_in_the_known_form(page):
    expect(page.get_by_test_id("project-badge")).to_be_visible()
    expect(page.get_by_test_id("project-warnings")).to_have_count(0)


def test_many_tabs_wrap_below_the_search_box_instead_of_running_under_it(page):
    page.set_viewport_size({"width": 1000, "height": 700})
    strip = page.get_by_test_id("tab-strip")
    assert "wrapped" not in strip.get_attribute("class")
    assert strip.bounding_box()["height"] == 36
    for run in RUNS_FOR_TABS:
        open_run(page, run)
    expect(strip).to_have_class(re.compile("wrapped"))
    box = page.get_by_test_id("palette-box").bounding_box()
    tabs = [t.bounding_box() for t in page.get_by_test_id("tab-run").all()] + [page.get_by_test_id("tab-pinned").bounding_box()]
    assert all(t["y"] >= box["y"] + box["height"] for t in tabs)  # every tab is below the search box
    assert max(t["y"] + t["height"] for t in tabs) <= strip.bounding_box()["y"] + strip.bounding_box()["height"]
    assert strip.bounding_box()["height"] > 36
    while page.get_by_test_id("tab-run").count():
        page.get_by_test_id("tab-run").first.get_by_test_id("tab-close").click()
    expect(strip).not_to_have_class(re.compile("wrapped"))
