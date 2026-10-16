"""Checks that the tool starts without Docker: `make run-install` into a temporary venv, serve a demo
project, ask the API and the frontend. Used by `make check-run`; exits non-zero when something fails."""

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def get(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=5) as r:
        return r.read()


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        venv = Path(tmp) / "venv"
        project = Path(tmp) / "project"
        subprocess.run(["make", "-C", str(ROOT), "run-install", f"RUN_VENV={venv}"], check=True)
        subprocess.run([str(venv / "bin" / "mlviz"), "demo", str(project)], check=True, stdout=subprocess.DEVNULL)
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        proc = subprocess.Popen(
            [str(venv / "bin" / "mlviz"), "serve", "--project", str(project)],
            env={**os.environ, "MLVIZ_PORT": str(port), "MLVIZ_HOST": "127.0.0.1"},
        )
        base = f"http://127.0.0.1:{port}"
        try:
            for _ in range(100):
                try:
                    get(base + "/api/project")
                    break
                except OSError:
                    if proc.poll() is not None:
                        print("server exited early", file=sys.stderr)
                        return 1
                    time.sleep(0.1)
            else:
                print("server did not come up", file=sys.stderr)
                return 1
            runs = json.loads(get(base + "/api/runs"))
            assert isinstance(runs, list) and runs, "no runs listed"
            assert b"<div id=" in get(base + "/") or b"<html" in get(base + "/").lower(), "frontend missing"
            print(f"ok: {len(runs)} runs listed, frontend served")
            return 0
        finally:
            proc.terminate()
            proc.wait(timeout=10)


if __name__ == "__main__":
    sys.exit(main())
