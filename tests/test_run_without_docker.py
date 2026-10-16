"""The way to start the tool without Docker: `make run PROJECT=<path>` and `mlviz serve`.

`make check-run` goes the whole way (temporary venv, install, serve, ask); these tests keep the parts
that need no network: what `make run` would do, how it refuses, and that `mlviz serve` answers."""

import json
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def make(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["make", "-C", str(ROOT), *args], capture_output=True, text=True)


def test_make_run_installs_ds_store_and_the_wheel_into_its_own_venv_and_serves(tmp_path):
    out = make("-n", "run", f"PROJECT={tmp_path}", "DS_STORE=/some/ds-store").stdout
    assert "uv venv --allow-existing .venv-run" in out
    assert "/some/ds-store" in out and "dist/ml_visualization_tool-*.whl" in out
    assert f".venv-run/bin/mlviz serve --project \"{tmp_path}\"" in out
    assert ".venv/bin" not in out.replace(".venv-run/bin", "")  # the development venv is left alone


def test_make_run_needs_a_project():
    r = make("run")
    assert r.returncode != 0 and "make run PROJECT=" in r.stderr


def test_make_run_refuses_a_project_folder_that_does_not_exist(tmp_path):
    r = make("run", f"PROJECT={tmp_path / 'nope'}")
    assert r.returncode != 0 and "project folder not found" in r.stderr


def test_make_run_install_says_where_it_looked_for_ds_store(tmp_path):
    r = make("run-install", f"DS_STORE={tmp_path / 'missing'}")
    assert r.returncode != 0 and "ds-store not found" in r.stderr and "DS_STORE=" in r.stderr


def test_mlviz_serve_answers_without_docker(demo_project):
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    proc = subprocess.Popen(
        [sys.executable, "-m", "mlviz.cli", "serve", "--project", str(demo_project), "--port", str(port)],
        env={"PYTHONPATH": str(ROOT / "src"), "PATH": "/usr/bin:/bin", "MLVIZ_NOW": "2026-10-15T12:00:00"},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(100):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/project", timeout=2) as r:
                    assert json.load(r)["name"] == "Demo Bench"
                break
            except OSError:
                assert proc.poll() is None, "the server exited"
                time.sleep(0.1)
        else:
            raise AssertionError("the server did not come up")
    finally:
        proc.terminate()
        proc.wait(timeout=10)
