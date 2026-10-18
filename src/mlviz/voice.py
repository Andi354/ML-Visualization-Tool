"""Voice input for the agent (v0.3.0, feature B): recognition with the project's own vocabulary.

The browser records a clip and posts it to `POST /api/voice`; `faster-whisper` (optional, `mlviz[voice]`) transcribes
it with an `initial_prompt` made of the project's terms; `normalise` then turns number words into digits, "TIM 52"
into `TIM-52`, spoken keys into snake_case and marks the project terms, with alternatives. Where `faster-whisper` is
missing the browser recognises the speech itself and only the normaliser runs here (`POST /api/voice/normalise`).
"""

from __future__ import annotations

import difflib
import io
import re
import threading
from dataclasses import dataclass
from typing import Any

from .project import Project

MODELS = {"small": "small", "medium": "medium"}


@dataclass(frozen=True)
class Term:
    term: str
    kind: str


# --- vocabulary -------------------------------------------------------------------------------------
def vocabulary(project: Project, extra: str = "") -> list[Term]:
    """The terms the speaker may use: axes and config keys, metrics, Lauf-Merkmal values, runs, issues, templates, widgets."""
    from . import widgets
    from .listing import flat_config, merkmal_candidates
    from .runs import list_runs
    from .templates import TemplateStore

    terms: dict[str, str] = {}

    def add(term: str, kind: str) -> None:
        if term and len(term) > 1:
            terms.setdefault(term, kind)

    runs = [r for r in list_runs(project) if not r.problem]
    candidates = merkmal_candidates(runs)
    for r in runs:
        add(r.name, "Lauf")
        if r.issue:
            add(r.issue, "Issue")
            if r.name.startswith(r.issue + "_"):
                add(r.name[len(r.issue) + 1 :], "Lauf")
        for axis in r.axes:
            add(axis, "Achse")
        cfg = flat_config(r)
        for key in candidates:
            if key in cfg:
                add(key.split(".", 1)[-1], "Lauf-Merkmal")
                add(cfg[key], "Lauf-Merkmal")
    for m in project.metrics:
        add(m.key, "Metrik")
    for name in ("Standard", *[t["name"] for t in TemplateStore(project).list(None)]):
        add(name, "Vorlage")
    for entry in widgets.catalog(None):
        add(entry["key"], "Widget")
    for word in re.split(r"[,\n]", extra):
        add(word.strip(), "Begriff")
    return [Term(t, k) for t, k in terms.items()]


def prompt_for(vocab: list[Term]) -> str:
    return "Projektbegriffe: " + ", ".join(t.term for t in vocab[:200]) + "."


# --- number words -----------------------------------------------------------------------------------
_UNITS = {"null": 0, "ein": 1, "eins": 1, "eine": 1, "zwei": 2, "drei": 3, "vier": 4, "fünf": 5, "sechs": 6, "sieben": 7, "acht": 8, "neun": 9,
          "zehn": 10, "elf": 11, "zwölf": 12, "dreizehn": 13, "vierzehn": 14, "fünfzehn": 15, "sechzehn": 16, "siebzehn": 17, "achtzehn": 18, "neunzehn": 19}
_TENS = {"zwanzig": 20, "dreißig": 30, "dreissig": 30, "vierzig": 40, "fünfzig": 50, "sechzig": 60, "siebzig": 70, "achtzig": 80, "neunzig": 90}
_DIGIT = {"null": "0", "eins": "1", "ein": "1", "zwei": "2", "drei": "3", "vier": "4", "fünf": "5", "sechs": "6", "sieben": "7", "acht": "8", "neun": "9"}


