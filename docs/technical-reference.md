# Technical reference

Lasting knowledge about the code. Keep it in the same commit as the code it describes.

## What the tool reads

The tool knows nothing about a project except these files. Every reader tolerates missing keys.

| File | Content used |
|---|---|
| `project.yaml` | `name`, `paths` (`runs`, `configs`), `outputs` (`analysis`, `research`, `deliverables`; `reports` is derived from `analysis`), `metrics: {primary: <key>, catalog: {<key>: {direction, viz: {family: scaled\|real}, label, unit, scale}}}` (`label`, `unit`, `scale` optional: the stored value times `scale` is shown with `unit`, e.g. a MAPE stored as a share with `scale: 100`, `unit: "%"`), `viz` (`short` = badge, 2 letters; `own_model`). Earlier forms still read: `metrics` as a list of entries with `key` plus a top-level `primary_metric`, flat `paths.analyses`, top-level `short`, `own_model`, metric `family` |
| `epochs.yaml` | a list at the top level of `{name, repo, commit, date, reason}`, shown as `name`, `since` (= `date`), `description` (= `reason`), `repo`, `commit`; the earlier form `epochs: [{name, since, description}]` still reads |
| `runs/<YYYY-MM-DD_HHMM>_<name>/meta.json` | `name`, `store_version`, `issue`, `config`, `started_at`, `ended_at`, `axes`, `replicates`, `primary_metric`, `epoch`, `commit`, `plan: {cells, excluded, duplicates}`, `counts` (final tally, not used for progress); `migrated: true` marks converted runs |
| `.../config.yaml` | resolved config: blocks `data`, `model`, `train`, `sweep`, `replicates`, `run`, `report` |
| `.../config.base.yaml` | the merged base configs as they were at the start of the run (missing for migrated runs) |
| tables, through `ds-store` | `plan`: `row`, `cell_id`, `duplicate_of`, axes, replicates. `cells`: one row per planned cell, those plus `is_duplicate`, `status` (`ok`/`error`), `error`, `duration_s`, `finished_at`, `shard`, metric columns. `channels`: cell x channel (`cell_id`, `channel`, metric columns). `curves`: `cell_id`, `epoch`, `metric` (`train_loss`, `val_loss`), `value`. `predictions`: `cell_id`, `date`, `channel`, `y_pred`, `y_true` (whole test period) |

