"""Feature E (v0.3.0): own notes on runs, in the browser (on a project copy of its own)."""

import re
import shutil

import pytest
from playwright.sync_api import expect

from .helpers import folder, open_run

BEST_90 = folder("TIM-52_best_90")


@pytest.fixture
def np_(writable_page):
    for name in ("notes", "chats"):
        shutil.rmtree(writable_page.writable_root / ".mlviz" / name, ignore_errors=True)
    (writable_page.writable_root / ".mlviz" / "settings.json").unlink(missing_ok=True)
    writable_page.reload()
    open_run(writable_page, BEST_90)
    expect(writable_page.get_by_test_id("exp-row").first).to_be_visible()
    return writable_page


def column(page):
    return page.get_by_test_id("notes-column")


def add_run_note(page, text):
    page.get_by_test_id("note-add-run").click()
    page.get_by_test_id("note-input").fill(text)
    page.get_by_test_id("note-save").click()


def test_the_column_shows_while_no_row_is_selected_and_starts_empty(np_):
    expect(column(np_)).to_contain_text("✎ Meine Notizen · 0")
    expect(column(np_)).to_contain_text("Noch keine Notizen")
    assert column(np_).bounding_box()["width"] == 300


def test_a_run_note_is_written_in_markdown_and_stored(np_):
    add_run_note(np_, "**wichtig:** Horizont 90 ist *zu lang*")
    card = np_.get_by_test_id("my-note")
    expect(card.locator("strong")).to_have_text("wichtig:")
    expect(card).to_contain_text("am Lauf")
    expect(column(np_)).to_contain_text("✎ Meine Notizen · 1")
    assert (np_.writable_root / ".mlviz" / "notes" / f"{BEST_90}.json").exists()


def test_ctrl_enter_saves_escape_cancels_and_an_empty_note_is_discarded(np_):
    np_.get_by_test_id("note-add-run").click()
    np_.get_by_test_id("note-input").fill("per Tastatur")
    np_.keyboard.press("Control+Enter")
    expect(np_.get_by_test_id("my-note")).to_have_count(1)
    np_.get_by_test_id("note-add-run").click()
    np_.get_by_test_id("note-input").press("Escape")
    expect(np_.get_by_test_id("note-draft")).to_have_count(0)
    np_.get_by_test_id("note-add-run").click()
    np_.get_by_test_id("note-save").click()  # empty
    expect(np_.get_by_test_id("my-note")).to_have_count(1)


def test_edit_and_delete_with_undo(np_):
    add_run_note(np_, "erste Fassung")
    np_.get_by_test_id("note-edit").click()
    np_.get_by_test_id("note-input").fill("zweite Fassung")
    np_.get_by_test_id("note-save").click()
    expect(np_.get_by_test_id("my-note")).to_contain_text("zweite Fassung")
    np_.get_by_test_id("note-delete").click()
    expect(np_.get_by_test_id("my-note")).to_have_count(0)
    expect(np_.get_by_test_id("notes-toast")).to_contain_text("Notiz gelöscht")
    np_.get_by_test_id("note-undo").click()
    expect(np_.get_by_test_id("my-note")).to_contain_text("zweite Fassung")


def test_a_note_on_a_description_section_is_marked_and_shown(np_):
    field = np_.locator('[data-field="expectation"]')
    field.hover()
    field.get_by_test_id("section-add-note").click()
    np_.get_by_test_id("note-input").fill("Erwartung stimmt nicht")
    np_.get_by_test_id("note-save").click()
    expect(np_.get_by_test_id("my-note")).to_contain_text("an der Beschreibung · Erwartung")
    expect(field.get_by_test_id("section-notes")).to_have_text("✎ 1")
    field.get_by_test_id("section-notes").click()
    expect(np_.get_by_test_id("my-note")).to_have_class(re.compile("hl"))
    expect(field).to_have_class(re.compile("desc-hl"))


def test_a_group_note_hangs_on_the_row_and_shows_in_the_detail_panel(np_):
    np_.get_by_test_id("exp-row").first.click()
    expect(np_.get_by_test_id("notes-column")).to_have_count(0)  # the detail panel takes the column
    np_.get_by_test_id("note-add-group").click()
    np_.get_by_test_id("note-input").fill("Gruppe fällt auf")
    np_.get_by_test_id("note-save").click()
    expect(np_.get_by_test_id("dp-notes")).to_contain_text("Gruppe fällt auf")
    expect(np_.get_by_test_id("row-notes").first).to_have_text("✎ 1")
    np_.get_by_test_id("dp-close").click()
    expect(column(np_)).to_contain_text("Gruppe fällt auf")


def test_the_description_is_rendered_as_markdown(np_):
    assert np_.locator('[data-testid="description-fields"] .md').count() >= 1


def test_runs_show_their_note_count_in_the_list(np_):
    add_run_note(np_, "x")
    np_.get_by_test_id("tab-pinned").click()
    expect(np_.get_by_test_id("run-notes").first).to_have_text("✎ 1")


def test_the_palette_adds_a_note_and_finds_note_text(np_):
    np_.keyboard.press("F1")
    np_.get_by_test_id("palette-input").fill(">notiz hinzu")
    np_.keyboard.press("Enter")
    expect(np_.get_by_test_id("note-draft")).to_be_visible()
    np_.get_by_test_id("note-input").fill("Findbare Beobachtung zum Seed")
    np_.get_by_test_id("note-save").click()
    np_.get_by_test_id("tab-pinned").click()
    np_.keyboard.press("Control+p")
    np_.get_by_test_id("palette-input").fill("Beobachtung")
    hit = np_.get_by_test_id("palette-item").filter(has_text="✎")
    expect(hit).to_have_count(1)  # the search of the notes answers a moment after typing
    expect(hit).to_contain_text("Findbare Beobachtung")
    hit.click()
    expect(np_.get_by_test_id("tab-run")).to_have_count(1)


def test_a_proposal_of_the_agent_is_saved_only_by_the_user(np_):
    from .test_agent_tools import mode, tool_nowait
    from .test_agent_window import open_window

    open_window(np_)
    mode(np_, "direct")  # the card asks in every mode
    tool_nowait(np_, "propose_note", run="best_90", text="Der Seed 2 weicht ab", anchor={"kind": "section", "key": "purpose"})
    np_.get_by_test_id("agent-confirm-ok").click()
    proposal = np_.get_by_test_id("proposal")
    expect(proposal).to_contain_text("✦ Vorschlag des Agenten")
    expect(proposal).to_contain_text("an der Beschreibung · Zweck")
    expect(np_.get_by_test_id("my-note")).to_have_count(0)  # only the proposal card, nothing saved
    assert not (np_.writable_root / ".mlviz" / "notes" / f"{BEST_90}.json").exists()
    np_.get_by_test_id("proposal-save").click()
    expect(np_.get_by_test_id("by-agent")).to_have_text(" · ✦ vom Agenten, von dir bestätigt")
    assert (np_.writable_root / ".mlviz" / "notes" / f"{BEST_90}.json").exists()


def test_a_proposal_can_be_discarded(np_):
    from .test_agent_tools import mode, tool_nowait
    from .test_agent_window import open_window

    open_window(np_)
    tool_nowait(np_, "propose_note", run="best_90", text="Nicht nötig")
    np_.get_by_test_id("agent-confirm-ok").click()
    np_.get_by_test_id("proposal-discard").click()
    expect(np_.get_by_test_id("proposal")).to_have_count(0)
    assert not (np_.writable_root / ".mlviz" / "notes" / f"{BEST_90}.json").exists()