def number_word(word: str) -> int | None:
    """"vierundsechzig" -> 64, "hundertzwanzig" -> 120, "dreißig" -> 30; None if it is no number word."""
    w = word.lower()
    if w in _UNITS:
        return _UNITS[w]
    if w in _TENS:
        return _TENS[w]
    if "hundert" in w:
        head, _, tail = w.partition("hundert")
        base = 1 if head == "" else number_word(head)
        rest = 0 if tail == "" else number_word(tail)
        return None if base is None or rest is None else base * 100 + rest
    if "und" in w:
        unit, _, ten = w.partition("und")
        if unit in _UNITS and ten in _TENS and 1 <= _UNITS[unit] <= 9:
            return _TENS[ten] + _UNITS[unit]
    return None


def numbers(text: str) -> tuple[str, dict[str, str]]:
    """Number words to digits. Returns the text and `{written: spoken}` for what was changed."""
    tokens = text.split()
    out: list[str] = []
    heard: dict[str, str] = {}
    i = 0

    def digits_after(j: int) -> tuple[str, int]:
        d = ""
        while j < len(tokens) and tokens[j].lower().strip(",.") in _DIGIT:
            d += _DIGIT[tokens[j].lower().strip(",.")]
            j += 1
        return d, j

    while i < len(tokens):
        raw = tokens[i]
        word = raw.strip(",.;:!?")
        trail = raw[len(word):] if raw.startswith(word) else ""
        n = number_word(word)
        if n is None:
            out.append(raw)
            i += 1
            continue
        j = i + 1
        written = str(n)
        # "null komma null null eins" -> 0.001, "null punkt drei punkt null" -> 0.3.0
        while j + 1 < len(tokens) and tokens[j].lower() in ("komma", "punkt") and tokens[j + 1].lower().strip(",.") in _DIGIT | {k: 0 for k in _UNITS} | {k: 0 for k in _TENS}:
            sep = "," if tokens[j].lower() == "komma" else "."
            if sep == ",":
                d, k = digits_after(j + 1)
                if not d:
                    break
                written += "." + d
                j = k
            else:
                m = number_word(tokens[j + 1].strip(",.;:!?"))
                if m is None:
                    break
                written += "." + str(m)
                j += 2
        if j > i + 1 or raw.lower().strip(",.") not in ("ein", "eine", "eins") or (j < len(tokens) and tokens[j].lower() == "punkt"):
            heard[written] = " ".join(tokens[i:j])
            out.append(written + (trail if j == i + 1 else ""))
            i = j
        else:
            out.append(raw)  # a lone "ein"/"eine" is an article
            i += 1
    return " ".join(out), heard


# --- the normaliser -----------------------------------------------------------------------------------
def _squash(s: str) -> str:
    return re.sub(r"[\s_\-]+", "", s.lower())


