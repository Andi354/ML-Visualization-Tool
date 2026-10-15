"""Fixtures for the browser tests: the real app on a free port, served from the demo project."""

import glob
import os
import socket
import threading
import time
from pathlib import Path

import pytest
import uvicorn

from mlviz.server import STATIC, create_app


def pytest_collection_modifyitems(items):
    for item in items:
        if "tests/browser" in str(item.fspath).replace("\\", "/"):
            item.add_marker(pytest.mark.browser)


@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args):
    """Use the Chromium that is already installed (PLAYWRIGHT_BROWSERS_PATH) when the Python
    Playwright expects a different build number."""
    base = os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "")
    found = sorted(glob.glob(os.path.join(base, "chromium-*", "chrome-linux", "chrome")))
    args = dict(browser_type_launch_args)
    if found and os.environ.get("MLVIZ_CHROMIUM", "auto") != "playwright":
        args["executable_path"] = found[-1]
    return args


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def app_url(demo_project):
    assert (STATIC / "index.html").exists(), "run `npm run build` in web/ first"
    port = _free_port()
    server = uvicorn.Server(uvicorn.Config(create_app(demo_project), port=port, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(100):
        if server.started:
            break
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=5)


@pytest.fixture
def page(page, app_url):
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(app_url)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.get_by_test_id("project-badge").wait_for()
    return page
