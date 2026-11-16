.PHONY: setup web test test-web test-browser build wheel run run-install check-run

# ds-runstore lives next to this repo (it is not on an index); override with DS_RUNSTORE=/path/to/ds-runstore
DS_RUNSTORE ?= ../ds-runstore

# Start without Docker: a venv of its own (not the development .venv) with ds-runstore and the tool's
# wheel from dist/ (the frontend is built into it, so no Node is needed). Usage: make run PROJECT=<path>
RUN_VENV ?= .venv-run
PROJECT ?=

setup:
	uv venv .venv && uv pip install -p .venv/bin/python -e "$(DS_RUNSTORE)" && uv pip install -p .venv/bin/python -e ".[dev]"
	cd web && npm ci

web:
	cd web && npm run build

test:
	.venv/bin/python -m pytest -q
	cd web && npm test

test-browser: web
	.venv/bin/python -m pytest -m browser -q

wheel: web
	rm -f dist/*.whl
	uv build --wheel --out-dir dist

run-install:
	@ls dist/ml_visualization_tool-*.whl >/dev/null 2>&1 || { echo "no wheel in dist/ (make wheel builds it)" >&2; exit 2; }
	@test -e "$(DS_RUNSTORE)" || { echo "ds-runstore not found at $(DS_RUNSTORE) (the folder next to this repo; DS_RUNSTORE=/path overrides)" >&2; exit 2; }
	uv venv --allow-existing $(RUN_VENV)
	uv pip install -p $(RUN_VENV)/bin/python --reinstall-package ds-runstore --reinstall-package ml-visualization-tool "$(DS_RUNSTORE)" dist/ml_visualization_tool-*.whl

run:
	@test -n "$(PROJECT)" || { echo "usage: make run PROJECT=/path/to/ds-init-project  (MLVIZ_PORT, MLVIZ_HOST optional)" >&2; exit 2; }
	@test -d "$(PROJECT)" || { echo "project folder not found: $(PROJECT)" >&2; exit 2; }
	$(MAKE) run-install
	$(RUN_VENV)/bin/mlviz serve --project "$(PROJECT)"

# Checks the way without Docker: installs into a temporary venv, serves the demo project, asks the API
check-run:
	.venv/bin/python scripts/check_run.py
