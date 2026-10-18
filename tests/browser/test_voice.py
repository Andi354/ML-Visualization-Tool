"""Feature B (v0.3.0): voice input in the browser. A fake microphone records; the recognition on the server is a stand-in."""

import pytest
from playwright.sync_api import expect

from mlviz.fixture import make_project

from .conftest import _fresh, serve_app
from .test_agent_window import open_window

SAID = "vergleiche tim 52 mit pred len neunzig"


@pytest.fixture
def vp(page, tmp_path):
    root = make_project(tmp_path / "p")
    with serve_app(root) as (url, app):
        rec = app.state.recogniser
        rec.said = SAID
        rec.status = lambda model: {"engine": "whisper", "ready": True, "loading": False, "model": model}
        rec.transcribe = lambda audio, lang, model, prompt: rec.said
        _fresh(page, url)
        page.app, page.root = app, root
        open_window(page)
        yield page


def record(page, seconds=0.6):
    page.get_by_test_id("agent-mic").click()
    expect(page.get_by_test_id("voice-row")).to_contain_text("Hört zu")
    page.wait_for_timeout(int(seconds * 1000))
    page.get_by_test_id("agent-mic").click()


def test_recording_shows_the_red_row_with_time_and_the_stop_button(vp):
    vp.get_by_test_id("agent-mic").click()
    row = vp.get_by_test_id("voice-row")
    expect(row).to_contain_text("Hört zu")
    expect(vp.get_by_test_id("voice-time")).to_have_text("0:00")
    expect(vp.get_by_test_id("agent-mic")).to_have_attribute("aria-pressed", "true")
    expect(vp.get_by_test_id("agent-input")).to_be_hidden()
    vp.wait_for_timeout(1300)
    expect(vp.get_by_test_id("voice-time")).to_have_text("0:01")


def test_the_review_box_marks_project_terms_and_counts_them(vp):
    record(vp)
    expect(vp.get_by_test_id("voice-review")).to_be_visible()
    expect(vp.get_by_test_id("voice-text")).to_have_text("vergleiche TIM-52 mit pred_len 90")
    expect(vp.get_by_test_id("voice-terms")).to_have_text("3 Projektbegriffe erkannt")  # TIM-52, pred_len and its value 90
    chips = vp.get_by_test_id("voice-chip")
    expect(chips).to_have_count(3)
    expect(chips.first).to_have_attribute("data-kind", "Issue")


def test_a_chip_offers_the_recognised_term_alternatives_and_the_heard_words(vp):
    vp.app.state.recogniser.said = "nimm best 90"
    record(vp)
    vp.get_by_test_id("voice-chip").click()
    alts = vp.get_by_test_id("voice-alt")
    expect(alts.first).to_contain_text("best_90")
    expect(alts.first).to_contain_text("erkannt")
    expect(alts.last).to_contain_text("wie gehört")
    expect(alts.last).to_contain_text("best 90")
    alts.nth(1).click()  # an alternative of the same kind
    chip = vp.get_by_test_id("voice-chip")
    expect(chip).to_have_class(__import__("re").compile("changed"))
    assert "best_90" not in vp.get_by_test_id("voice-text").inner_text()


def test_send_puts_the_spoken_text_in_the_chat_marked_with_a_microphone(vp):
    vp.get_by_test_id("agent-input").fill("Bitte")
    record(vp)
    vp.get_by_test_id("voice-send").click()
    msg = vp.get_by_test_id("agent-msg-user").last
    expect(msg).to_contain_text("Bitte vergleiche TIM-52 mit pred_len 90")  # typed text first, then the spoken one
    expect(msg.get_by_test_id("msg-spoken")).to_have_attribute("title", "Gehört: " + SAID)
    expect(vp.get_by_test_id("voice-review")).to_have_count(0)
    expect(vp.get_by_test_id("agent-msg-agent")).to_have_count(1, timeout=15000)  # the stand-in answered; the prompt said [gesprochen]


