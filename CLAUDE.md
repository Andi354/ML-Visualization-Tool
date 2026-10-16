# ML Visualization Tool

Local results tool for data science projects set up with ds-init: runs, experiments, comparisons
and deliverables, read directly from the Parquet run folders (`runs/`). Everything project-specific
comes from the project's own files (`project.yaml`, `epochs.yaml`, `meta.json`), not from the tool.
First case: repnet-bench (REP-Net on Snowflake VM usage data).

Language: chat and Linear in German, code and docs in English.

## Commands

- `make setup`: Python venv (`.venv`, uv) and `npm ci` in `web/`
- `make test`: unit tests (`pytest`, `vitest`)
- `make test-browser`: builds the frontend, then browser tests (Playwright, headless Chromium)
- `make wheel`: builds `dist/ml_visualization_tool-<version>-py3-none-any.whl` (committed, one file, the previous build is removed)
- `docker compose up --build`: runs the tool for the project in `MLVIZ_PROJECT_PATH` (see `.env.example`)
- `make run PROJECT=<path>`: runs the tool without Docker, equal to the line above: own venv `.venv-run` with `ds-store` and the wheel from `dist/`, then `mlviz serve` (port: `MLVIZ_PORT`, default 8765); `make check-run` tests this way end to end
- `.venv/bin/mlviz demo <dir>`: writes a synthetic demo project
- `ds-store` (reads the runs) is not in this repo: it sits next to it in `../ds-store` (`make setup` installs it, `DS_STORE=` overrides the path; the image builds it in)

## Layout

- `src/mlviz/`: backend (FastAPI), reads `runs/` through `ds-store` (`store.py`); `web/`: frontend (Vite, Preact, TypeScript)
- `tests/`: pytest (`tests/browser/` = Playwright); `web/tests/`: vitest
- `docs/technical-reference.md`: what the tool reads from a project and how the code is organised
- `design/`: principles, tokens, `updates/v<version>-<shortname>/` (spec, prototype)
- Version: `pyproject.toml` (and `src/mlviz/__init__.py`)

# Skills

> Diese Sektion bündelt projektspezifische Konfiguration für Skills, die sie
> brauchen. Jede Subsection gehört genau einem Skill; er liest nur seinen
> eigenen Abschnitt. Neue Skills fügen bei Bedarf einfach eine eigene
> Subsection hinzu, ohne bestehende anzufassen.

## job-linear

Dieser Abschnitt gehört zum Skill `job-linear` und wird von ihm gelesen.

- Linear-Projekt: ML Visualization Tool
- Linear-Team: Tim Andert

## sw-cycle

Dieser Abschnitt gehört zum Skill `sw-cycle` und wird von ihm gelesen.

- Version: steht in `VERSION`, bis ein Paket-Manifest (z.B. `pyproject.toml`) existiert; danach dort. Seit v0.1.0 in `pyproject.toml`.
