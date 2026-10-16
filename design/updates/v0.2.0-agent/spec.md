# v0.2.0 · Agent

Issue: TIM-88 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.2 · Agent"
Prototype: prototype/Prototyp-02.dc.html (see prototype/README.md) · Builds on: v0.1.0 (and the v0.1.1 format fix, see External data)

## Goal
Tim can use the whole tool through an agent in a chat window: open runs, set views, build analyses from templates and own widgets, with every action visible and undoable and the token cost in view.

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
| Change analysis | add, remove, configure, move, resize widgets; save or update templates; keep own widgets (D, E) | change (exceptions: applying a template and creating or changing a widget draft are nav) |
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

### F · Agent connection
**What:** The backend runs Claude Code headless with Tim's subscription login. One chat = one Claude
Code session. The window shows whether the agent is working (with stop), how full the chat's context
is, whether its prompt cache is still warm, and warns before a message would re-read a large chat.

**Call (one per message):** `claude -p "<context line>\n<message>" [--resume <session_id>]
--output-format stream-json --verbose --mcp-config <tool MCP server> --strict-mcp-config
--allowedTools "mcp__mlviz__*,Read,Glob,Grep"`, working directory = the project root.
- The `session_id` of a new chat is taken from the first `system/init` event and stored with the chat.
- The tool runs its own MCP server on localhost (`mlviz`) with the tools of C (search, navigate, view
  settings, change analysis incl. templates and widget drafts, save) and `get_view` (full current view
  state as JSON). The context line is short: area, tab, run, filters, template.
- Confirmations (mode Gemischt / Bestätigen) are enforced by the MCP server: a tool call of a kind that
  needs confirmation waits until Tim clicks Ausführen / Ablehnen, then returns the result or
  "rejected by user". Claude Code's own permission prompts are never shown (only allowed tools exist).
- No Bash, no Edit/Write: the agent changes the tool only through MCP tools and reads project files
  read-only.
