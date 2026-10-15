# v0.2.0 · Agent

Issue: TIM-88 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.2 · Agent"
Prototype: prototype/Prototyp.dc.html · Builds on: v0.1.0

## State

| Block | Status |
|---|---|
| A · Agent panel | decided |
| B · Voice | moved to a later update (not included) |
| C · Tool control | decided |
| D · Analysis by agent | decided |
| E · Widget format | decided |
| F · Agent connection | open |

Running block: none. Notes from Tim for later
blocks: F: subscription via `claude -p` is fine (personal tool; a published version would use an API
key). Whether chats show up in claude.ai does not matter.

## Goal
The agent can operate the tool on Tim's behalf, by text or voice.

## Features

### A · Agent window
**What:** The agent lives in a floating window above the content, not docked, so no view loses width
(experiment view with detail panel stays as in v0.1). The window has a header with the chat title and
chat list, a context chip showing what the agent sees, the message history and an input with a
microphone button. Minimised, it shrinks to a capsule in the bottom right corner.
**Behaviour:**
- Click the agent icon at the bottom of the icon bar while the window is closed or minimised → the window opens at its last position and size (first time: 400 × 520 px, 24 px from the bottom right corner of the tool).
- Click the agent icon while the window is open → the window minimises to the capsule.
- Drag the header → the window moves; it always stays fully inside the tool, right of the icon bar and below the tab strip.
- Drag the bottom right corner → the window resizes; minimum 320 × 280 px, never beyond the tool.
- Click – → the window minimises to the capsule (agent icon, "Agent · <last action>" or "Agent · bereit", microphone button, open button).
- Click the capsule text or its open button → the window opens again where it was.
- Click × or press Esc → the window closes; the chats are kept.
- Switch tab or area → the context chip changes: "Lauf · <run name without timestamp>", "Analyse", "Läufe · Liste" or "Läufe · Issues".
- Click the chat title → a list of the project's chats opens (title, last activity), newest first; click one → it becomes the current chat.
- Click + → a new empty chat "Neuer Chat" becomes current.
- Click the microphone button (window or capsule) → nothing happens; it is disabled with the tooltip "Sprache kommt in einem späteren Update" (B is not included in v0.2).
- Type and press Enter or click ↑ → the message is appended to the current chat and sent to the agent (F).
- Position, size, open/minimised/closed state and the chat list are stored per project, like the frame state of v0.1.
**Edge cases:** The tool window gets smaller than the agent window → the window is pushed and shrunk to fit.
**In the prototype:** `Prototyp-02.dc.html` (= `A1-Fenster.dc.html`): `agentMode` ('open' | 'min' | 'closed'), `ax/ay/aw/ah`, `drag('move' | 'size')`, `chats`, `newChat`, `capsule`, `ctx`.
**Rejected:** A docked panel on the right (narrows the content, too tight with the detail panel); a drawer from the edge (covers what the agent changes); a command bar only (no room for answers and history).

One chat in the tool is one Claude Code session: the tool stores per chat its title, last activity
and `session_id`; a new message continues it with `claude -p --resume <session_id>` (see F).

### C · Tool control
**What:** The agent operates the tool through a fixed set of tools. How freely it acts is set by a mode,
as in Claude Code: Direkt, Gemischt, Bestätigen. Every action it takes appears in the chat as an action
line; actions awaiting confirmation appear as a confirmation card. Every executed action can be undone.

**Tools** (each maps to existing v0.1 state, e.g. the frame actions in `web/src/state/frame.ts`):

| Group | Tools | Kind |
|---|---|---|
| Search (read only) | find runs by date, issue, run feature (e.g. `pred_len`) and grid axes; read results, cells, config of a run | read |
| Navigate | open a run as tab, focus or close a tab, switch Läufe view (Liste / Issues), open Analyse with a scope (Ein Lauf / Zwei Läufe / Projektverlauf) and its runs | nav |
| View settings | in a run tab: filters, grouping, columns, sort; open the detail of a combination | nav |
| Change analysis | add, remove, configure widgets on a board (feature D) | change |
| Save | save widget images or configs as files (as the v0.1 save dialog does) | change |

**Modes:**

| Mode | read | nav | change |
|---|---|---|---|
| ⏵⏵ Direkt | immediate | immediate | immediate |
| ⏵ Gemischt (default) | immediate | immediate | confirmation |
| ⏸ Bestätigen | immediate | confirmation | confirmation |

