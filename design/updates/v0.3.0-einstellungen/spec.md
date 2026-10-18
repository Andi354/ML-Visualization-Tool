# v0.3.0 · Einstellungen

Issue: TIM-96 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.3 · Einstellungen"
Prototype: prototype/ · Builds on: v0.2.4

## State

| Block | Status |
|---|---|
| A · Settings screen | decided: A1 (like the Agent-Dashboard settings) |
| B · Voice input | decided: B3 (review box with recognised project terms), recognition Weg 2 (Whisper on the server with the project vocabulary) |
| C · Command palette | decided: C1 (like VS Code) |
| D · Run notification and progress for the agent | decided: D1 (status bar with running runs and a bell) |
| E · Own notes on runs | running: E1 (warm block under the description) and E2 (margin notes attached to run, section or table group) on the canvas; agreed: agent may propose notes, saved only after confirmation in every mode; Markdown via the v0.2.3 reader for notes and descriptions; storage `.mlviz/notes/<run-id>.json`; waiting for Tim |

Scope changed 17.10. (Tim): B–E added, deliverables area moved to v0.4 (TIM-96 header and decision comment).
Canvas: Prototyp-03 (overall: settings tab, voice input B3, command palette C1, status bar D1), row A with A1 chosen, row B with B3 chosen, row C with C1 chosen, row D with D1 chosen. Tim on A: which
settings stay is decided in use; the list in A is the starting set. Running block: E.

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
| Läufe · Hinweise | `runs.notifyMac` | switch | on | browser notification for finished / failing / stalled runs while the tool tab is hidden |
| | `runs.errWarn` | 1–50 %, step 1 | 5 | share of failed cells that raises "Viele Fehler" |
| | `runs.stallMin` | 10–240 min, step 10 | 30 | minutes without a new cell after which a running run counts as stalled |
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

### C · Command palette
**What:** A command palette like VS Code's. A search box in the middle of the tab strip shows the project
name ("repnet-bench") and opens it; keyboard shortcuts open it in a mode. It lists commands with their
category and shortcut, runs and issues, or settings, matched as you type; anything that matches nothing
can be sent to the agent.

**Behaviour:**
- Ctrl+Shift+P or F1 → palette opens with `>` (commands). Ctrl+P or a click on the search box → palette opens without prefix (runs and issues). The input has focus.
- Prefixes in the input: none = runs and issues, `>` = commands, `@` = settings, `?` = list of prefixes (choosing one sets it).
- `>` with nothing typed → "zuletzt verwendet" (the last 3 commands run, newest first), then "weitere Befehle" (all others in the order of the table below).
- No prefix with nothing typed → "zuletzt geöffnet" (5 runs, newest first), then 3 issues.
- Typing → items are filtered and sorted: substring matches first (earlier is better), then matches where every letter continues the previous match or starts a word (`zl` → "Zwei Läufe"); matched letters are highlighted. Runs match on short name and issue ID, issues on ID and title, settings on label and description (category on the right).
- ↑/↓ move the selection (wraps), Enter runs it, a click runs it, Esc closes without action.
- A command ending in "…" opens a second step in the same palette (title with ←): Lauf öffnen → runs; Issue öffnen → issues; Zwei Läufe vergleichen → second run (the first is the current run); Vorlage anwenden → templates of the current analysis view; Widget hinzufügen → catalog and own widgets; Modus wechseln → the three agent modes. Backspace on an empty input or ← goes back to `>`.
- "Einstellung suchen …" switches the input to `@`. Choosing a setting opens the settings tab at that row.
- Text typed in `>` or no-prefix mode always adds a last item "✦ Agent fragen: „<text>“" (desc "kein Befehl passt" when it is the only item) → Enter sends the text to the agent in the current chat and opens the agent window.
- A command that cannot run in the current view (for example "Lauf: Filter zurücksetzen" outside a run tab) is listed but disabled with a note ("nur im Lauf-Tab").

**Commands (starting set; category: label · shortcut):**

| Category | Commands |
|---|---|
| Läufe | Lauf öffnen … · Ctrl+P; Issue öffnen …; Als Liste zeigen; Nach Issue gruppieren |
| Lauf | Diesen Lauf analysieren; Notiz hinzufügen (E); Filter zurücksetzen; Beschreibung auf- oder zuklappen |
| Analyse | Ein Lauf; Zwei Läufe vergleichen …; Projektverlauf; Vorlage anwenden …; Widget hinzufügen …; Als Deliverable speichern … · Ctrl+S |
| Agent | Fenster zeigen oder verbergen · Ctrl+J; Neuer Chat; Spracheingabe starten · Ctrl+M; Modus wechseln … · Shift+Tab; Chat komprimieren (/compact) |
| Einstellungen | Öffnen · Ctrl+,; Einstellung suchen …; Dichte umschalten; Größer · Ctrl++; Kleiner · Ctrl+- |
| Ansicht | Zurücksetzen |
| Hilfe | Tastenkürzel (list of all shortcuts) |

New shortcuts: Ctrl+J (agent window), Ctrl+S (save as deliverable, only in the analysis), Ctrl++ / Ctrl+- (size, they set `look.scale` instead of the browser zoom). The agent's commands (v0.2 C) and the palette share one command list in the frontend, so a new command is added once.

