.PHONY: setup web test test-web test-browser build wheel

# ds-store lives next to this repo (it is not on an index); override with DS_STORE=/path/to/ds-store
DS_STORE ?= ../ds-store

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
