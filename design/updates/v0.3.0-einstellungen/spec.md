# v0.3.0 · Einstellungen

Issue: TIM-96 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.3 · Einstellungen"
Prototype: prototype/ · Builds on: v0.2.4

## State

| Block | Status |
|---|---|
| A · Settings screen | decided: A1 (like the Agent-Dashboard settings) |
| B · Voice input | decided: B3 (review box with recognised project terms), recognition Weg 2 (Whisper on the server with the project vocabulary) |
| C · Command palette | running: C1 (like VS Code: Ctrl+Shift+P commands, Ctrl+P runs and issues, @ settings, ? prefixes, agent as fallback) on the canvas, waiting for Tim |
| D · Run notification and progress for the agent | open |
| E · Own notes on runs | open: attached to the description, visibly Tim's own |

Scope changed 17.10. (Tim): B–E added, deliverables area moved to v0.4 (TIM-96 header and decision comment).
Canvas: Prototyp-03 (overall: settings tab, voice input B3), row A with A1 chosen, row B with B3 chosen. Tim on A: which
settings stay is decided in use; the list in A is the starting set. Running block: C.

## Goal
One place in the tool to see and change how it behaves for a project.

## Today (from the code on main, v0.2.2)
- Environment only: `MLVIZ_PROJECT_PATH`/`MLVIZ_PROJECT`, `MLVIZ_HOST`, `MLVIZ_PORT`, `MLVIZ_CLAUDE` (path to `claude`), `ANTHROPIC_API_KEY` (agent bills the API when set).
- Stored per project in the browser (`storageKey`): frame, agent window, columns, config view mode, description folds, analysis view, colour-by (Lauf-Merkmal), boards and templates.
- Fixed in code: agent cache TTL (1 h / 5 min), pre-send threshold 50 000 tokens, default agent mode Gemischt, export palette light.
- Deferred since v0.1: where the default Lauf-Merkmal is configured.

## Features

### A · Settings screen
**What:** A settings tab in the style of the Agent-Dashboard settings (VS Code-like). A gear in the icon
bar opens it. Left: a rail with categories, their sections and the number of changed values. Top: search,
a "Geändert n" filter, presets, undo and redo. Right: one category at a time with a short blurb, a tip
box and rows (label, dot when changed, description, control, reset to default). Only values that differ
from the default are stored, per project, in `<project>/.mlviz/settings.json`.

**Behaviour:**
- Click the gear in the icon bar, or press Ctrl+, (Cmd+, on macOS) → a tab "Einstellungen" opens (or is focused) and the gear is highlighted.
- Click a rail area (Läufe, Analyse) or another tab → that view shows; the settings tab stays open until closed with ×.
- Click a category in the settings rail → its sections and rows show; click a section → scroll to it.
- Press `/` (focus not in an input) → the search field is focused. Type → rows whose label, description or category match show, grouped by category, with a count line; no match → "Keine Einstellung zu „…“".
- Click "Geändert n" → only changed rows show, grouped by category; click again → normal view. n counts the changed values of all categories.
- Change a value → it applies at once, the row gets a dot and ↺, the counts update, and the file is written (default values are removed from the file, not stored).
- Click ↺ in a row → that value goes back to its default.
- Choose a preset → all its values are set in one step (one undo step).
- Click ↶ / press Ctrl+Z (focus not in an input) → the last change, preset or "Alle zurücksetzen" is undone; ↷ / Ctrl+Shift+Z redoes it. History lives for the session only.
- Action rows (buttons) open the dialog or do the action named; destructive ones are red and ask for confirmation, except "Alle zurücksetzen", which is undoable instead.
- "Mehr → Über" → version, project path, settings file path, shortcuts.
- `.mlviz/settings.json` missing or unreadable → all defaults; unreadable file → a warning line in the header, the file is not overwritten until a value is changed.

**Settings (starting set; keys as in the file):**