- If `ANTHROPIC_API_KEY` is set in the backend environment → warning in the window ("läuft über API-Key,
  nicht über das Abo"); the tool does not remove it.
- One request per chat at a time; other chats can run in parallel.

**Context and cache (computed by the tool, never by asking the agent):**
- After every turn the tool stores per chat: input tokens of the last turn (`input_tokens +
  cache_creation_input_tokens + cache_read_input_tokens` from the `result` usage), the time of the last
  turn, and the cache TTL (1 h with subscription; 5 min if the run used an API key).
- Context % = last input tokens / context window of the model (from Claude Code if available, else
  200 000).
- Cache warm = now − last turn < TTL; remaining minutes = TTL − (now − last turn).

**Behaviour:**
- Window header → after the chat title a small bar with "<n> %" (green < 70 %, amber 70–90 %, red > 90 %), tooltip "Kontext: <x>k von <y>k Tokens"; next to it a chip "Cache warm · <m> min" (green), "Cache abgelaufen" (amber) or "neu" for an empty chat.
- Chat list → each row shows "<when> · <size>k · warm|kalt" (or "leer").
- Send while the cache is cold and the chat has more than 50 000 tokens → nothing is sent; above the input a hint "Cache abgelaufen. Diese Nachricht liest den ganzen Chat neu ein (~<x>k Tokens). Noch nichts gesendet." with "Trotzdem senden", "In neuem Chat senden" (new empty chat, the typed message goes there; no summary), "Abbrechen". The check runs in the tool before any call.
- Send → the message appears, the answer streams in word by word, action lines appear live; the send button turns into a red stop button (■); the capsule shows "Agent · arbeitet …".
- Click stop → the `claude` process is terminated; the chat shows "Abgebrochen"; actions already done stay (with Rückgängig).
- Chat menu → "Diesen Chat komprimieren (/compact)": only enabled while the cache is warm and the chat has ≥ 10 000 tokens (tooltip: compacting reads the chat once itself). Runs `claude -p "/compact" --resume <id>`; afterwards the chat shows "Chat komprimiert · <before>k → <after>k Tokens".
- Chat menu bottom → "Abo · 5 h: <p> % · Woche: <q> %" if Claude Code reports rate-limit usage in stream-json; otherwise the line is not shown.
- First open of the agent window → check: `claude` found, logged in, `ANTHROPIC_API_KEY` set. A failed check shows the step to fix it (e.g. "Im Terminal `claude` ausführen und anmelden") and "Erneut prüfen"; the capsule shows "Agent · nicht eingerichtet" (amber).
- Claude Code reports an error or a usage limit → the chat shows the message and "Erneut senden"; the capsule shows "Agent · Fehler" (red).
**Edge cases:** `/compact` does not work in `-p` mode (to be tested) → the menu entry is not shown; Tim compacts manually in Claude Code (`claude --resume <session_id>` → `/compact`); the chat menu offers "Session-ID kopieren". The tool never summarises a chat by itself.
**In the prototype:** `Prototyp-02.dc.html`: chats with `tokens` and `cache`, `ctxPct`, `cacheLabel`, `send` (pre-send check, `BIG`), `hint`, `sendAnyway`, `newChatWithDraft`, `sendOrStop`, `compact`, `busy`. Setup check and error states are not in the prototype.
**Rejected:** Summarise-and-start-new-chat as compaction: summarising reads the whole chat again, so it saves nothing once the cache is cold; Tim prefers manual compaction in Claude Code over extra machinery.

## Changes to principles.md / tokens.json
- `principles.md` (done in this handover): Frame — the agent window is the exception that floats above
  the content; Widgets — board includes width and order, templates, own widgets as descriptions; new
  section "Agent" (same actions as the UI, visible and undoable, no hidden token cost).
- `tokens.json`: none. Colours in the prototype map to existing tokens: send / Ausführen buttons and
  the active mode → `accent` (the prototype's `#2F5BD3` is a placeholder, use `accent` with dark text as
  in v0.1 buttons); stop button and context > 90 % → `error`; confirmation cards, cold cache, context
  70–90 % → `warn`, `warn-bg`, `warn-line`; executed actions, warm cache, context < 70 % → `best`,
  `best-line`; drafts of own widgets → `series[4]` (`#8C7CF0`); window shadow and surfaces → `surface`,
  `raised`, `line`.

## External data
- Run data as in v0.1 (`runs/<ts>_<config>/`, Parquet `cells`, `channels`, `curves`, `predictions`,
  `meta.json`, `project.yaml`). A fix v0.1.1 adapting the tool to the real repnet-bench format is in
  progress in parallel. The source names of feature E (`cells`, `channels`, `curves`, `predictions`,
  `runs`) are logical datasets the tool provides; if v0.1.1 changes the underlying files, the datasets
  keep these names and map to whatever v0.1.1 reads.
- Claude Code headless (`claude -p`), documented at code.claude.com (headless, cli-reference, mcp,
  prompt-caching, statusline, costs). Facts used: `session_id` in the init event and in json output;
  `--resume <id>` continues; `-p` sessions do not appear in the interactive resume picker; usage objects
  carry `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens` (take
  output from the `result` message); prompt-cache TTL is 1 h on a subscription and 5 min with an API key;
  `ANTHROPIC_API_KEY`, if set, takes precedence over the subscription in `-p` mode; `--mcp-config` takes
  a file or inline JSON and can be passed per call.

## Out of scope
- Code widgets (Python) and a code escape hatch for own widgets; later update if needed.
- Free drag-and-drop layout and widths other than half / full.
- Voice input (feature B, later update); only the disabled microphone button is in v0.2.

## Prototype notes
- Agent answers are placeholders; nothing is sent anywhere. Streaming is simulated by a short delay.
- The overall prototype shows the agent's actions only as sample lines in the first chat; the full
  confirm / undo flow per mode is in `C1-Direkt`, `C2-Gemischt`, `C3-Bestaetigen`, templates by the
  agent in `D1-Vorlagen`, own widgets in `E1-Eigene`.
- Templates, width and order are shown only in "Ein Lauf"; "Zwei Läufe" and "Projektverlauf" behave the
  same.
- Own widgets are drawn by a hand-written SVG in `E1-Eigene`; the save dialog shows no preview for them.
  The real tool draws them with Vega-Lite everywhere, including the save preview.
- Setup check, error states, API-key warning and the "Abo" line are only described, not prototyped.
- Changed elements glow only in `D1-Vorlagen` and `E1-Eigene`; the tool does it for every agent action.
- The prototype's button blue `#2F5BD3` is not a token; see Changes to tokens.

## Open
- Vega-Lite theme: if a Vega-Lite feature cannot be themed to the tokens, then restrict own widgets to the marks that can (bar, line, point, area, rect, text, tick) and tell the agent so in the MCP tool description.
- `/compact` in `claude -p --resume` mode: if it works, show the menu entry; if not, hide it and offer "Session-ID kopieren".
- Rate-limit usage in stream-json: if present, show the "Abo" line; if not, omit it.
- Cache hit across `claude -p --resume` calls: if the usage shows no `cache_read_input_tokens` despite a warm cache, treat the cache as cold after every call (chip always "Cache abgelaufen" after TTL 0) and tell Tim.
