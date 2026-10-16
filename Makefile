.PHONY: setup web test test-web test-browser build wheel

setup:
	uv venv .venv && uv pip install -p .venv/bin/python vendor/ds_store-*.whl && uv pip install -p .venv/bin/python -e ".[dev]"
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
