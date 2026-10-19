"""Feature D (v0.3.0): status bar, notifications and the bell, in the browser."""

import re

import pytest
from playwright.sync_api import expect

from mlviz.fixture import make_project

from .conftest import serve_app


@pytest.fixture
def live(page, tmp_path, monkeypatch):
    """The app on its own project, polling every 0.3 s; the clock of the tool is set with `live.at(...)`."""
    monkeypatch.setenv("MLVIZ_PROGRESS_INTERVAL", "0.3")
    monkeypatch.setenv("MLVIZ_NOW", "2026-10-15T11:07:00")  # the running run: 9 of 24 cells, last cell at 11:06
    root = make_project(tmp_path)
    with serve_app(root) as (url, app):
        page.add_init_script("window.__mlvizPollMs = 300")
        page.set_viewport_size({"width": 1440, "height": 900})
        page.goto(url)
        page.evaluate("localStorage.clear()")
        page.reload()
        page.get_by_test_id("status-bar").wait_for()
        page.app = app
        page.at = lambda t: monkeypatch.setenv("MLVIZ_NOW", t)
        yield page


def note_text(page):
    return page.get_by_test_id("sb-runs-text")


def test_the_status_bar_sits_under_the_whole_window_and_shows_the_project(live):
    box = live.get_by_test_id("status-bar").bounding_box()
    assert box["height"] == 24 and box["y"] + box["height"] == 900 and box["width"] == 1440
    expect(live.get_by_test_id("sb-project")).to_contain_text("Demo Bench · v0.3.1")
    expect(live.get_by_test_id("sb-agent")).to_have_text("✦ Agent · bereit")


def test_a_running_run_shows_progress_and_remaining_time(live):
    expect(note_text(live)).to_have_text("1 läuft · running_sweep · 38 % · noch ~10 min")


def test_the_popover_lists_the_running_runs_and_opens_one(live):
    live.get_by_test_id("sb-runs").click()
    row = live.get_by_test_id("sb-run")
    expect(row).to_contain_text("9 von 24 Zellen · 0 Fehler · 90 Zellen/h · noch ~10 min (fertig ca. 11:17)")
    live.get_by_test_id("sb-run-open").click()
    expect(live.get_by_test_id("tab-run")).to_have_count(1)
    expect(live.get_by_test_id("runs-popover")).to_have_count(0)


def test_a_stall_turns_amber_raises_one_notification_and_the_bell_counts_it(live):
    live.at("2026-10-15T11:50:00")
    expect(live.get_by_test_id("sb-stalled")).to_have_text("⚠ 1 hängt")
    expect(live.get_by_test_id("toast")).to_have_count(1)
    expect(live.get_by_test_id("toast")).to_contain_text("Lauf hängt")
    expect(live.get_by_test_id("sb-unread")).to_have_text("1")
    live.wait_for_timeout(900)  # more polls: still one
    expect(live.get_by_test_id("toast")).to_have_count(1)
    live.get_by_test_id("sb-runs").click()
    expect(live.get_by_test_id("sb-run")).to_contain_text("hängt seit 11:36 · letzte Zelle 11:06")


def raise_finished(page, failed=1):
    expect(note_text(page)).to_contain_text("läuft")  # the first poll is done: what comes now counts as new
    w = page.app.state.watcher
    with w._lock:
        w._event("finished", {"id": "2026-10-09_0845_TIM-52_best_90", "name": "TIM-52_best_90", "short": None, "issue": "TIM-52"},
                 cells=30, failed=failed, duration_s=1500, best={"metric": "mape", "label": "MAPE", "unit": "%", "scale": 100, "value": 0.0346})


def test_a_finished_run_comes_with_actions_and_closes_with_the_cross(live):
    raise_finished(live)
    toast = live.get_by_test_id("toast")
    expect(toast).to_contain_text("Lauf fertig")
    expect(toast).to_contain_text("best_90 · 25 min · 30 Zellen · bester MAPE 3,46 % · 1 Fehler")
    live.get_by_test_id("toast-close").click()
    expect(toast).to_have_count(0)
    expect(live.get_by_test_id("sb-unread")).to_have_text("1")  # closed, but still under the bell


def test_analysing_from_a_notification_marks_it_read(live):
    raise_finished(live)
    live.get_by_test_id("act-analyse").click()
    expect(live.get_by_test_id("toast")).to_have_count(0)
    expect(live.get_by_test_id("sb-unread")).to_have_count(0)
    expect(live.get_by_test_id("tab-pinned")).to_have_text("Analyse")


def test_the_summary_comes_from_the_agent_only_on_a_click(live):
    raise_finished(live)
    expect(live.get_by_test_id("summary")).to_have_count(0)
    live.get_by_test_id("act-summarise").click()
    expect(live.get_by_test_id("summary")).to_contain_text("2026-10-09_0845_TIM-52_best_90")  # the stand-in repeats the facts
    expect(live.get_by_test_id("agent-window")).to_have_count(0)  # no chat message, no window


def test_the_bell_lists_newest_first_and_can_mark_and_clear(live):
    raise_finished(live)
    live.wait_for_timeout(100)
    live.at("2026-10-15T11:50:00")
    expect(live.get_by_test_id("sb-unread")).to_have_text("2")
    live.get_by_test_id("sb-bell").click()
    notes = live.get_by_test_id("note")
    expect(notes).to_have_count(2)
    expect(notes.first).to_contain_text("Lauf hängt")
    live.get_by_test_id("notes-read").click()
    expect(live.get_by_test_id("sb-unread")).to_have_count(0)
    live.get_by_test_id("notes-clear").click()
    expect(live.get_by_text("Keine Hinweise")).to_be_visible()


def test_a_reload_starts_with_an_empty_bell_but_a_rebuilt_status_bar(live):
    raise_finished(live)
    expect(live.get_by_test_id("sb-unread")).to_have_text("1")
    live.reload()
    expect(live.get_by_test_id("sb-unread")).to_have_count(0)
    expect(note_text(live)).to_have_text(re.compile("1 läuft"))
