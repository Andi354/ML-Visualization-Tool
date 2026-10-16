import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

os.environ.setdefault("MLVIZ_NOW", "2026-10-15T12:00:00")
# the agent never calls the real Claude Code in tests: a stand-in answers
os.environ["MLVIZ_CLAUDE"] = f"{sys.executable} {Path(__file__).parent / 'fake_claude.py'}"
os.environ.pop("ANTHROPIC_API_KEY", None)

from mlviz.fixture import make_project  # noqa: E402


@pytest.fixture(scope="session")
def demo_project(tmp_path_factory) -> Path:
    return make_project(tmp_path_factory.mktemp("demo"))