**Behaviour:**
- Click the mode button below the input ("⏵ Gemischt ▾") → a menu lists the three modes with one sentence each; click one → it applies from the next action on.
- Press Shift+Tab while the input has focus → the mode cycles Direkt → Gemischt → Bestätigen → Direkt.
- The mode is stored per project and applies to all chats; a new project starts with Gemischt.
- The agent runs an immediate action → the tool changes at once, the chat shows an action line "✓ <what happened>" with "Rückgängig", and the changed element (new tab, set filter, changed widget) briefly glows (about 1.5 s).
- The agent runs an action that needs confirmation → the chat shows a card "Bestätigen · <what it will do>" with details (e.g. the target file path) and the buttons "Ausführen" (for saving: "Speichern") and "Ablehnen"; nothing changes before the click. Enter while the card is the last item executes it.
- Click "Ausführen" → the action runs and the card turns into an action line with "Rückgängig".
- Click "Ablehnen" → the card turns into "✕ Abgelehnt · <action>"; the agent is told and continues without it.
- Click "Rückgängig" → the action is reverted (tab closed, filter removed, widget restored, saved file deleted) and the line shows "↶ <reverted>" with "Wiederholen".
- A request matches several runs → the agent asks back with clickable run cards (run name, date, state, varied axes); click one → it continues with that run.
- A confirmation card is open and Tim types a new message → the card is rejected and the new message is handled.
**Edge cases:** Undo of a save whose file was changed or moved since → the line says "Datei wurde inzwischen geändert, nicht gelöscht" and nothing is deleted. Undo is offered only for actions of the current tool session; after a reload the lines stay but without "Rückgängig".
**In the prototype:** `C1-Direkt.dc.html`, `C2-Gemischt.dc.html`, `C3-Bestaetigen.dc.html` (same example per mode: `MODES`, `ACTIONS` with `kind` 'nav' | 'change', `stateOf`); in `Prototyp-02.dc.html` the mode switch (`agentMode2`, `MODES`) and undo on action lines.
**Rejected:** A single fixed behaviour (only direct, only confirm or only mixed); Tim wants all three as modes like Claude Code.

### D · Analysis by agent (templates)
**What:** The agent builds and adjusts analysis boards with the tools of C (group "Change analysis") —
switch scope and runs, show/hide and configure widgets, change their order. New is the *template*
(Vorlage): a saved board without runs — scope, visible widgets in order, and their settings — that Tim
builds up over time and applies to any run(s). Boards themselves stay unsaved as in v0.1; there are no
boards bound to runs.

**Template as data:** `{ name, scope: "one" | "two" | "project", widgets: [{ type, opts }], last_used:
{ runs: [...], at } }`, stored per project next to the frame state. One built-in template per scope,
"Standard", equals the v0.1 default board and cannot be deleted or overwritten.

**Behaviour:**
- Analysis header (all three scopes) → new button "Vorlage <name> ▾" left of the spacer, new button "Als Vorlage speichern" left of "+ Widget".
- Click "Vorlage … ▾" → a menu lists the templates of the current scope: name, "zuletzt <run> · <date>" (or "eingebaut"), and the widget names joined by " · "; the current one is highlighted.
- Click a template → it is applied to the current run(s): the board shows exactly its widgets, order and settings; the board glows briefly; `last_used` is updated.
- Change the board after applying (settings, + Widget, ×) → the template button shows "· geändert" and a button "Vorlage aktualisieren" appears.
- Click "Vorlage aktualisieren" → the template is overwritten with the current board; "geändert" disappears. On "Standard" the button is not shown; use "Als Vorlage speichern" instead.
- Click "Als Vorlage speichern" → a small popover asks for a name (empty → "Neue Vorlage") with the hint that runs are not saved; "Speichern" → the template is saved for the current scope and becomes the current template. An existing name is overwritten.
- Open a run's analysis for the first time → the template last used in that scope is applied (first ever: "Standard").
- Agent: "mach <template> mit <runs>" → applies the template (kind nav); "wie letzte Woche" → the agent may use a template's `last_used.runs`; saving or updating a template is kind change (confirmation in Gemischt).
**Edge cases:** A template contains a widget whose settings name an axis or value the current run does not have → the widget falls back to its catalog default settings and shows a `warn` note "Einstellung aus der Vorlage passt nicht zu diesem Lauf". A template for "Zwei Läufe" applied with only one run selected → the scope controls ask for run B as in v0.1.
**In the prototype:** `D1-Vorlagen.dc.html` (template menu `tpls`, `apply`, `dirty`, `updateTpl`, `doSaveTpl`; agent demo `SUG` in mode Gemischt); in the overall prototype `Prototyp-02.dc.html` → `P-Analyse-02.dc.html` → `G-Vorlagen.dc.html` (scope "Ein Lauf" only; the two other scopes behave the same).
**Rejected:** Boards saved with their runs (D2): reopening runs is quick and results already live as saved images. Boards and templates as two concepts (D3): one concept is enough, a template remembers its last runs.

