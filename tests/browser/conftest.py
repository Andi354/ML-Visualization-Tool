"""Fixtures for the browser tests: the real app on a free port, served from the demo project."""

import contextlib
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
    # a fake microphone that is always allowed (the voice input tests)
    args["args"] = [*args.get("args", []), "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
    if found and os.environ.get("MLVIZ_CHROMIUM", "auto") != "playwright":
        args["executable_path"] = found[-1]
    return args


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@contextlib.contextmanager
def serve(project_root):
    with serve_app(project_root) as (url, _app):
        yield url


@contextlib.contextmanager
def serve_app(project_root):
    """Like `serve`, and also gives the app (a test can reach `app.state`)."""
    assert (STATIC / "index.html").exists(), "run `npm run build` in web/ first"
    port = _free_port()
    app = create_app(project_root)
    server = uvicorn.Server(uvicorn.Config(app, port=port, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(100):
        if server.started:
            break
        time.sleep(0.05)
    try:
        yield f"http://127.0.0.1:{port}", app
    finally:
        server.should_exit = True
        thread.join(timeout=5)


@pytest.fixture(scope="session")
def app_url(demo_project):
    with serve(demo_project) as url:
        yield url


@pytest.fixture(scope="session")
def writable(tmp_path_factory):
    """The app on its own copy of the demo project, for tests that write deliverables."""
    from mlviz.fixture import make_project

    root = make_project(tmp_path_factory.mktemp("writable"))
    with serve(root) as url:
        yield {"url": url, "root": root}


@pytest.fixture
def writable_page(page, writable):
    _fresh(page, writable["url"])
    page.writable_root = writable["root"]
    return page


@pytest.fixture(scope="session")
def empty_url(tmp_path_factory):
    with serve(tmp_path_factory.mktemp("empty")) as url:
        yield url


@pytest.fixture(scope="session")
def linear_url(demo_project):
    """The app with a (fake) Linear key: issue titles and status come from a stub."""
    from mlviz import linear

    titles = {
        "TIM-52": ("Beste Config zusammenführen", "In Progress", "started"),
        "TIM-45": ("G6 kombiniert testen", "In Review", "started"),
        "TIM-83": ("Läuft gerade", "Todo", "unstarted"),
        "TIM-71": ("Beispiel", "Done", "completed"),
        "TIM-39": ("Grid mit Lücken", "Todo", "unstarted"),
        "TIM-30": ("Baselines", "Done", "completed"),
    }

    def fake(ids, key, client=None):
        return {
            i: {"title": t, "status": s, "status_type": ty, "url": f"https://linear.example/{i}"}
            for i, (t, s, ty) in titles.items()
            if i in ids
        }

    mp = pytest.MonkeyPatch()
    mp.setenv("LINEAR_API_KEY", "fake")
    mp.setattr(linear, "fetch_linear", fake)
    try:
        with serve(demo_project) as url:
            yield url
    finally:
        mp.undo()


def _fresh(page, url):  # noqa: E302
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(url)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.get_by_test_id("project-badge").wait_for()
    return page


@pytest.fixture
def page(page, app_url):
    return _fresh(page, app_url)


@pytest.fixture
def empty_page(page, empty_url):
    return _fresh(page, empty_url)


@pytest.fixture
def linear_page(page, linear_url):
    return _fresh(page, linear_url)


@pytest.fixture
def agent_page(page, tmp_path):
    """The app on a project of its own with no runs, so chats written by a test stay with it."""
    with serve(tmp_path) as url:
        yield _fresh(page, url)
