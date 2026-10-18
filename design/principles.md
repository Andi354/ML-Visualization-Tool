# Design principles

The ML Visualization Tool is a dark, calm workbench for looking at results of ds-init projects.
Tokens live in `tokens.json`; this file says how to use them.

## Colour carries meaning
- Everything is slate grey (`bg`, `surface`, `raised`, `line`, `text`, `text-2`, `text-3`) unless it
  means something.
- `accent` = selection, focus, active controls. `best` = best value. `error` = failed cells.
  `warn` = comparability problem (mixed epochs, metric families, horizons) and a run that stalls.
  `note` = Tim's own notes, nothing else (warm, never for problems). A running recording (voice input)
  uses `error` red with a pulse, the common sign for "recording". Never use these for decoration.
- Meaning never by colour alone: the best value also gets the tag "Bestwert", errors a count,
  warnings a sentence.
- Chart series take `series` in fixed order, assigned by entity, never by rank; a series keeps its
  colour when filters remove others. More than six series → "Other" or small multiples.
- Effects (better / worse than a reference) use the diverging pair: lower error `#1FA3A3`, higher
  `#C47F14`.

## Type and numbers
- IBM Plex Sans for UI text (13 px base), IBM Plex Mono for config keys, values, numbers and paths.
- German decimal comma and a thin space as thousands separator (`412,8`, `222 264`).
- Interface language German; code and docs English.

## Density
- Everything at a glance, no detail overload: table rows about 34 px, 8 px cell padding, 24 px gutter,
  radii 4 px (controls) and 6 px (panels).
- Secondary information folds away (constants, config blocks, timeline strip) instead of being cut.

## Project-agnostic
- The tool knows nothing about a project. Axes, replicates, metrics (direction, family), channels,
  epochs and Lauf-Merkmale come from the project's files (`project.yaml`, `epochs.yaml`, `meta.json`,
  resolved configs).
- Numbers from different epochs or metric families are never compared silently; the guard shows a
  `warn` banner.

## Widgets
- Analysis (E, G) and detail (F) are built from widgets; a widget answers one question, declares its
  scope (one combination, one run, two runs, all runs) and has a few settings.
- A board is a description (scope, runs, widgets with settings, width half / full, order) that the
  tool renders; Tim and the agent create boards the same way. A template is a board without runs.
- Own widgets are descriptions too (Vega-Lite), never code; the tool's theme draws them, so they look
  like built-in widgets.
- Every widget can be saved as an image: title = key statement from the data (editable), grey hints
  (subtitle, note) and footer (run, epoch, commit) can be switched off. Exports default to the light
  export palette.

## Frame
- Icon bar left for the areas, tabs on top for open runs, one tool instance per project.
- Panels open beside the content and shrink it; layouts never wrap below each other (wide tables
  scroll horizontally). Exception: the agent window floats above the content (movable, minimisable)
  so no view loses width.

## Agent
- The agent uses the same actions as the interface, through the tool's own tools; it has no other way
  to change anything.
- Every action of the agent is visible in the chat and can be undone; the mode (Direkt, Gemischt,
  Bestätigen) decides what needs confirmation, the tool enforces it.
- No hidden token cost: context and cache state are always visible, and a message that would re-read a
  large cold chat is held back before anything is sent. The tool never calls the agent on its own.
