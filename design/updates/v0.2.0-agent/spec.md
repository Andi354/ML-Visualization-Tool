# v0.2.0 · Agent

Issue: TIM-88 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.2 · Agent"
Prototype: prototype/Prototyp.dc.html · Builds on: v0.1.0

## State

| Block | Status |
|---|---|
| A · Agent panel | decided |
| B · Voice | moved to a later update (not included) |
| C · Tool control | running |
| D · Analysis by agent | open |
| E · Widget format | open |
| F · Agent connection | open |

Running block: C · Tool control. Tim: like Claude Code, all three as modes switchable in the chat,
undo everywhere. On the canvas: C1 Direkt, C2 Gemischt, C3 Bestätigen (same example chat per mode,
mode switch bottom left). Open: default mode, whether the mode is per chat or global, tool list
(proposed in chat: search, navigate, view settings, change analysis, save). Notes from Tim for later
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

## Changes to principles.md / tokens.json

## Out of scope
- Voice input (feature B, later update); only the disabled microphone button is in v0.2.

## Open