### E · Widget format (own widgets, width, order)
**What:** The agent creates new widgets without code changes by writing a declarative description that
the tool renders. There is no widget builder screen: the agent is the builder. A new widget first appears
as a draft on the board; kept widgets go to the catalog section "Eigene" and work like built-in ones
(settings, save as image, templates). Every widget, built-in or own, has a width (half or full row) and
a position that Tim or the agent can change.

**Format:** Vega-Lite (v5) with a thin wrapper, stored per project as one JSON file per own widget:
`{ name, question, scope: "one" | "two" | "project", width: "half" | "full", params: [{ name, label,
options, default }], data: { source, filter }, spec: <Vega-Lite without data> }`.
- Sources the tool provides (already aggregated over replicates unless stated): `cells` (one row per
  combination: axes + catalog metrics, mean and sd), `channels` (per combination and channel), `curves`
  (per epoch), `predictions` (per window and step), `runs` (one row per run: Lauf-Merkmale, date, state).
  In scope "two" every row carries `run` = "A" | "B"; in "project" every row carries the run id.
- `filter` and Vega-Lite fields may reference params as `{{param.<name>}}`; params appear under
  "Einstellen" like built-in settings.
- The tool applies its own theme (tokens.json: fonts, series colours, grid, dark board / light export),
  so own widgets look like built-in ones; the spec must not set colours or fonts.
- Invalid spec or empty data → the tile shows "Widget kann nicht gezeichnet werden: <reason>" and the
  agent sees the same message.

**Behaviour:**
- Tim describes a widget to the agent → a draft appears as the first row of the board: the row is hatched, the draft tile sits centered in it at its own width (half → half the board width, the free sides say "halbe Breite, wie später im Board"), dashed violet border, label "Entwurf · vom Agenten" and its title. Creating or changing a draft is kind nav (no confirmation in Gemischt).
- Tim asks for changes → the draft is updated in place.
- Draft header "Breite Halb | Ganz" → the draft changes its width at once.
- Draft header "Beschreibung" → the tile shows the JSON description instead of the chart (read only); click again → back to the chart.
- Draft header "Verwerfen" → the draft disappears.
- Draft header "Behalten" or telling the agent to keep it → (kind change, confirmation in Gemischt) the widget is saved under its name in "Eigene", becomes a normal tile at the position of the draft with label "<name> · eigen", keeps its width.
- "+ Widget" → the menu shows "Katalog" and "Eigene" (with "Noch keine …" when empty); an own widget can be added any number of times.
- Own tile "Einstellen" → its params plus "Breite".
- Every tile's "Einstellen" → "Breite Halb | Ganz"; default: Vergleichstabelle full, all others half. Width is stored with the board and in templates (D).
- Tile header ↑ / ↓ → the tile moves one position earlier / later in the board order; the grid fills rows left to right, a full-width tile always starts a new row.
- Agent: "schieb das unterste Widget nach oben", "mach die Tabelle breit", "setz Je Region neben Beste Config" → moves or width changes (kind change, confirmation in Gemischt).
- Delete an own widget from the catalog → only via the agent or the "Eigene" menu entry's ×; tiles already on boards and in templates show "Widget gelöscht".
**Edge cases:** A draft is open and Tim switches tab or scope → the draft is kept for that board until kept or discarded. Two drafts at once are not possible; a new request replaces the open draft (the old one is listed in the chat with "Wiederholen").
**In the prototype:** `E1-Eigene.dc.html` (draft `draft`, `draftWidths`, `draftSpec`, `keep`, catalog `ownCat`, own tile renderer `chart`, width control, ↑/↓ `up`/`down`); in the overall prototype `G-Vorlagen.dc.html` has width and ↑/↓ for the built-in widgets; the own-widget flow is only in `E1-Eigene.dc.html`.
**Rejected:** Python code widgets (E2): look different, not switchable, run code; moved to a later update if the description proves too narrow. Description plus code escape hatch (E3): later, same reason. A separate widget builder screen: the agent is the builder.

## Changes to principles.md / tokens.json

## Out of scope
- Code widgets (Python) and a code escape hatch for own widgets; later update if needed.
- Free drag-and-drop layout and widths other than half / full.
- Voice input (feature B, later update); only the disabled microphone button is in v0.2.

## Open
