# Technical reference

Lasting knowledge about the code. Keep it in the same commit as the code it describes.

## What the tool reads

The tool knows nothing about a project except these files. Every reader tolerates missing keys.

| File | Content used |
|---|---|
| `project.yaml` | `name`, `short` (badge, 2 letters), `paths` (`runs`, `analyses`, `deliverables`, `reports`, `configs`), `metrics` (`key`, `label`, `direction`, `family`, optional `unit` and `scale`: the stored value times `scale` is shown with `unit`, e.g. a MAPE stored as a share with `scale: 100`, `unit: "%"`), `primary_metric`, `own_model` |
| `epochs.yaml` | `epochs: [{name, since, description}]` |
| `runs/<timestamp>_<experiment>/meta.json` | `experiment`, `issue`, `started`, `ended` (null = running), `axes`, `replicates`, `primary_metric`, `epoch`, `migrated`, `commit`, `plan.cells`, `counts` |
| `.../config.yaml` | resolved config: blocks `data`, `model`, `train`, `sweep`, `replicates`, `run`, `report` |
| `.../cells.parquet` | one row per cell: `cell_id`, axis columns (text; lists as JSON, paired axes as one label column), replicate columns, `status` (`ok`/`error`), `duration_s`, metric columns |
| `.../channels.parquet` | cell x channel: `cell_id`, `channel`, metric columns |
| `.../plan.parquet` | planned cells (axis and replicate values) |
| `.../curves/<cell_id>.parquet` | `shuffle_seed`, `cv_fold`, `epoch`, `train_loss`, `val_loss` (optional) |
| `.../predictions/<cell_id>.parquet` | `shuffle_seed`, `cv_fold`, `channel`, `origin` (optional), `date`, `actual`, `prediction` (optional) |

The format of `curves/` and `predictions/` is an assumption (no real run has them yet, see the spec,
"Open"). It is checked against the first real runs.

Run folders are named `<YYYY-MM-DD_HHMM[SS]>_<experiment>` (a timestamp suffix is accepted too). The
experiment name is `meta.json: experiment`, else the folder name without the timestamp; the issue is
`meta.json: issue`, else the prefix of the experiment name (`TIM-52_best_30` -> `TIM-52`).

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
| `GET /api/issues` | per issue ID found in the runs: title, status, URL (with key), report and deliverable path |

## Experiment table

`aggregate.run_table` builds the group table: groups are the combinations of the *split* dimensions
(axes split by default, replicates and channel averaged by default); metrics are mean, sd (n-1), min and
max over the successful cells of a group, `n` counts only those, `errors` the failed cells. A group
with only failed cells stays in the table with empty metrics and sorts last in both directions. Sorting
and the best value (by the metric's `direction`) run over all groups before the first 200 are returned.
Channel "je Kanal" and a channel selection read `channels.parquet`; a selection without splitting
averages the selected channels per cell first. The overview cards use mean and sd over the cells with
that value under the current filters; the histogram counts the group means.

## Config view

`configview.run_config` takes the resolved `config.yaml` and, for a combination, sets the swept keys
to the combination's values (the value of a label is found by its position in the grid order, which
equals the order in `sweep:`). The base config is the merge of the `base:` files of the run's source
config (`meta.json: config`); migrated runs have none, so nothing is marked as differing from base. An
entry differs when the base has the key with another value. The frontend (`web/src/config/`) renders
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

Detail widgets read `curves/` and `predictions/` of the cells of the combination (the first fold only).
`predictions` windows: with an `origin` column the stored window nearest to the requested date is
plotted, else a `pred_len` slice of the test period; the default is the last window.

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

## Code

- `src/mlviz/project.py`: `Project` (project files, clock). `MLVIZ_NOW` fixes the clock for tests.
- `src/mlviz/runs.py`: `Run` (lazy, cached by mtime), `list_runs`, `get_run`. Run ids never leave `runs/`.
- `src/mlviz/aggregate.py`: dimensions, constants and group table of one run (feature D).
- `web/src/experiment/`: experiment view; `model.ts` holds the pure logic (dimension state, chips, columns, formatting).
- `src/mlviz/configview.py`, `web/src/config/`: config view (feature J).
- `src/mlviz/widgets/`: catalog and data of the widgets; `web/src/widgets/`: board model, tiles, renderers; `web/src/experiment/DetailPanel.tsx`: detail panel (feature F).
- `src/mlviz/deliverables.py`, `web/src/analysis/`, `web/src/widgets/ExportCard.tsx`: saving widget images (feature G).
- `src/mlviz/widgets/runscope.py`: the widgets of one run.
- `src/mlviz/listing.py`: facts for the run list (counts, best value, Lauf-Merkmal).
- `src/mlviz/linear.py`: Linear client and local issue links.
- `web/src/runs/model.ts`: pure logic of the Läufe area (filters, blocks, texts, timeline); components next to it.
- `src/mlviz/server.py`: FastAPI app, `/api/...`, serves `src/mlviz/static` (the built frontend).
- `src/mlviz/fixture.py`: synthetic demo project (`mlviz demo`), the base of all tests.
- `web/src/state/frame.ts`: frame state (areas, tabs). Stored per project in `localStorage`
  (`mlviz:v1:<project>:...`), every access guarded.
- `web/src/tokens.css` is generated from `design/tokens.json` (`npm run tokens`); never edit it.