def normalise(text: str, vocab: list[Term]) -> dict[str, Any]:
    """`{text, heard, segments}`: the cleaned text and it cut into plain text and project terms with their alternatives."""
    heard_text = text.strip()
    cleaned, spoken = numbers(heard_text)
    prefixes = {t.term.split("-")[0] for t in vocab if t.kind == "Issue" and "-" in t.term} or {"TIM"}
    cleaned = re.sub(r"\b(" + "|".join(map(re.escape, prefixes)) + r")[\s-]?(\d+)\b", lambda m: f"{m.group(1).upper()}-{m.group(2)}", cleaned, flags=re.I)
    # words that are one term when written together: "pred len" -> pred_len, "tsrm" typed apart, ...
    words = cleaned.split()
    by_kind: dict[str, list[str]] = {}
    for t in vocab:
        by_kind.setdefault(t.kind, []).append(t.term)
    squashed = {_squash(t.term): t for t in vocab}
    segments: list[dict[str, Any]] = []
    plain: list[str] = []
    i = 0
    longest = max([len(re.split(r"[\s_\-]+", t.term)) for t in vocab] + [1])
    while i < len(words):
        match = None
        for n in range(min(longest, len(words) - i), 0, -1):
            window = " ".join(words[i : i + n])
            core = window.strip(",.;:!?")
            hit = squashed.get(_squash(core))
            if hit is None and n == 1 and len(_squash(core)) >= 5:
                close = difflib.get_close_matches(_squash(core), list(squashed), n=1, cutoff=0.85)
                hit = squashed[close[0]] if close else None
            if hit is not None:
                match = (n, hit, window)
                break
        if match:
            n, hit, window = match
            if plain:
                segments.append({"text": " ".join(plain)})
                plain = []
            alts = [a for a in difflib.get_close_matches(hit.term, [x for x in by_kind[hit.kind] if x != hit.term], n=3, cutoff=0.4)]
            segments.append({"term": hit.term, "heard": window.strip(",.;:!?"), "kind": hit.kind, "alts": alts})
            if window[-1] in ",.;:!?":
                plain.append(window[-1])
            i += n
            continue
        plain.append(words[i])
        i += 1
    if plain:
        segments.append({"text": " ".join(plain)})
    # one space between neighbours (a plain text keeps its own spaces inside)
    spaced: list[dict[str, Any]] = []
    for seg in segments:
        if spaced and not seg.get("text", "x").startswith((",", ".", ";", ":", "!", "?")):
            spaced.append({"text": " "})
        spaced.append(seg)
    # versions are terms too: 0.3.0
    out: list[dict[str, Any]] = []
    for seg in spaced:
        if "text" not in seg:
            out.append(seg)
            continue
        pos = 0
        for m in re.finditer(r"\b\d+\.\d+\.\d+\b", seg["text"]):
            if m.start() > pos:
                out.append({"text": seg["text"][pos : m.start()]})
            out.append({"term": m.group(0), "heard": spoken.get(m.group(0), m.group(0)), "kind": "Version", "alts": []})
            pos = m.end()
        if pos < len(seg["text"]):
            out.append({"text": seg["text"][pos:]})
    final = "".join(s.get("text") or s["term"] for s in out)
    return {"text": final, "heard": heard_text, "segments": out}


def join(segments: list[dict[str, Any]]) -> str:
    return "".join(s.get("text") or s["term"] for s in segments)


# --- recognition ---------------------------------------------------------------------------------------
class Recogniser:
    """faster-whisper, loaded once per model in the background (the first use downloads it)."""

    def __init__(self) -> None:
        self._models: dict[str, Any] = {}
        self._loading: dict[str, threading.Thread] = {}
        self._error: str | None = None
        self._lock = threading.Lock()

    @staticmethod
    def installed() -> bool:
        try:
            import faster_whisper  # noqa: F401
        except ImportError:
            return False
        return True

    def status(self, model: str) -> dict[str, Any]:
        if not self.installed():
            return {"engine": "browser", "ready": True, "loading": False, "reason": "faster-whisper ist nicht installiert (mlviz[voice])."}
        with self._lock:
            ready = model in self._models
            if not ready and model not in self._loading and self._error is None:
                t = threading.Thread(target=self._load, args=(model,), daemon=True)
                self._loading[model] = t
                t.start()
            return {"engine": "whisper", "ready": ready, "loading": not ready and self._error is None, "error": self._error, "model": model}

    def _load(self, model: str) -> None:
        try:
            from faster_whisper import WhisperModel

            m = WhisperModel(MODELS.get(model, "small"), device="auto", compute_type="int8")
            with self._lock:
                self._models[model] = m
        except Exception as e:  # the download or the load failed: the browser takes over
            with self._lock:
                self._error = str(e)
        finally:
            with self._lock:
                self._loading.pop(model, None)

    def transcribe(self, audio: bytes, lang: str, model: str, prompt: str) -> str:
        m = self._models.get(model)
        if m is None:
            raise RuntimeError("Die Erkennung wird noch geladen.")
        segments, _info = m.transcribe(io.BytesIO(audio), language=None if lang == "auto" else lang, initial_prompt=prompt, vad_filter=True)
        return " ".join(s.text.strip() for s in segments).strip()