**In the prototype:** `Prototyp-03.dc.html` (`pShow`, `pRunCmd`, `ACT`, `pit`, `fuzzy`, `parts`, search box `pOpenQuick`), commands in `palette-data.js` (`CMDS`, `STEPS`, `PREFIXES`, `RECENT`), single variant `C1-Palette.dc.html`. Commands without an `ACT` entry only show a toast; disabled commands are not shown in the prototype.

**Rejected:** none; one variant built on Tim's wish to follow VS Code.

### D · Run notification and progress
**What:** A status bar along the bottom of the whole window, as in VS Code. Left: running runs with progress
and remaining time, and a warning when one stalls. Right: agent status, project and version, and a bell with
the number of unread run events. Events also pop up as a notification in the bottom right; a closed one stays
under the bell. The agent gets a tool that reports the progress of a run.

**Behaviour:**
- The backend checks the runs every 10 s in the background (not only while the runs list is open) and keeps, per running run: cells done and planned, failed cells, the time of the last finished cell, and the rate from the `finished_at` of the last 50 cells (at most the last 2 h).
- Status bar left, at least one running run → spinner and "<n> läuft/laufen · <short name of the newest running run that is not stalled> · <percent> · noch ~<remaining>"; no running run → "Keine Läufe aktiv". A stalled run adds "⚠ <n> hängt" in amber. Remaining time = remaining cells / rate, rounded (minutes below 1 h, "h min" above); fewer than 5 finished cells → no remaining time ("Restzeit nach den ersten Zellen").
- Click the left part → popover "Laufende Läufe": per run short name, issue, percent, progress bar, and "<done> von <planned> Zellen · <errors> Fehler · <rate> Zellen/h · noch ~<remaining> (fertig ca. <time>)"; a stalled run in amber "hängt seit <min> · letzte Zelle <time>". "Öffnen" opens the run tab.
- Events: a run goes from running to finished → "Lauf fertig" (duration, cells, best value of the primary metric, errors; actions Öffnen, Analysieren, ✦ Zusammenfassen). Failed cells of a running run reach `runs.errWarn` → "Viele Fehler" once per run (share, last error message; action Fehler zeigen = run tab filtered to errors). No new cell for `runs.stallMin` → "Lauf hängt" once until a new cell arrives (action Öffnen). A new run appears → only a short note in the status bar ("neu gestartet: <name>", 5 s), no event under the bell.
- An event → a notification in the bottom right above the status bar (closes after 9 s unless the summary is running; × closes it) and an unread entry under the bell. The bell shows the unread count in blue.
- Click the bell → popover "Hinweise", newest first, unread with a dot; "Alle gelesen", "Leeren". Clicking an action marks the entry read.
- "✦ Zusammenfassen" → the agent writes a short summary of the finished run (best configurations, comparison with the previous run of the same issue) into the notification and the bell entry; it is not sent as a chat message. Only on click, never automatically.
- `runs.notifyMac` on and the tool tab hidden → the same events also as a browser notification (permission asked on first use); clicking it focuses the tool and opens the run.
- Events are kept for the session in the browser; after a reload the bell starts empty (the status bar is rebuilt from the runs).

**Agent tool `run_progress` (lesen):** argument `run` (folder ID or unique part). Returns `state`, `cells_done`, `cells_planned`, `cells_failed`, `rate_per_hour`, `remaining` (ISO duration or null), `eta` (local time or null), `last_cell_at`, `stalled_since` (or null). `src/mlviz/agent_guide.md`: add the tool to the tool table and to "Der Agent kann" ("Fortschritt eines Laufs nachsehen (`run_progress`): Tempo, Restzeit, hängt seit"); `tests/test_agent_guide.py` must stay green.

**In the prototype:** `Prototyp-03.dc.html` (status bar `nSbRun`, `nRuns`, bell `nNotes`, notification `nT…`, `fire`, demo menu "Prototyp: Ereignis ▾"), data in `notify-data.js`, single variant `D1-Statusleiste.dc.html`. The prototype raises "Lauf fertig" once after 6 s; the demo numbers do not add up across events.

**Rejected:** D2 (no new bar; badge on the runs icon and progress only in the runs list) not built: progress would not be visible in the analysis.

## Changes to principles.md / tokens.json
- none

## Out of scope
- Custom keybindings (shortcuts are fixed in this update).
- Voice output (the agent does not speak), wake words, hold-to-talk.
- The dialogs behind action rows beyond what the rows say (own-widget manager and instruction editor follow their own features; export/import is a plain file dialog).
- Themes or recolouring: colours carry meaning (see principles.md).

## Open
- Rate from `finished_at`: if a project's cells have no `finished_at`, then the rate comes from the change in `cells_done` between background checks over the last 30 min.
- Whisper on the server: if `faster-whisper` cannot be installed or loaded, or a 10 s clip takes longer than 10 s to transcribe with the small model, then use the browser's speech recognition (Web Speech API) with the same normaliser and review box, and the settings row "Erkennung" says which engine is active. Tell Tim.
- Which settings stay: decided in use. If a setting turns out unused or missing, it is changed in a later patch update.
