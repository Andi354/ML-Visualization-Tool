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
    assert css(pinned, "paddingLeft") == "12px" and css(pinned, "fontSize") == "12px"
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


# --- H · Run tab ----------------------------------------------------------------------------------
def test_groups_table_has_the_prototype_heads_and_right_aligned_numbers(page):
    open_run(page, folder("TIM-71_example"))
    group = page.locator(".exp-table .group-row th").first
    assert css(group, "fontSize") == "12px" and css(group, "textTransform") == "none" and "Sans" in css(group, "fontFamily")
    head = page.get_by_test_id("metric-head").first.locator("xpath=..")
    assert "Mono" in css(head, "fontFamily") and css(head, "textAlign") == "right" and css(head, "paddingLeft") == "10px"
    cell = page.locator(".exp-table td.metric-cell").first
    assert css(cell, "textAlign") == "right" and css(cell, "paddingTop") == "7px"
    assert css(cell, "borderBottomColor") == "rgb(38, 46, 62)"
    expect(page.locator(".sort-arrow").first).to_have_text("↑")


def test_notes_column_is_the_amber_column_of_the_prototype(page):
    open_run(page, folder("TIM-71_example"))
    col = page.get_by_test_id("notes-column")
    assert col.bounding_box()["width"] == 300 and css(col, "backgroundColor") == "rgb(18, 16, 11)"
    expect(col.locator(".notes-count")).to_have_text("0 Notizen")
    add = page.get_by_test_id("note-add-run")
    assert css(add, "borderTopStyle") == "dashed" and css(add, "borderRadius") == "9px"
    add.click()
    page.get_by_test_id("note-input").fill("Seed **auffällig**")
    page.get_by_test_id("note-save").click()
    card = page.get_by_test_id("my-note")
    assert css(card, "backgroundColor") == "rgb(21, 18, 9)" and css(card, "borderRadius") == "6px"
    assert css(card.locator(".note-anchor"), "borderRadius") == "9px"
    assert css(card.locator("strong"), "color") == "rgb(255, 226, 168)"
    expect(card.get_by_test_id("note-edit")).to_have_class("lnk")
    expect(col.locator(".notes-count")).to_have_text("1 Notiz")


# --- I · Analysis ---------------------------------------------------------------------------------
def test_analysis_has_the_scope_strip_and_the_prototype_header(page):
    page.get_by_test_id("area-analysis").click()
    strip = page.locator(".scope-strip")
    assert strip.bounding_box()["height"] == 40 and css(strip, "backgroundColor") == "rgb(15, 19, 27)"
    expect(strip).to_contain_text("Umfang")
    expect(strip.get_by_test_id("analysis-view-run")).to_have_text("Ein Lauf")
    head = page.locator(".analysis > .view-head")
    assert head.bounding_box()["height"] >= 52 and css(head, "paddingLeft") == "28px"
    expect(head.locator(".crumb")).to_contain_text("Analyse")
    expect(head.locator(".crumb-view")).to_have_text("Ein Lauf")
    save = page.get_by_test_id("save-deliverable")
    assert css(save, "fontSize") == "13px" and css(save, "backgroundColor") == "rgb(110, 155, 245)"
    assert css(page.get_by_test_id("template-menu"), "backgroundColor") == "rgb(19, 23, 32)"


def test_widget_tables_follow_the_prototype_table(page):
    page.get_by_test_id("area-analysis").click()
    table = page.locator(".w-table").first
    table.wait_for()
    th = table.locator("thead th").first
    assert css(th, "backgroundColor") == "rgb(26, 32, 48)" and css(th, "fontSize") == "12px"
    td = table.locator("tbody td:not(.row-head)").first
    assert css(td, "textAlign") == "center" and css(td, "paddingTop") == "9px" and css(td, "fontSize") == "13px"


