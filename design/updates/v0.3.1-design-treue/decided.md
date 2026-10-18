# v0.3.1 · Design-Treue: decided without design

What differs from the overall prototype on purpose, and what had to be decided because the prototype
does not show it. Nothing here changes behaviour of v0.3.0.

## Stays different on purpose

- **Widget header and config title** (v0.2.4, TIM-97): the prototype already shows the header line above
  the card ("Vergleichstabelle · Welcher Wert …") and the title block of the config widget. They belong to
  v0.2.4 and are not touched.
- **"Widgets · 5 von 5" instead of "+ Widget"** in the analysis header: the prototype's "+ Widget" adds a
  widget from the catalogue (v0.2.4); v0.3.0 has the visibility menu, which stays. Its look follows the
  prototype's ghost button.
- **Run select and pair choice in the analysis header:** the prototype writes the run name as plain text and
  offers pair presets ("TIM-52 · 30 gegen 90") for two runs. The tool needs a select for the run (and A / B);
  pair presets are a new function. The select keeps the tool's look.
- **Widget settings keep their selects** ("Zeilen", "Spalten je", "Metrik", …) where the options are the
  axes of the run, so their number is not fixed. Segmented controls stay segmented controls (Breite,
  Modus, Sortierung). The prototype shows a segmented control for rows and columns because its sample
  data has three axes.
- **Header buttons of the run tab** ("Vergleichen mit …", "Analysieren") stay: they are functions of v0.2.
  The prototype's toggle "mit Beschreibung · mit Problemen · ohne" is a prototype-only switch.
- **Key names:** the tool writes "Ctrl+P" where the prototype writes "Strg+P" (text, not look).
- **Palette texts:** the placeholder "Lauf suchen, > Befehl, @ Einstellung, ? Hilfe" and the labels of the
  commands stay as v0.3.0 has them; issue rows show the ID only because the palette has no issue titles.
- **Agent capsule line** reads "Agent · bereit" like the prototype's status bar; the prototype's longer
  sample texts ("Agent · Tab geöffnet · …") are made up.
- **The prototype's made-up numbers and texts** are never taken over.

## Decided because the prototype has no model

- **Window position:** the agent window opens 24 px above the status bar (the prototype is 18 px).
  Before, the bounds included the status bar and the window covered it. The test says 24 px above the
  status bar now.
- **Analysis side space:** 28 px (the prototype's value, no token); run list 32 px; run view 24 px.
- **Tab width:** tabs take their natural width (maximum 260 px) with a 1 px divider, as in the prototype;
  before, they had a fixed basis of 200 px.
- **Sort arrow** in the groups table is "↑" / "↓" like the prototype (was "▲" / "▼").
- **Metric columns** of the groups table are right-aligned like the prototype (were left-aligned).
- **Widget tables** (analysis) are centred with 9 px cell padding and a header row in the raised colour,
  like the prototype's compare table. This also changes the exported images (the light theme follows the
  same table).
- **Notes column:** width 300 px and colour `#12100B` from the overall prototype; the cards, the "+ zum
  Lauf" pill, markers and the agent proposal follow `E2-Rand`. The hint line at the end of the column is the
  prototype's text. "+ Notiz" at a description section is still shown on hover only (it was so in v0.3.0).
- **Values without a token** are taken as they are: `#12100B`, `#22345A`, `#2F5BD3`, `#E5484D`, `#3FB68B`,
  `#6B7385`, `#8F7A52`, `#C9A86A`, `#8FB0F5`, and the 32 / 28 px side spaces.
- **Recording bar:** the level meter shows the real level (the prototype animates sample bars); "Abbrechen"
  is a button now and does what Esc does.
- **Review box:** "Enter" on "Senden" shows the key that v0.3.0 already uses.
- **Preset menu** in the settings is a pill menu with a list below it (was a select), as in the prototype.
- **Size slider** in the settings is a range input with − and +; a drag shows the value at once and saves
  when it is released.
- **Status bar:** the stalled-run warning is its own button next to the runs button (it opens the same
  popover), as in the prototype.
- **Palette:** group names (zuletzt geöffnet, Issues, zuletzt verwendet, weitere Befehle) are hints at the
  right of the first row of a group with a line above it, not headings.

## Compared and found equal

- Config blocks and YAML view (`J1-Bloecke`, `J4-YAML`) of the config widget; the overview strip and the
  left rail of the run tab.
