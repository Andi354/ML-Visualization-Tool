"""Feature I (combining widgets into one image) in the browser."""

import re
import struct

from playwright.sync_api import expect

from mlviz.fixture import RUNS, run_folder

from .helpers import folder

RUN = folder("TIM-52_best_30", 1)


def open_dialog(page, run_id=RUN):
    page.get_by_test_id("area-analysis").click()
    page.get_by_test_id("analysis-view-run").click()
    page.get_by_test_id("run-select").select_option(run_id)
    page.wait_for_load_state("networkidle")
    page.get_by_test_id("save-deliverable").click()
    dialog = page.get_by_test_id("save-dialog")
    expect(dialog).to_be_visible()
    expect(dialog.get_by_test_id("image-item")).to_have_count(5)
    return dialog


def check(dialog, *indexes):
    for i in indexes:
        dialog.get_by_test_id("image-check").nth(i).check()


def items(dialog):
    return dialog.get_by_test_id("image-item")


def members(dialog, index):
    return items(dialog).nth(index).get_by_test_id("member").evaluate_all("els => els.map(e => e.dataset.widgetId)")


def png_size(path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    return struct.unpack(">II", data[16:24])


def test_combining_is_possible_from_two_selected_images(page):
    d = open_dialog(page)
    button = d.get_by_test_id("combine")
    expect(button).to_have_text("Zu einem Bild")
    expect(button).to_be_disabled()
    check(d, 0)
    expect(button).to_be_disabled()
    expect(d.get_by_test_id("mark-text")).to_have_text("1 Bild gewählt")
    check(d, 1)
    expect(button).to_be_enabled()
    expect(d.get_by_test_id("mark-text")).to_have_text("2 Bilder gewählt")


def test_the_group_takes_the_place_of_the_first_image_stays_selected_and_focused(page):
    d = open_dialog(page)
    check(d, 3, 1)  # selection order must not matter
    d.get_by_test_id("combine").click()
    expect(items(d)).to_have_count(4)
    group = items(d).nth(1)  # where "per-region" was, the first of the two in list order
    assert group.get_attribute("data-group") == "true"
    assert members(d, 1) == [w for w in members(d, 1)] and len(members(d, 1)) == 2
    expect(group.get_by_test_id("group-label")).to_have_text("1 Bild · 2 Widgets")
    expect(group.get_by_test_id("image-check")).to_be_checked()
    expect(group).to_have_class(re.compile("focused"))
    expect(d.get_by_test_id("mark-text")).to_have_text("1 Bild gewählt")
    expect(d.get_by_test_id("save-images")).to_have_text("1 Bild speichern")
    assert group.evaluate("e => getComputedStyle(e).borderLeftColor") == "rgb(110, 155, 245)"  # accent bar
    assert group.get_by_test_id("image-name").input_value() == "01_per-region+axis-effect.png"


def test_layout_switch_stacks_or_places_the_parts_side_by_side(page):
    d = open_dialog(page)
    check(d, 0, 1)
    d.get_by_test_id("combine").click()
    group = items(d).first
    card = d.get_by_test_id("export-card")
    expect(card.locator(".ex-parts")).to_have_class(re.compile("stack"))
    tops = card.get_by_test_id("export-part").evaluate_all("els => els.map(e => e.getBoundingClientRect().top)")
    assert tops[0] < tops[1]
    group.get_by_test_id("layout-side").click()
    expect(card.locator(".ex-parts")).to_have_class(re.compile("side"))
    boxes = card.get_by_test_id("export-part").evaluate_all("els => els.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top]; })")
    assert boxes[0][1] == boxes[1][1] and boxes[0][0] < boxes[1][0]
    group.get_by_test_id("layout-stack").click()
    expect(card.locator(".ex-parts")).to_have_class(re.compile("stack"))


def test_members_move_up_and_down_and_the_file_name_follows(page):
    d = open_dialog(page)
    check(d, 0, 1)
    d.get_by_test_id("combine").click()
    group = items(d).first
    expect(group.get_by_test_id("image-name")).to_have_value("01_compare-table+per-region.png")
    group.get_by_test_id("member").nth(1).get_by_test_id("member-up").click()
    assert members(d, 0) == [members(d, 0)[0], members(d, 0)[1]]
    expect(group.get_by_test_id("image-name")).to_have_value("01_per-region+compare-table.png")
    expect(d.get_by_test_id("export-card").get_by_test_id("export-part")).to_have_count(2)  # the preview has drawn
    order = d.get_by_test_id("export-card").get_by_test_id("export-part").evaluate_all("els => els.map(e => e.querySelector('svg, table') !== null)")
    assert order == [True, True]
    group.get_by_test_id("member").nth(1).get_by_test_id("member-down").click()  # already last: nothing changes
    expect(group.get_by_test_id("image-name")).to_have_value("01_per-region+compare-table.png")


def test_loesen_makes_the_member_its_own_image_right_after_the_group(page):
    d = open_dialog(page)
    check(d, 0, 1, 2)
    d.get_by_test_id("combine").click()
    expect(items(d)).to_have_count(3)
    items(d).first.get_by_test_id("member").nth(0).get_by_test_id("member-detach").click()
    expect(items(d)).to_have_count(4)
    assert len(members(d, 0)) == 2 and len(members(d, 1)) == 1
    expect(d.get_by_test_id("mark-text")).to_have_text("2 Bilder gewählt")  # the group and the released image
    # detach again: the group is left with one member and becomes a single image
    items(d).first.get_by_test_id("member").nth(0).get_by_test_id("member-detach").click()
    expect(items(d)).to_have_count(5)
    assert items(d).evaluate_all("els => els.map(e => e.dataset.group)") == ["false"] * 5


def test_trennen_turns_all_members_into_single_images(page):
    d = open_dialog(page)
    check(d, 1, 2, 3)
    d.get_by_test_id("combine").click()
    expect(items(d)).to_have_count(3)
    items(d).nth(1).get_by_test_id("split").click()
    expect(items(d)).to_have_count(5)
    assert items(d).evaluate_all("els => els.map(e => e.dataset.group)") == ["false"] * 5
    expect(d.get_by_test_id("mark-text")).to_have_text("3 Bilder gewählt")


def test_a_combined_image_has_one_title_editable_and_parts_without_their_own_titles(page):
    d = open_dialog(page)
    check(d, 0, 1)
    d.get_by_test_id("combine").click()
    card = d.get_by_test_id("export-card")
    expect(d.get_by_test_id("image-title")).to_have_value("Vergleichstabelle und Je Region")
    expect(card.locator(".ex-title")).to_have_text("Vergleichstabelle und Je Region")
    expect(card.get_by_test_id("widget-title")).to_have_count(0)
    d.get_by_test_id("image-title").fill("Modellvergleich")
    expect(card.locator(".ex-title")).to_have_text("Modellvergleich")
    expect(card.get_by_test_id("export-part")).to_have_count(2)


def test_hints_are_off_for_combined_images_and_on_for_single_ones_one_footer(page):
    d = open_dialog(page)
    expect(d.get_by_test_id("hints-check")).to_be_checked()  # a single image
    check(d, 0, 1)
    d.get_by_test_id("combine").click()
    card = d.get_by_test_id("export-card")
    expect(d.get_by_test_id("hints-check")).not_to_be_checked()
    expect(card.locator(".w-sub")).to_have_count(0)
    expect(card.locator(".w-note")).to_have_count(0)
    d.get_by_test_id("hints-check").check()
    expect(card.locator(".w-sub")).to_have_count(2)  # each part with its own subtitle
    expect(card.locator(".w-note")).to_have_count(2)
    expect(card.get_by_test_id("export-footer")).to_have_count(1)  # one footer
    d.get_by_test_id("footer-check").uncheck()
    expect(card.get_by_test_id("export-footer")).to_have_count(0)


def test_stacked_parts_are_separated_by_a_rule(page):
    d = open_dialog(page)
    check(d, 0, 1)
    d.get_by_test_id("combine").click()
    second = d.get_by_test_id("export-card").get_by_test_id("export-part").nth(1)
    assert second.evaluate("e => getComputedStyle(e).borderTopWidth") == "1px"


def test_the_file_name_of_a_group_is_editable(page):
    d = open_dialog(page)
    check(d, 0, 1)
    d.get_by_test_id("combine").click()
    name = items(d).first.get_by_test_id("image-name")
    expect(name).to_have_value("01_compare-table+per-region.png")
    name.fill("vergleich.png")
    expect(name).to_have_value("vergleich.png")


def test_saving_a_combined_image_writes_one_file_taller_than_a_single_one(writable_page):
    page = writable_page
    d = open_dialog(page)
    d.get_by_test_id("folder-title").fill("Kombiniert")
    check(d, 0, 1)
    d.get_by_test_id("combine").click()
    check(d, 2)  # the axis effect stays a single image: [group, config, axis-effect, stability]
    expect(d.get_by_test_id("save-images")).to_have_text("2 Bilder speichern")
    d.get_by_test_id("save-images").click()
    expect(page.get_by_test_id("toast")).to_contain_text("2 Bilder gespeichert")
    out = page.writable_root / "deliverables" / "2026-10-15 Kombiniert"
    names = sorted(p.name for p in out.glob("*.png"))
    assert names == ["01_compare-table+per-region.png", "02_axis-effect.png"]
    wg, hg = png_size(out / names[0])
    ws, hs = png_size(out / names[1])
    assert wg == ws == 2400 and hg > hs
    readme = (out / "README.md").read_text()
    assert "01_compare-table+per-region.png" in readme and "Vergleichstabelle und Je Region" in readme


def test_side_by_side_is_lower_than_stacked(writable_page):
    page = writable_page
    heights = {}
    for layout in ("stack", "side"):
        d = open_dialog(page)
        check(d, 0, 1)
        d.get_by_test_id("combine").click()
        if layout == "side":
            d.get_by_test_id("layout-side").click()
        d.get_by_test_id("folder-title").fill(f"Layout {layout}")
        d.get_by_test_id("save-images").click()
        expect(page.get_by_test_id("toast")).to_be_visible()
        out = page.writable_root / "deliverables" / f"2026-10-15 Layout {layout}"
        heights[layout] = png_size(next(out.glob("*.png")))[1]
        page.reload()
    assert heights["side"] < heights["stack"]


def test_an_unavailable_widget_cannot_be_selected_or_combined(writable_page):
    page = writable_page
    (page.writable_root / "runs" / run_folder(RUNS[0]) / "channels.parquet").unlink(missing_ok=True)
    page.reload()
    d = open_dialog(page, run_folder(RUNS[0]))
    region = d.locator('[data-testid="image-item"]', has_text="Je Region")
    expect(region.get_by_test_id("image-check")).to_be_disabled()
    expect(region).to_contain_text("Dieser Lauf hat keine Kanäle")
    check(d, 0)
    expect(d.get_by_test_id("combine")).to_be_disabled()
