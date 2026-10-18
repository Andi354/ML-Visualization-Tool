"""Feature B (v0.3.0): voice input, the normaliser and the endpoints (the recording itself is the browser's job)."""

import pytest
from fastapi.testclient import TestClient

from mlviz import voice
from mlviz.fixture import make_project
from mlviz.project import Project
from mlviz.server import create_app
from mlviz.voice import Term, join, normalise, number_word, numbers

VOCAB = [Term("pred_len", "Lauf-Merkmal"), Term("TIM-52", "Issue"), Term("best_90", "Lauf"), Term("best_30", "Lauf"), Term("lstm_layer", "Achse")]


@pytest.mark.parametrize("word,value", [("vierundsechzig", 64), ("einundzwanzig", 21), ("dreißig", 30), ("hundertzwanzig", 120), ("elf", 11), ("null", 0)])
def test_german_number_words(word, value):
    assert number_word(word) == value


def test_words_that_are_no_numbers():
    assert number_word("Lauf") is None and number_word("undzwanzig") is None


def test_numbers_become_digits_with_decimals_and_versions():
    assert numbers("vierundsechzig Zellen")[0] == "64 Zellen"
    assert numbers("null komma null null eins")[0] == "0.001"
    text, heard = numbers("Version null punkt drei punkt null")
    assert text == "Version 0.3.0" and heard["0.3.0"] == "null punkt drei punkt null"
    assert numbers("ein Lauf")[0] == "ein Lauf"  # an article stays


def test_issue_ids_and_spoken_keys_are_written_as_the_project_writes_them():
    out = normalise("zeig tim 52 mit pred len neunzig", VOCAB)
    assert out["text"] == "zeig TIM-52 mit pred_len 90"
    kinds = {s["term"]: s["kind"] for s in out["segments"] if "term" in s}
    assert kinds == {"TIM-52": "Issue", "pred_len": "Lauf-Merkmal"}
    assert next(s for s in out["segments"] if s.get("term") == "pred_len")["heard"] == "pred len"


def test_a_term_comes_with_alternatives_of_its_own_kind():
    seg = next(s for s in normalise("nimm best 90 bitte", VOCAB)["segments"] if s.get("term") == "best_90")
    assert seg["alts"] == ["best_30"] and seg["kind"] == "Lauf"


def test_a_version_is_a_term_with_the_spoken_words_as_heard():
    seg = next(s for s in normalise("das ist version null punkt drei punkt null", VOCAB)["segments"] if s.get("kind") == "Version")
    assert (seg["term"], seg["heard"]) == ("0.3.0", "null punkt drei punkt null")


def test_punctuation_sticks_to_the_word_before():
    assert normalise("schau auf tim 52, dann weiter", VOCAB)["text"] == "schau auf TIM-52, dann weiter"


def test_segments_join_to_the_text():
    out = normalise("tim 52 und lstm layer zwei", VOCAB)
    assert join(out["segments"]) == out["text"] == "TIM-52 und lstm_layer 2"


def test_the_vocabulary_comes_from_the_project(tmp_path):
    project = Project.load(make_project(tmp_path))
    terms = {t.term: t.kind for t in voice.vocabulary(project, "Eigenbegriff, zweiter")}
    assert terms["TIM-52"] == "Issue" and terms["best_90"] == "Lauf" and terms["encoding_size"] == "Achse"
    assert terms["Eigenbegriff"] == "Begriff" and terms["zweiter"] == "Begriff" and terms["Standard"] == "Vorlage"
    assert "Projektbegriffe: " in voice.prompt_for(list(terms_to_list(terms)))


def terms_to_list(terms):
    return [Term(t, k) for t, k in terms.items()]


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(make_project(tmp_path)))


def test_without_whisper_the_server_says_the_browser_recognises(client, monkeypatch):
    monkeypatch.setattr(voice.Recogniser, "installed", staticmethod(lambda: False))
    st = client.get("/api/voice/status").json()
    assert st["engine"] == "browser" and "faster-whisper" in st["reason"]
    assert client.post("/api/voice", content=b"abc").status_code == 503


def test_the_browsers_text_goes_through_the_same_normaliser(client):
    out = client.post("/api/voice/normalise", json={"text": "zeig tim 52 mit best 90"}).json()
    assert out["text"] == "zeig TIM-52 mit best_90" and out["engine"] == "browser"
    assert any(s.get("term") == "best_90" for s in out["segments"])


def test_a_recording_is_transcribed_with_the_project_vocabulary(client, monkeypatch):
    seen = {}

    def fake(self, audio, lang, model, prompt):
        seen.update(audio=audio, lang=lang, model=model, prompt=prompt)
        return "vergleiche tim 52 mit dem lauf best 90"

    monkeypatch.setattr(voice.Recogniser, "installed", staticmethod(lambda: True))
    monkeypatch.setattr(voice.Recogniser, "status", lambda self, model: {"engine": "whisper", "ready": True, "loading": False, "model": model})
    monkeypatch.setattr(voice.Recogniser, "transcribe", fake)
    client.put("/api/settings", json={"set": {"agent.voiceLang": "en", "agent.voiceModel": "medium", "agent.voiceTerms": "Eigenbegriff"}})
    out = client.post("/api/voice", content=b"RIFFaudio").json()
    assert out["text"] == "vergleiche TIM-52 mit dem lauf best_90" and out["engine"] == "whisper"
    assert seen["audio"] == b"RIFFaudio" and seen["lang"] == "en" and seen["model"] == "medium"
    assert "TIM-52" in seen["prompt"] and "Eigenbegriff" in seen["prompt"]


def test_while_the_model_loads_the_server_answers_503(client, monkeypatch):
    monkeypatch.setattr(voice.Recogniser, "installed", staticmethod(lambda: True))
    monkeypatch.setattr(voice.Recogniser, "status", lambda self, model: {"engine": "whisper", "ready": False, "loading": True})
    assert client.post("/api/voice", content=b"x").status_code == 503


def test_a_spoken_message_is_stored_as_spoken_and_marked_for_the_agent(client, tmp_path, monkeypatch):
    import json

    log = tmp_path / "claude.log"
    monkeypatch.setenv("FAKE_CLAUDE_LOG", str(log))
    chat = client.post("/api/agent/chats", json={}).json()["id"]
    with client.stream("POST", f"/api/agent/chats/{chat}/run", json={"text": "zeig TIM-52", "context": "", "spoken": "zeig tim fünfzig zwei"}) as r:
        for _ in r.iter_lines():
            pass
    msg = client.get(f"/api/agent/chats/{chat}").json()["messages"][0]
    assert msg["spoken"] == "zeig tim fünfzig zwei" and msg["t"] == "zeig TIM-52"
    args = json.loads(log.read_text().splitlines()[-1])["args"]
    assert args[args.index("-p") + 1].startswith("[gesprochen] ")