def test_enter_edit_discard_and_keep_talking(vp):
    record(vp)
    vp.get_by_test_id("voice-edit").click()
    expect(vp.get_by_test_id("agent-input")).to_have_value("vergleiche TIM-52 mit pred_len 90")
    expect(vp.get_by_test_id("voice-review")).to_have_count(0)
    vp.get_by_test_id("agent-input").fill("")
    record(vp)
    vp.get_by_test_id("voice-discard").click()
    expect(vp.get_by_test_id("voice-review")).to_have_count(0)
    vp.app.state.recogniser.said = "erstens"
    record(vp)
    expect(vp.get_by_test_id("voice-text")).to_have_text("erstens")
    vp.app.state.recogniser.said = "zweitens"
    vp.get_by_test_id("voice-more").click()
    expect(vp.get_by_test_id("voice-row")).to_contain_text("Hört zu")
    vp.wait_for_timeout(400)
    vp.get_by_test_id("agent-mic").click()
    expect(vp.get_by_test_id("voice-text")).to_have_text("erstens zweitens")


def test_escape_drops_a_recording_and_then_a_review_but_not_the_window(vp):
    vp.get_by_test_id("agent-mic").click()
    expect(vp.get_by_test_id("voice-row")).to_contain_text("Hört zu")
    vp.keyboard.press("Escape")
    expect(vp.get_by_test_id("voice-row")).to_have_count(0)
    expect(vp.get_by_test_id("agent-window")).to_be_visible()
    record(vp)
    expect(vp.get_by_test_id("voice-review")).to_be_visible()
    vp.keyboard.press("Escape")
    expect(vp.get_by_test_id("voice-review")).to_have_count(0)
    expect(vp.get_by_test_id("agent-window")).to_be_visible()


def test_ctrl_m_starts_and_stops_and_opens_the_window_from_the_capsule(vp):
    vp.get_by_test_id("agent-min").click()
    expect(vp.get_by_test_id("agent-capsule")).to_be_visible()
    vp.keyboard.press("Control+m")
    expect(vp.get_by_test_id("agent-window")).to_be_visible()
    expect(vp.get_by_test_id("voice-row")).to_contain_text("Hört zu")
    vp.wait_for_timeout(500)
    vp.keyboard.press("Control+m")
    expect(vp.get_by_test_id("voice-review")).to_be_visible()


def test_without_the_review_the_text_is_sent_at_once(vp):
    vp.evaluate("fetch('/api/settings', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({set: {'agent.voiceReview': false}})})")
    vp.reload()  # the window stays open
    expect(vp.get_by_test_id("agent-window")).to_be_visible()
    record(vp)
    expect(vp.get_by_test_id("agent-msg-user").last).to_contain_text("vergleiche TIM-52 mit pred_len 90")
    expect(vp.get_by_test_id("voice-review")).to_have_count(0)


def test_silence_gives_a_note_and_no_review_box(vp):
    vp.app.state.recogniser.said = "  "
    record(vp)
    expect(vp.get_by_test_id("voice-toast")).to_have_text("Nichts verstanden")
    expect(vp.get_by_test_id("voice-review")).to_have_count(0)


def test_a_denied_microphone_tells_why_and_changes_nothing(vp):
    vp.evaluate("() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('x'), {name: 'NotAllowedError'})); }")
    vp.get_by_test_id("agent-mic").click()
    expect(vp.get_by_test_id("voice-toast")).to_contain_text("Kein Zugriff auf das Mikrofon")
    expect(vp.get_by_test_id("voice-row")).to_have_count(0)
    expect(vp.get_by_test_id("agent-input")).to_be_visible()


def test_the_model_still_loading_is_said_and_nothing_records(vp):
    vp.app.state.recogniser.status = lambda model: {"engine": "whisper", "ready": False, "loading": True, "model": model}
    vp.get_by_test_id("agent-mic").click()
    expect(vp.get_by_test_id("voice-toast")).to_have_text("Erkennung wird geladen …")
    expect(vp.get_by_test_id("voice-row")).to_have_count(0)
