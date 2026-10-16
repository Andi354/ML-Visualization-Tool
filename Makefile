.PHONY: setup web test test-web test-browser build wheel run run-install check-run

# ds-store lives next to this repo (it is not on an index); override with DS_STORE=/path/to/ds-store
DS_STORE ?= ../ds-store

# Start without Docker: a venv of its own (not the development .venv) with ds-store and the tool's
# wheel from dist/ (the frontend is built into it, so no Node is needed). Usage: make run PROJECT=<path>
RUN_VENV ?= .venv-run
PROJECT ?=

setup:
	uv venv .venv && uv pip install -p .venv/bin/python -e "$(DS_STORE)" && uv pip install -p .venv/bin/python -e ".[dev]"
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
	@test -e "$(DS_STORE)" || { echo "ds-store not found at $(DS_STORE) (the folder next to this repo; DS_STORE=/path overrides)" >&2; exit 2; }
	uv venv --allow-existing $(RUN_VENV)
	uv pip install -p $(RUN_VENV)/bin/python --reinstall-package ds-store --reinstall-package ml-visualization-tool "$(DS_STORE)" dist/ml_visualization_tool-*.whl

run:
	@test -n "$(PROJECT)" || { echo "usage: make run PROJECT=/path/to/ds-init-project  (MLVIZ_PORT, MLVIZ_HOST optional)" >&2; exit 2; }
	@test -d "$(PROJECT)" || { echo "project folder not found: $(PROJECT)" >&2; exit 2; }
	$(MAKE) run-install
	$(RUN_VENV)/bin/mlviz serve --project "$(PROJECT)"

# Checks the way without Docker: installs into a temporary venv, serves the demo project, asks the API
check-run:
	.venv/bin/python scripts/check_run.py
