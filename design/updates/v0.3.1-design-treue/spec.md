# v0.3.1 · Design-Treue

Issue: TIM-103 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.3 · Einstellungen"
Prototype: prototype/Prototyp-03.dc.html · Builds on: v0.3.0

## Goal
The real tool looks like the approved overall prototype, in every area that exists in v0.3.0.

## How to read this spec

- Nothing new is designed here. Every area was designed and approved in v0.1 to v0.3.0; the specs of those
  updates keep binding the behaviour. This update changes the look only.
- **The prototype is binding for the look:** layout, spacing, type sizes and weights, colours, borders,
  icons and the kind of every control (a pill menu stays a pill menu, a slider stays a slider, an SVG icon
  is not replaced by a Unicode glyph). Take the values from the prototype's CSS instead of inventing styles;
  where a value equals a token in `design/tokens.json`, use the token.
- `prototype/README.md` says how to run the prototype and how to reach every state named below.
- Compare each area at 1440 × 860 with the prototype, side by side, and fix what differs. What stays
  different on purpose goes to `decided.md` with its reason.

## Features

### F · Frame
**What:** Icon rail on the left, tab bar, search box on top, status bar at the bottom, notifications and
bell, as in the start state of the prototype.
**Behaviour:**
- Open the tool → icon rail, tabs, search box and status bar look like the prototype's start state.
- Click the left part of the status bar → the running-runs popover looks like the prototype.
- Click the bell → the notification list looks like the prototype.
- A run event arrives → its notification looks like the prototype's event of the same kind (switch
  "Prototyp: Ereignis").
**In the prototype:** `Prototyp-03.dc.html` (frame, status bar, notifications), `frame.js`.

### G · Läufe
**What:** The run list with the newest-run card, issue groups and run rows, and the issue view.
**Behaviour:**
- Open Läufe → filter bar, newest-run card, issue groups and run rows look like the prototype.
- Click "Issues" → the issue view looks like the prototype.
**In the prototype:** `G2-EigeneZeile.dc.html`, `F-Issues-021.dc.html`.

### H · Run tab
**What:** The run tab with config rail, description, compare chips, overview tiles, groups table and the
notes column; notes at sections and rows with markers.
**Behaviour:**
- Open a run → header, config rail, description, overview, groups table and notes column look like the
  prototype.
- Open the config of a run → blocks and YAML view look like the prototype.
- Notes at a section or row → markers, "+ Notiz", note cards and the agent proposal look like `E2-Rand`.
**In the prototype:** `P-Run-03.dc.html`, `J1-Bloecke.dc.html`, `J4-YAML.dc.html`, `E2-Rand.dc.html`.

### I · Analysis
**What:** The analysis with its scope switch, templates and widgets.
**Behaviour:**
- Open Analyse → scope switch, header with template menu and buttons, and the widget cards look like the
  prototype, for "Ein Lauf", "Zwei Läufe" and "Projektverlauf".
- Click "Einstellen" on a widget → its settings look like the prototype.
**In the prototype:** `P-Analyse-02.dc.html`, `G-Vorlagen.dc.html`, `W-Widget.dc.html`,
`E1-Duell.dc.html` … `E4-Analyse.dc.html`.

### J · Agent window
**What:** The floating agent window with header, context chips, action lines, answers, input, mode switch
and voice input.
**Behaviour:**
- Open the agent → window, header, chips, action lines, answers and input look like the prototype.
- Start voice input → the recording bar looks like the prototype; stop → the review box looks like the
  prototype.
**In the prototype:** `Prototyp-03.dc.html` (agent window), `voice-data.js`.

### K · Settings
**What:** The settings tab with categories, search, presets, undo and redo, and rows.
**Behaviour:**
- Open the settings → header with title and project, search with icon and `/` hint, "Geändert n" as a
  pill with counter, "★ Voreinstellungen" as a pill menu, undo and redo as icon buttons, categories with
  icons and the groups KATEGORIEN and MEHR, rows with bold labels, section headings with a rule, the tip
  box with its icon, and the size control as slider with − and + look like the prototype.
**In the prototype:** `S1-Einstellungen.dc.html`, `settings-data.js`.

### L · Command palette
**What:** The palette for runs, issues and commands.
**Behaviour:**
- Press Ctrl+P or click the search box → the palette with its rows, icons and hints looks like the
  prototype.
- Type `>` or press Ctrl+Shift+P → the command list and its second steps look like the prototype.
**In the prototype:** `Prototyp-03.dc.html` (palette), `palette-data.js`.

## Changes to principles.md / tokens.json
- none

## Out of scope
- New behaviour of any kind; where look and behaviour of v0.3.0 conflict, the behaviour stays.
- Widget header and config title of v0.2.4 (TIM-97), which the prototype already shows.
- The prototype's made-up numbers and texts.

## Open
- If a value in the prototype's CSS has no token, then use the value as it is.
- If the prototype and a principle in `principles.md` disagree (for example a number format), then the
  principle wins and the deviation goes to `decided.md`.
- If the real tool shows a state the prototype does not have, then build it from the nearest state in the
  prototype.
- `tests/browser/test_progress.py` expects the version text `v0.3.0` in the status bar; with the version
  0.3.1 it has to expect `v0.3.1`.