| Category · section | Key | Control | Default | Effect |
|---|---|---|---|---|
| Darstellung · Dichte & Größe | `look.density` | Bequem / Kompakt | Bequem | row height and paddings of tables, tiles, bars |
| | `look.scale` | 85–125 %, step 5 | 100 | scales the whole UI (root font size) |
| Darstellung · Zahlen & Zeit | `look.decimal` | 412,8 / 412.8 | de (comma) | decimal sign in tables, widgets and exported images |
| | `look.time` | relative / absolute | relative | time column in Läufe |
| Darstellung · Bewegung | `look.motion` | switch | on | highlight after agent actions, fold animations |
| Läufe · Projekt | `runs.feature` | auto / pred_len / features / none | auto | Lauf-Merkmal used for colouring and the fairness warning (auto = today's detection) |
| | `runs.metric` | from project.yaml / any metric of the project | from project.yaml | primary metric for sorting and "best value" |
| Läufe · Beim Öffnen | `runs.descOpen` | aufgeklappt / zugeklappt | aufgeklappt | first-open state of the run description (later toggles still remembered per run) |
| | `runs.overview` | switch | on | per-axis charts above the table |
| Analyse · Boards & Vorlagen | `ana.width` | Halb / Ganz | Halb | width of newly added widgets |
| | `ana.template` | template names / zuletzt benutzt | Standard | template applied when a run is analysed for the first time |
| Analyse · Widgets | `ana.hints` | switch | on | the "what" line and FEST chips under widget titles (v0.2.4) |
| | `ana.chips` | 2–10 | 4 | visible chips before "+n weitere" |
| | `ana.own` | action "Verwalten …" | | rename or delete own widgets |
| Export · Bild | `exp.theme` | hell / dunkel | hell | default in the save dialog |
| | `exp.scale` | 1× / 2× / 3× | 2× | pixel ratio of saved images |
| | `exp.footer` | switch | on | footer line (run, epoch, commit) in images |
| | `exp.hints` | switch | on | what-line and chips in images |
| Export · Ordner & Dateien | `exp.folder` | text | `deliverables/{datum} {titel}/` | target folder, placeholders `{datum}`, `{titel}`, `{issue}` |
| | `exp.name` | text | `{nr}_{widget}.png` | file name, placeholders `{nr}`, `{widget}` |
| Agent · Verhalten | `agent.mode` | Direkt / Gemischt / Bestätigen | Gemischt | mode of new chats (Shift+Tab in the chat still switches) |
| | `agent.debug` | switch | off | show lookup tools with arguments and results in the chat (TIM-95) |
| | `agent.instructions` | action "Bearbeiten …" | | project instructions (TIM-98), with character count |
| Agent · Sprache | `agent.voiceLang` | Deutsch / Englisch / automatisch | Deutsch | language passed to the recogniser |
| | `agent.voiceModel` | schnell / genauer | schnell | Whisper model size (`small` / `medium`) |
| | `agent.voiceReview` | switch | on | show the review box (off: recognised text is sent at once) |
| | `agent.voiceTerms` | action "Bearbeiten …" | | own extra terms for the recogniser, besides the project vocabulary |
| Agent · Kontext & Kosten | `agent.cacheWarn` | 10–200k tokens, step 10 | 50 | threshold of the pre-send hint (today fixed 50 000) |
| | `agent.quota` | switch | on | show 5 h / week quota in the chat menu when Claude Code reports it |
| Agent · Verbindung | `agent.claude` | text | empty (PATH) | path to `claude`; overrides `MLVIZ_CLAUDE` |
| | `agent.billing` | action "Erneut prüfen" | | shows subscription vs API key and the found claude version |
| Daten · Datei | `data.file` | action "Im Ordner zeigen" | | shows the settings file path |
| | `data.export` | action "Exportieren …" | | export / import all settings as a JSON file |
| Daten · Zurücksetzen | `data.view` | action | | reset tabs, columns, window position, folds (browser storage) |
| | `data.chats` | action | | delete the chat list of this project (Claude Code sessions stay) |
| | `data.all` | action | | all settings to default, undoable |

Presets: "Für Meetings" (`look.scale` 115, `exp.scale` 3, `exp.hints` off), "Große Grids" (`look.density` compact, `look.scale` 90, `runs.overview` off).

**Edge cases:** an environment variable (`MLVIZ_CLAUDE`) and a set value both exist → the setting wins and its row says so. A value in the file that no longer exists (old key, invalid value) → ignored and kept in the file.

**In the prototype:** `Prototyp-03.dc.html` (gear, `toggleSettings`, settings tab, Ctrl+,), `S1-Einstellungen.dc.html` (`change`, `hist`/`fut`, `modOnly`, search, presets), data in `settings-data.js` (`CATS`, `PAGES`, `S`, `PRESETS`). Action dialogs are only hinted by a toast.

**Rejected:** none; one alternative built on Tim's wish to follow the Agent-Dashboard.

### B · Voice input
**What:** The microphone in the agent window (and in the minimised capsule) records speech. The server
transcribes it with Whisper, primed with the project's own vocabulary, and normalises numbers and versions.
The result shows in a review box above the input: plain text with the recognised project terms marked;
a click on a term offers alternatives and what was actually heard. Then send, edit as text or discard.

**Behaviour:**
- Click the microphone or press Ctrl+M → recording starts: the input row turns red with "Hört zu", a level meter and the elapsed time; the microphone becomes a stop button. In the capsule, the window opens first.
- Click stop or press Ctrl+M again → "Erkenne … mit Projektbegriffen" until the server answers, then the review box shows the text.
- Esc while recording → the recording is discarded, nothing is sent.
- Review box: "Gesprochen · n Projektbegriffe erkannt"; each term is a marked chip. Click a chip → a small list: the recognised term (marked "erkannt"), up to three alternatives of the same kind, and the literal heard words ("wie gehört"). Choosing one replaces the chip; a changed chip turns amber.
- Review box → Enter or "Senden" sends the text (with any text typed in the field before it); "Als Text bearbeiten" moves the text into the input field; "Verwerfen" or Esc drops it; "+ weitersprechen" keeps the text and records more.
- Sending spoken text goes through the same pre-send cache check as typed text (v0.2 F).
- A spoken user message shows a small microphone; hovering it shows the heard words.
- `agent.voiceReview` off → the recognised text is sent at once, without the review box.
- Microphone permission denied or no microphone → the microphone button shows a tooltip with the reason and does nothing; nothing else changes.

**Recognition (Weg 2):**
- Browser records with MediaRecorder (`audio/webm;codecs=opus`) and posts the clip to a new backend endpoint (for example `POST /api/voice`), with the language from `agent.voiceLang`.
- Backend transcribes with `faster-whisper` (model from `agent.voiceModel`, CPU int8 unless a GPU is free), `initial_prompt` built from the project vocabulary: grid axis and config keys, metric names, Lauf-Merkmal values, run folder IDs and short names, issue IDs, template and widget names, plus `agent.voiceTerms`.
- A deterministic normaliser runs after Whisper: German number words → digits ("vierundsechzig" → 64, "null komma null null eins" → 0.001), "punkt" between numbers → "." ("null punkt drei punkt null" → `0.3.0`), "TIM 52" → `TIM-52`, space-separated known keys → snake_case (`pred len` → `pred_len`), fuzzy match of run names against the run list.
- The response returns segments: plain text and terms with `term`, `heard`, `kind` (Lauf, Achse, Achse · Wert, Lauf-Merkmal, Metrik, Issue, Version) and up to three `alts` of the same kind (closest matches).
- `faster-whisper` is an optional dependency (`mlviz[voice]`), installed in the Docker image; the model is downloaded on first use into a cache (in Docker a volume). Until it is ready the microphone shows "Erkennung wird geladen …".
- The microphone works because the tool runs on `localhost` in Tim's browser (VS Code port forwarding), a secure context.

- `src/mlviz/agent_guide.md`: the line "Mit Sprache arbeiten (der Mikrofon-Knopf ist noch ohne Funktion)" goes; the agent only receives text, a spoken message is marked as spoken.

**Edge cases:** recording longer than 2 minutes → stops on its own and is transcribed. Empty or silent recording → toast "Nichts verstanden", no review box.

**In the prototype:** `Prototyp-03.dc.html` (`vMic`, `vStart`, `vStop`, `vSend`, `vSegs`, `vPopAlts`, `capMic`), sample in `voice-data.js` (`SEGS`), single variant `B3-Begriffe.dc.html`. Recognition is simulated: stop always yields the same sample sentence after 1.3 s.

**Rejected:** B1 (text straight into the field, no term review): terms could not be checked. B2 (hold to talk) not built. Weg 1 (browser recognition): no project vocabulary, sends audio to Google in Chrome. Weg 3 (browser + Claude correction): one extra Claude call per utterance.

## Changes to principles.md / tokens.json
- none

## Out of scope
- Voice output (the agent does not speak), wake words, hold-to-talk.
- The dialogs behind action rows beyond what the rows say (own-widget manager and instruction editor follow their own features; export/import is a plain file dialog).
- Themes or recolouring: colours carry meaning (see principles.md).

## Open
- Whisper on the server: if `faster-whisper` cannot be installed or loaded, or a 10 s clip takes longer than 10 s to transcribe with the small model, then use the browser's speech recognition (Web Speech API) with the same normaliser and review box, and the settings row "Erkennung" says which engine is active. Tell Tim.
- Which settings stay: decided in use. If a setting turns out unused or missing, it is changed in a later patch update.