**Run tables are read only through `ds-store`** (`read_table`, `list_runs`, `run_status`,
`table_version`), wrapped in `store.py`; the tool has no reader of its own and never opens a table file.
`ds-store` is a package of its own (not on an index) and lives next to this repo in `../ds-store`:
`make setup` installs it from there (`DS_STORE=` overrides the path), the Dockerfile builds it from the
build context `ds-store` (docker-compose.yml passes `DS_STORE_PATH`, default `../ds-store`; plain docker:
`--build-context ds-store=../ds-store`), so the image contains it and the container needs no sibling
folder. Installing the tool's wheel elsewhere needs ds-store installed first (`pip install ../ds-store
dist/ml_visualization_tool-*.whl`). Axis values are text
(lists as JSON, paired axes as one label column). `curves` and `predictions` exist once per `cell_id`
and carry no replicate columns (`read_table(..., with_cells=True)` adds them). A duplicate cell
(`is_duplicate`) has the values of its original and shares its `cell_id`, so `channels` are tied to
`cells` by `row` (`aggregate.join_cells`), never by `cell_id`. A missing table reads as empty (the
wrapper returns None); derived cells (`forecaster: hybrid`) leave `ensemble_*` axes empty on all other
cells, and an empty axis value is a value of its own. The package sorts `channels` by name, so regions
appear alphabetically, not in model order. Caches are keyed by `table_version` (and `meta.json`), so a
running experiment shows up as it writes. Errors from the package (`UnsupportedStoreVersion`) become
`StoreError`; without the package installed the API answers 409 and the run list shows that `ds-store`
is missing.

State and progress are `run_status`: `finished` (`ended_at` set), `running` (something written within 15
minutes) or `stalled` (a crash, or one very long cell); `planned` is None for runs without `plan.parquet`.
The run list shows a stalled run as unfinished with the flag "steht still". `list_runs` lists a run written
by a newer package with `state: "unsupported"` and a `message`: the run list shows it with the flag
"nicht lesbar" (the message as tooltip) and no numbers, the project widgets leave it out, and its own
views answer 409 with the message. The status is cached for 30 seconds (the clock moves running to stalled).

Run folders are named `<YYYY-MM-DD_HHMM>_<name>` (older layouts with seconds or a timestamp suffix are
accepted too). The run name is `meta.json: name`, else the folder name without the timestamp; the issue is
`meta.json: issue`, else the prefix of the name (`TIM-52_best_30` -> `TIM-52`).

**Content that is present but in no known form is a warning, not silence:** a `metrics:` or `epochs.yaml` of
an unknown shape, an entry without `name` or `key`, a primary metric outside the catalogue, a file that
does not parse. `Project.warnings` goes to the log, to `/api/project` (`warnings`) and to a notice at the top
of the frame (`project-warnings`). A file that does not exist is no warning (the defaults apply).

## Concepts

- **Lauf-Merkmal:** a config entry (`data`, `model`, `train` blocks) that is constant inside a run but has
  2 to 6 distinct values across runs (repnet-bench: `data.pred_len`). Swept and replicate keys never
  count. `listing.merkmal_candidates` finds them; the first one labels the best value in the run list
  and colours the timeline. Where the default is configured is open (spec).
- **Best value of a run:** the best group mean (replicates averaged over the swept axes) of the first
  `real` metric of the catalogue, over successful cells only (`listing.group_best`).
- **Issue links:** `analysis/<ISSUE>_*` is the report; a deliverable folder belongs to an issue when its
  name contains the ID or its `README.md` mentions it. The browser cannot open folders, so the links
  copy the project-relative path.
- **Linear:** optional. `LINEAR_API_KEY` in the environment enables titles and status
  (`linear.fetch_linear`, 5 minute cache, errors give no titles).

## API

| Endpoint | Content |
|---|---|
| `GET /api/project` | project info, metric catalogue, epochs, `now`, `linear` (key present) |
| `GET /api/runs` | all runs, newest first, with counts, best value, Lauf-Merkmal |
| `GET /api/runs/{id}` | one run (404 when gone) |
| `GET /api/runs/{id}/dims` | sidebar: dimensions (axes with more than one value, replicates, channel) with value counts and section, constants of the resolved config |
| `POST /api/runs/{id}/table` | group table. Body: `dims` (`{dim: {mode: split\|agg, sel: [values]}}`), `sort` (`metric`, `stat` mean/min/max/n, `dir`), `limit` (default 200, max 1000), `overview` |
| `GET /api/runs/{id}/config?combo=` | resolved config for the config view: grid axes and replicates, blocks with entries, YAML lines with markers. `combo` is JSON `{axis: value}` and applies one combination to the resolved config |
| `GET /api/widgets/catalog?scope=` | the widget catalog: key, label, question, scopes, settings, `requires` |
| `POST /api/widgets/{key}` | data of one widget: `{run, combo, settings}` -> `{title, subtitle, note, unavailable, options, data}` |
| `GET /api/folders?path=` | sub-folders of a project folder (no `runs/`, no hidden folders), for the target picker |
| `POST /api/deliverables` | writes base64 PNGs below a project folder: `{target, files: [{name, data, title}], title, issue, runs, configs, overwrite}`; 409 with the clashing names unless `overwrite` |
| `GET /api/agent` | chats of the project (newest first, without messages), the mode of the agent (`direct`, `mixed`, `confirm`) and `now`, the clock of the tool (the cache display counts from it) |
| `POST /api/agent/chats` | a new empty chat (`Neuer Chat`) |
| `GET /api/agent/chats/{id}` | one chat with its messages (404 for an unknown or malformed id) |
| `POST /api/agent/chats/{id}/messages` | appends a message of the user, `{text}` (empty text is a 400); the first one names a new chat |
| `GET /api/own-widgets?scope=` | own widgets kept in the project as catalog entries (`key` `own:<slug>`, `settings` from the params, `width`, `own: true`) with their `definition` |
| `POST /api/own-widgets` | keeps a description under its name (the same name overwrites); 400 with `detail.errors` when it is not valid |
| `POST /api/own-widgets/validate` | `{errors}` for a description, nothing is written |
| `DELETE /api/own-widgets/{slug}` | removes a kept widget (404 if there is none) |
| `PUT /api/agent/mode` | `{mode}`: Direkt, Gemischt or Bestätigen, kept per project |
| `GET /api/issues` | per issue ID found in the runs: title, status, URL (with key), report and deliverable path |

## Experiment table

`aggregate.run_table` builds the group table: groups are the combinations of the *split* dimensions
(axes split by default, replicates and channel averaged by default); metrics are mean, sd (n-1), min and
max over the successful cells of a group, `n` counts only those, `errors` the failed cells. A group
with only failed cells stays in the table with empty metrics and sorts last in both directions. Sorting
and the best value (by the metric's `direction`) run over all groups before the first 200 are returned.
Channel "je Kanal" and a channel selection read the `channels` table; a selection without splitting
averages the selected channels per cell first. The overview cards use mean and sd over the cells with
that value under the current filters; the histogram counts the group means.

## Config view

`configview.run_config` takes the resolved `config.yaml` and, for a combination, sets the swept keys
to the combination's values (the value of a label is found by its position in the grid order, which
equals the order in `sweep:`). The base config is `config.base.yaml` in the run folder, not today's
files in `configs/base/` (those are living); runs without it (migrated ones) have none, so nothing is
marked as differing from base. An entry differs when the base has the key with another value. The frontend (`web/src/config/`) renders
the same data as "Blöcke" or "YAML"; the choice is stored per project.

## Widgets and boards

A *widget* answers one question for a scope (`combination`, `run`, `two-runs`, `project`). The catalog
(`widgets/registry.py`) lists key, label, question, scopes, settings (defaults) and what the run must
provide (`curves`, `predictions`). Each widget function returns the data, a key-statement title
generated from it, a subtitle (what is compared) and a note; a widget that cannot be drawn returns
`unavailable` with the reason instead of data and cannot be saved. Dynamic setting options (channels,
combinations to compare with) come back in `options`. Numbers in titles use the German format.

A *board* (`web/src/widgets/board.ts`) is a description `{scope, widgets: [{id, type, settings}]}`; the
tool only renders it. The selection of widgets is stored per project and scope. The detail panel (F)
is a board of scope `combination`; `WidgetTile` is the tile with header, settings and figure.

Detail widgets read the `curves` and `predictions` tables for the cells of the combination (the first
fold only; the fold is chosen on `cells`). `predictions` cover the whole test period, so the window is a
`pred_len` slice starting at the requested date; the default is the last window. (A table with an
`origin` column would still plot the stored window nearest to the requested date.)

## Two runs and project history

Widgets of the scope `two-runs` take `runs: [A, B]` (A = series 1, B = series 5). Combinations are matched
by the axes both runs vary (`shared`); a combination is the group mean over replicates and over the axes
that are not shared. Comparison metric: the first `real` metric of the catalogue. Rank 1 is the best by the
metric's direction. Spearman's rho is the Pearson correlation of the average ranks (no SciPy). Scaled
metrics are left out of "Wer gewinnt wo?" when the runs have different forecasters. "Wirkung je
Parameter" calls an effect a flip when the sign differs and both effects are above 1.5 %.

Widgets of the scope `project` take `runs` (the runs picked for the parameter map; empty = finished runs
of the current epoch that vary an axis) and `params.color_by` (a Lauf-Merkmal key or `none`). The current
epoch is the last entry of `epochs.yaml`; runs of older epochs are hollow and left out of the lines.
Optional widgets (`optional: true` in the catalog) are off in a new board.

## Deliverables

`deliverables.save` writes only below the project folder: never into `runs/`, never into hidden folders,
no `..`, no absolute paths; file names are reduced to a safe form and must be unique; the data must be a
PNG. Existing files are not overwritten unless `overwrite` is set. Next to the images it writes a
`README.md` (title, `Issue: <ID>`, run folders, file list), which is also how a deliverable folder is
linked to its issue in the run list, and optionally `configs/<run>.yaml` (the resolved config).

The images are rendered in the browser: the widget is laid out at 1200 px in an `ExportCard` (theme
`light` by default, `dark` optional; `.theme-light` in `tokens.css` carries the export palette),
rasterized with `html-to-image` at pixel ratio 2 and sent as PNG. The preview in the dialog is the same
component, so it shows what is saved. Widgets that fetch their own data (config) are given preloaded
data for export.

## Combining images

In the save dialog an *image* is one file and holds one widget or, after "Zu einem Bild", several
(`web/src/analysis/images.ts`, pure functions): `combine` merges the selected images in list order into
a group at the place of the first, `split` ("Trennen") and `detach` ("lösen") undo it, `reorder` moves a
member, the layout is `stack` or `side`. A group has one title (default "A und B"), its parts show no title
of their own but their subtitle and note when "Hinweise einblenden" is on (default off for a group, on for
a single image), and one footer. Group file names are `NN_<type>+<type>.png`.

## Running the tool

Two ways, equal in rank. **Docker:** `docker compose up --build` (see `.env.example`). **Without Docker:**
`make run PROJECT=<path>` for a machine without Docker rights. It creates the venv `.venv-run` (not the
development `.venv`), installs `ds-store` from `../ds-store` (`DS_STORE=` overrides; a folder or a wheel)
and the tool's wheel from `dist/` (the frontend is built into it, so no Node is needed), then starts
`mlviz serve --project <path>` on `127.0.0.1:8765` (`MLVIZ_PORT`, `MLVIZ_HOST`). It needs `uv`, the wheel
in `dist/` and the `ds-store` folder; each missing piece stops it with a message. The tool is meant for one
person; it is not exposed in the network unless `MLVIZ_HOST` says so. `make check-run` installs into a
temporary venv, serves the demo project and asks the API and the frontend; `tests/test_run_without_docker.py`
covers what `make run` does, how it refuses, and that `mlviz serve` answers.

## Agent (v0.2)

**Window (feature A).** `web/src/agent/`: `AgentLayer.tsx` is the window and the capsule, floating in `.app` above
the content; the icon at the bottom of the icon bar opens and minimises it (`state.toggleFromIcon`). The rules of
position and size are pure (`geometry.ts`): first opening 400 × 520 px and 24 px from the bottom right corner, a
drag stays inside the area right of the icon bar and below the tab strip (4 px from the edges), the corner
resizes down to 320 × 280 px and stops at the edge, a smaller tool pushes and shrinks the window (`fit`). Open /
minimised / closed, position, size and the current chat are browser state per project
(`mlviz:v1:<project>:agent`, like the frame); the context chip says what the agent sees (`model.contextLabel`).
The microphone button is disabled until the voice update.

**Chats and settings.** `src/mlviz/agent_store.py` keeps them in `<project>/.mlviz/` (the folder is created on the
first write, nothing else is written into the project): `chats/<id>.json` (one chat = one Claude Code session:
`title`, `updated_at`, `session_id`, `tokens` of the last turn, `last_turn_at`, `cache_ttl_s`, `messages`) and
`agent.json` (the mode). Ids are 12 hex characters and are checked before any path is built. Context % and the
cache chip are computed in the browser from `tokens`, `last_turn_at` and `cache_ttl_s` against the clock of the
tool (`model.contextUse`, `model.cacheState`), never by asking the agent. `.mlviz/` can be committed (templates and
own widgets will live there too) or put into the project's `.gitignore`.

## Widget width, order and own widgets (v0.2)

**Width and order.** Every tile has a width, `half` or `full` (a full tile starts a new row; catalog default:
the comparison table is full, all others half) and a position; the arrows ↑ ↓ in the tile header move it one place,
"Einstellen" has "Breite Halb | Ganz". Both are part of the board (`web/src/widgets/board.ts`, stored per project and
scope, so templates can carry them). Boards stored before widths existed take the default width of their type.

**Own widgets (feature E).** A widget the agent writes is a description, not code: Vega-Lite with a thin wrapper
(`own_widgets.py`; the fields are listed in its docstring). `validate` refuses what the tool cannot theme: colours
and fonts (the theme draws them from the tokens, `web/src/widgets/own-theme.ts`), `data`/`datasets`/`config`, and any
mark but bar, line, point, area, rect, text, tick. `{{param.<name>}}` in `filter` values and in any string of the
spec is replaced by the value of the param. The datasets (`own_data.py`: `cells`, `channels`, `curves`,
`predictions`, `runs`) are aggregated over the replicates and keyed by the axes; `filter` is a mapping column -> value
(or list); a row cap (20 000) asks for a narrower filter. A kept widget is `<project>/.mlviz/widgets/<slug>.json`;
`own:<slug>` goes through `/api/widgets/{key}` like a built-in widget (so the save dialog and templates need no
special case), `own-draft` takes the description in the request. A description that cannot be drawn gives
`unavailable: "Widget kann nicht gezeichnet werden: <reason>"` (the agent sees the same text). The frontend loads
Vega when the first own widget is drawn (`OwnChart`, SVG renderer); it marks itself `data-pending` while drawing and
the image export waits for that (`settle`).

**Draft.** A draft is part of the board (`board.draft`, in the browser like the rest of the board): the first row, the
tile at its own width, "Beschreibung" (read-only JSON), "Verwerfen", "Behalten" (saves the widget and makes a tile of it
at the position of the draft). Only one draft per board; a new one replaces it. The agent creates drafts through the
tools of feature C.

## Code

- `src/mlviz/project.py`: `Project` (project files, clock). `MLVIZ_NOW` fixes the clock for tests.
- `src/mlviz/store.py`: the only reader of run tables (wraps `ds-store`, caches by `table_version`).
- `src/mlviz/runs.py`: `Run` (meta, config, tables and state through `store.py`), `list_runs`, `get_run`. Run ids never leave `runs/`.
- `src/mlviz/aggregate.py`: dimensions, constants and group table of one run (feature D).
- `web/src/experiment/`: experiment view; `model.ts` holds the pure logic (dimension state, chips, columns, formatting).
- `src/mlviz/configview.py`, `web/src/config/`: config view (feature J).
- `src/mlviz/widgets/`: catalog and data of the widgets; `web/src/widgets/`: board model, tiles, renderers; `web/src/experiment/DetailPanel.tsx`: detail panel (feature F).
- `src/mlviz/deliverables.py`, `web/src/analysis/`, `web/src/widgets/ExportCard.tsx`: saving widget images (feature G).
- `src/mlviz/widgets/compare.py`, `project.py`: widgets of two runs and of the project; `web/src/widgets/renderers-compare.tsx`, `web/src/views/AnalysisView.tsx`, `web/src/analysis/BoardPage.tsx`: their boards.
- `src/mlviz/widgets/runscope.py`: the widgets of one run.
- `src/mlviz/listing.py`: facts for the run list (counts, best value, Lauf-Merkmal).
- `src/mlviz/linear.py`: Linear client and local issue links.
- `web/src/runs/model.ts`: pure logic of the Läufe area (filters, blocks, texts, timeline); components next to it.
- `src/mlviz/server.py`: FastAPI app, `/api/...`, serves `src/mlviz/static` (the built frontend).
- `src/mlviz/fixture.py`: synthetic demo project in the run format, written with the writers of `ds-store` (`mlviz demo`), the base of all tests. The package's `write_example_run` (8 cells) is too small for the views; `tests/test_store.py` uses it to check that the tool reads what the package writes.
- `web/src/state/frame.ts`: frame state (areas, tabs). Stored per project in `localStorage`
  (`mlviz:v1:<project>:...`), every access guarded.
- `web/src/tokens.css` is generated from `design/tokens.json` (`npm run tokens`); never edit it.
