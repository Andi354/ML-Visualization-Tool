# v0.3.0 · Einstellungen

Issue: TIM-96 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.3 · Einstellungen"
Prototype: prototype/ · Builds on: v0.2.4

## State

| Block | Status |
|---|---|
| A · Settings screen | decided: A1 (like the Agent-Dashboard settings) |

All blocks decided. Next: final check and handover (Tim's OK pending). Canvas: Prototyp-03 (overall,
gear in the rail opens the settings tab), row A with A1 marked chosen. Tim: which settings stay or are
missing is decided while using the tool; the list below is the starting set.

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

## Changes to principles.md / tokens.json
- none

## Out of scope
- The dialogs behind action rows beyond what the rows say (own-widget manager and instruction editor follow their own features; export/import is a plain file dialog).
- Themes or recolouring: colours carry meaning (see principles.md).

## Open
- Which settings stay: decided in use. If a setting turns out unused or missing, it is changed in a later patch update.
