# Technical reference

Lasting knowledge about the code. Keep it in the same commit as the code it describes.

## What the tool reads

The tool knows nothing about a project except these files. Every reader tolerates missing keys.

| File | Content used |
|---|---|
| `project.yaml` | `name`, `short` (badge, 2 letters), `paths` (`runs`, `analyses`, `deliverables`, `reports`, `configs`), `metrics` (`key`, `label`, `direction`, `family`), `primary_metric`, `own_model` |
| `epochs.yaml` | `epochs: [{name, since, description}]` |
| `runs/<experiment>_<timestamp>/meta.json` | `experiment`, `issue`, `started`, `ended` (null = running), `axes`, `replicates`, `primary_metric`, `epoch`, `migrated`, `commit`, `plan.cells`, `counts` |
| `.../config.yaml` | resolved config: blocks `data`, `model`, `train`, `sweep`, `replicates`, `run`, `report` |
| `.../cells.parquet` | one row per cell: `cell_id`, axis columns (text; lists as JSON, paired axes as one label column), replicate columns, `status` (`ok`/`error`), `duration_s`, metric columns |
| `.../channels.parquet` | cell x channel: `cell_id`, `channel`, metric columns |
| `.../plan.parquet` | planned cells (axis and replicate values) |
| `.../curves/<cell_id>.parquet` | `shuffle_seed`, `cv_fold`, `epoch`, `train_loss`, `val_loss` (optional) |
| `.../predictions/<cell_id>.parquet` | `shuffle_seed`, `cv_fold`, `channel`, `origin` (optional), `date`, `actual`, `prediction` (optional) |

The format of `curves/` and `predictions/` is an assumption (no real run has them yet, see the spec,
"Open"). It is checked against the first real runs.

## Code

- `src/mlviz/project.py`: `Project` (project files, clock). `MLVIZ_NOW` fixes the clock for tests.
- `src/mlviz/runs.py`: `Run` (lazy, cached by mtime), `list_runs`, `get_run`. Run ids never leave `runs/`.
- `src/mlviz/server.py`: FastAPI app, `/api/...`, serves `src/mlviz/static` (the built frontend).
- `src/mlviz/fixture.py`: synthetic demo project (`mlviz demo`), the base of all tests.
- `web/src/state/frame.ts`: frame state (areas, tabs). Stored per project in `localStorage`
  (`mlviz:v1:<project>:...`), every access guarded.
- `web/src/tokens.css` is generated from `design/tokens.json` (`npm run tokens`); never edit it.
