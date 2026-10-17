"""The help of the agent: `agent_guide.md` split into topics, read through the tool `help`.

The file is part of the package. Its sections start with `## <key> · <title>`; the first one that explains what the
agent can and cannot do is the one to start with. `tests/test_agent_guide.py` keeps the tables of the file in step with
the tools, the modes and the rules for own widgets.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

GUIDE = Path(__file__).with_name("agent_guide.md")
_HEADING = re.compile(r"^## ([a-z0-9-]+) · (.+)$", re.MULTILINE)


@lru_cache(maxsize=1)
def sections() -> dict[str, tuple[str, str]]:
    """Topic key -> (title, text), in the order of the file."""
    text = GUIDE.read_text(encoding="utf-8")
    found = list(_HEADING.finditer(text))
    out = {}
    for i, m in enumerate(found):
        end = found[i + 1].start() if i + 1 < len(found) else len(text)
        out[m.group(1)] = (m.group(2), text[m.end():end].strip())
    return out


def index() -> str:
    lines = ["Themen der Agent-Hilfe (`help` mit dem Thema aufrufen):", ""]
    lines += [f"- `{key}`: {title}" for key, (title, _) in sections().items()]
    lines += ["", "Zum Einstieg: `faehigkeiten`."]
    return "\n".join(lines)


def read(topic: str | None) -> str:
    """The index without a topic, else the text of the topic. Raises ValueError (for the agent) on an unknown one."""
    if not topic or not str(topic).strip():
        return index()
    key = str(topic).strip().lower()
    entry = sections().get(key)
    if entry is None:
        raise ValueError(f"Kein Thema „{topic}“. Themen: {', '.join(sections())}.")
    return f"# {entry[0]}\n\n{entry[1]}"
