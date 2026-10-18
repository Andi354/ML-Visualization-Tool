"""v0.3.1 (Design-Treue): the look of every area against the values of the overall prototype."""

from playwright.sync_api import expect

from .helpers import folder, open_run


def css(locator, prop):
    return locator.evaluate("(e, p) => getComputedStyle(e)[p]", prop)


# --- F · Frame ------------------------------------------------------------------------------------
def test_icon_rail_uses_the_svg_icons_and_the_small_badge(page):
    badge = page.get_by_test_id("project-badge")
    assert badge.bounding_box()["width"] == 32 and css(badge, "borderRadius") == "6px"
    for area in ("runs", "analysis"):
        icon = page.get_by_test_id(f"area-{area}").locator("svg")
        assert icon.get_attribute("viewBox") == "0 0 18 18"
    # the analysis icon is the two columns of the prototype, not bars
    assert page.get_by_test_id("area-analysis").locator("svg rect").count() == 2
    assert css(page.get_by_test_id("area-runs"), "borderRadius") == "6px"


def test_tabs_are_the_prototype_tabs(page):
    pinned = page.get_by_test_id("tab-pinned")
    assert css(pinned, "paddingLeft") == "14px" and css(pinned, "fontSize") == "12px"
    assert css(pinned, "borderRightWidth") == "1px" and css(pinned, "borderTopColor") == "rgb(110, 155, 245)"
    open_run(page, folder("TIM-71_example"))
    tab = page.get_by_test_id("tab-run").first
    assert "Mono" in css(tab.locator(".tab-label"), "fontFamily")
    close = page.get_by_test_id("tab-close").first
    expect(close).to_have_text("×")
    assert close.locator("svg").count() == 0


def test_search_box_sits_centred_with_a_magnifier(page):
    box = page.get_by_test_id("palette-box")
    b = box.bounding_box()
    assert (b["width"], b["height"], b["y"]) == (340, 24, 6)
    assert abs((b["x"] + b["width"] / 2) - (52 + (1440 - 52) / 2)) < 1 or abs(b["x"] + b["width"] / 2 - page.viewport_size["width"] / 2) < 30
    assert box.locator("svg").count() == 1
    assert css(box, "borderRadius") == "6px" and css(box, "borderTopColor") == "rgb(44, 53, 71)"


def test_status_bar_items_fill_the_bar_and_the_bell_is_an_svg(page):
    bar = page.get_by_test_id("status-bar")
    assert css(bar, "fontSize") == "12px"
    bell = page.get_by_test_id("sb-bell")
    assert bell.locator("svg").count() == 1 and "🔔" not in bell.inner_text()
    assert bell.bounding_box()["height"] == 23 and css(bell, "paddingLeft") == "9px"
    expect(page.get_by_test_id("sb-agent")).to_contain_text("✦")


def test_popovers_are_the_raised_panels_of_the_prototype(page):
    page.get_by_test_id("sb-runs").click()
    pop = page.get_by_test_id("runs-popover")
    box = pop.bounding_box()
    assert box["width"] == 480 and box["x"] == 6
    assert css(pop, "borderTopColor") == "rgb(44, 69, 114)" and css(pop, "borderRadius") == "8px"
    assert css(pop, "backgroundColor") == "rgb(26, 32, 48)"
    # progress bar of a run: 5 px, round
    assert page.locator(".sb-bar").first.bounding_box()["height"] == 5
    assert css(page.get_by_test_id("sb-run-open"), "borderTopColor") == "rgb(44, 53, 71)"
    page.get_by_test_id("sb-bell").click()
    note = page.get_by_test_id("notes-popover")
    assert note.bounding_box()["width"] == 430


# --- G · Läufe ------------------------------------------------------------------------------------
def test_runs_header_shows_only_the_area_name_and_the_list_has_the_wide_gutter(page):
    head = page.locator("[data-testid=runs-view] .view-head")
    expect(head).to_have_text("LäufeListeIssues")
    assert css(head, "paddingLeft") == "32px"
    assert css(page.locator("[data-testid=runs-view] .view-head .seg"), "borderRadius") == "5px"
    assert page.get_by_test_id("search").bounding_box()["x"] == 52 + 32
    assert page.locator(".run-row").first.evaluate("e => getComputedStyle(e).gridTemplateColumns").endswith("120px")


def test_issue_view_has_its_search_in_the_list_column_and_fills_the_height(page):
    page.get_by_test_id("view-issues").click()
    aside = page.get_by_test_id("issue-list")
    expect(aside.get_by_test_id("search")).to_have_count(1)
    assert page.locator(".toolbar").count() == 0
    box = aside.bounding_box()
    assert box["y"] + box["height"] >= page.get_by_test_id("status-bar").bounding_box()["y"] - 1
    assert 295 <= box["width"] <= 360
    assert css(page.locator(".issue-item").first, "borderRadius") == "6px"
    page.locator('[data-testid="issue-item"][data-issue="TIM-83"]').click()
    tag = page.locator(".exp-run .tags .flag").first
    assert css(tag, "borderTopWidth") == "1px" and "Mono" in css(tag, "fontFamily")
    assert page.locator(".exp-run .bar").first.bounding_box()["height"] == 5