# --- J · Agent window -----------------------------------------------------------------------------
def test_agent_window_sits_above_the_status_bar_with_the_prototype_controls(page):
    page.get_by_test_id("agent-icon").click()
    win = page.get_by_test_id("agent-window")
    box = win.bounding_box()
    status = page.get_by_test_id("status-bar").bounding_box()
    assert box["y"] + box["height"] <= status["y"] - 20
    assert win.locator(".agent-header > svg path").count() == 1  # the big star alone
    send = page.get_by_test_id("agent-send")
    assert css(send, "backgroundColor") == "rgb(47, 91, 211)" and css(send, "color") == "rgb(255, 255, 255)"
    mic = page.get_by_test_id("agent-mic")
    assert css(mic, "borderTopColor") == "rgb(44, 53, 71)" and css(mic, "backgroundColor") == "rgb(19, 23, 32)"


# --- K · Settings ---------------------------------------------------------------------------------
def test_settings_header_rail_and_rows_follow_the_prototype(page):
    page.get_by_test_id("settings-icon").click()
    sp = page.get_by_test_id("settings")
    expect(sp.locator(".settings-title-main")).to_have_text("Einstellungen")
    expect(page.get_by_test_id("settings-sub")).to_contain_text("Demo Bench · v0.3.1")
    box = sp.locator(".settings-search-box")
    assert box.locator("svg").count() == 1 and box.locator("kbd").inner_text() == "/"
    pill = page.get_by_test_id("only-changed")
    assert css(pill, "borderRadius") == "14px"
    expect(page.get_by_test_id("only-changed-count")).to_have_text("0")
    presets = page.get_by_test_id("presets")
    assert presets.evaluate("e => e.tagName") == "BUTTON" and css(presets, "borderRadius") == "14px"
    assert page.get_by_test_id("settings-undo").bounding_box()["width"] == 30
    # the header spans rail and rows; the rail has its two group labels and an icon per category
    assert sp.locator(".settings-top").bounding_box()["width"] == sp.bounding_box()["width"]
    expect(sp.locator(".rail-label")).to_have_text(["Kategorien", "Mehr"])
    assert sp.locator(".rail-cat svg").count() == 7
    row = sp.get_by_test_id("setting-row").first
    assert css(row.locator(".srow-label"), "fontWeight") == "500" and css(row, "paddingTop") == "12px"
    assert css(sp.locator("h3").first, "borderBottomWidth") == "1px"
    expect(sp.locator(".tip .tip-icon")).to_have_text("💡")
    assert css(sp.locator(".tip"), "borderLeftWidth") == "3px"
    slider = sp.get_by_test_id("setting-row").filter(has_text="Größe der Oberfläche")
    assert slider.locator("input[type=range]").count() == 1
    assert slider.get_by_role("button", name="weniger").count() == 1
    assert css(sp.locator(".switch").first, "width") == "36px"


# --- L · Command palette --------------------------------------------------------------------------
def test_palette_is_the_raised_panel_with_icons_and_group_hints(page):
    page.keyboard.press("Control+p")
    panel = page.get_by_test_id("palette")
    box = panel.bounding_box()
    assert box["width"] == 640 and box["y"] == 40
    assert css(panel, "backgroundColor") == "rgb(26, 32, 48)" and css(panel, "borderTopColor") == "rgb(44, 69, 114)"
    assert css(panel, "borderRadius") == "8px"
    assert "Mono" not in css(page.get_by_test_id("palette-input"), "fontFamily")
    first = page.get_by_test_id("palette-item").first
    expect(first.locator(".palette-icon")).to_have_text("▤")
    assert "Mono" in css(first.locator(".palette-label"), "fontFamily")
    expect(first.get_by_test_id("palette-right")).to_have_text("zuletzt geöffnet")
    assert css(first, "boxShadow") != "none"  # the selected row has the accent bar
    expect(panel.locator(".palette-sep")).to_have_count(1)  # between runs and issues
    expect(panel.locator(".palette-icon").last).to_have_text("◆")
    page.keyboard.press("Escape")
    page.keyboard.press("Control+Shift+p")
    first = page.get_by_test_id("palette-item").first
    expect(first.locator(".palette-label")).to_contain_text("Läufe: ")
    expect(first.locator(".palette-key")).to_have_text("Ctrl+P")
    assert css(first.locator(".palette-key"), "borderRadius") == "3px"
