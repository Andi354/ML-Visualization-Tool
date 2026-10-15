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
| `GET /api/issues` | per issue ID found in the runs: title, status, URL (with key), report and deliverable path |

## Code

- `src/mlviz/project.py`: `Project` (project files, clock). `MLVIZ_NOW` fixes the clock for tests.
- `src/mlviz/runs.py`: `Run` (lazy, cached by mtime), `list_runs`, `get_run`. Run ids never leave `runs/`.
- `src/mlviz/listing.py`: facts for the run list (counts, best value, Lauf-Merkmal).
- `src/mlviz/linear.py`: Linear client and local issue links.
- `web/src/runs/model.ts`: pure logic of the Läufe area (filters, blocks, texts, timeline); components next to it.
- `src/mlviz/server.py`: FastAPI app, `/api/...`, serves `src/mlviz/static` (the built frontend).
- `src/mlviz/fixture.py`: synthetic demo project (`mlviz demo`), the base of all tests.
- `web/src/state/frame.ts`: frame state (areas, tabs). Stored per project in `localStorage`
  (`mlviz:v1:<project>:...`), every access guarded.
- `web/src/tokens.css` is generated from `design/tokens.json` (`npm run tokens`); never edit it.
