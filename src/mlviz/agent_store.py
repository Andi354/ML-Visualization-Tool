"""Chats and settings of the agent, stored per project in `<project>/.mlviz/`.

One chat is one Claude Code session: the tool keeps its title, last activity, the `session_id` and the
numbers behind the context and cache display (see `docs/technical-reference.md`, "Agent"). Files:

- `.mlviz/chats/<id>.json`: one chat with its messages
- `.mlviz/agent.json`: settings of the agent (the mode: `direct`, `mixed`, `confirm`)

Everything is written atomically and only below `.mlviz/` of the project folder.
"""

from __future__ import annotations

import json
import os
import re
import secrets
from pathlib import Path
from typing import Any

from .project import Project, now

STATE_DIR = ".mlviz"
MODES = ("direct", "mixed", "confirm")
DEFAULT_MODE = "mixed"
NEW_CHAT_TITLE = "Neuer Chat"
MESSAGE_KINDS = ("user", "agent", "action", "info")
_ID = re.compile(r"^[0-9a-f]{12}$")
#: Prompt cache lifetime with a subscription; 5 minutes if the run used an API key.
CACHE_TTL_S = 3600


class ChatNotFound(LookupError):
    pass


def _atomic_write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(tmp, path)


class AgentStore:
    def __init__(self, project: Project):
        self.dir = project.root / STATE_DIR

    # --- settings -----------------------------------------------------------------------------
    @property
    def _settings_file(self) -> Path:
        return self.dir / "agent.json"

    def mode(self) -> str:
        try:
            mode = json.loads(self._settings_file.read_text()).get("mode")
        except (OSError, ValueError, AttributeError):
            return DEFAULT_MODE
        return mode if mode in MODES else DEFAULT_MODE

    def set_mode(self, mode: str) -> str:
        if mode not in MODES:
            raise ValueError(f"mode must be one of {MODES}")
        _atomic_write(self._settings_file, {"mode": mode})
        return mode

    # --- chats --------------------------------------------------------------------------------
    def _file(self, chat_id: str) -> Path:
        if not _ID.match(chat_id or ""):
            raise ChatNotFound(chat_id)
        return self.dir / "chats" / f"{chat_id}.json"

    def _read(self, chat_id: str) -> dict[str, Any]:
        try:
            chat = json.loads(self._file(chat_id).read_text())
        except (OSError, ValueError):
            raise ChatNotFound(chat_id) from None
        if not isinstance(chat, dict):
            raise ChatNotFound(chat_id)
        return chat

    def create(self, title: str = NEW_CHAT_TITLE) -> dict[str, Any]:
        stamp = now().isoformat()
        chat = {
            "id": secrets.token_hex(6),
            "title": (title or NEW_CHAT_TITLE).strip()[:80] or NEW_CHAT_TITLE,
            "created_at": stamp,
            "updated_at": stamp,
            "session_id": None,
            "tokens": 0,
            "last_turn_at": None,
            "cache_ttl_s": CACHE_TTL_S,
            "messages": [],
        }
        _atomic_write(self._file(chat["id"]), chat)
        return chat

    def get(self, chat_id: str) -> dict[str, Any]:
        return self._read(chat_id)

    def save(self, chat: dict[str, Any]) -> dict[str, Any]:
        _atomic_write(self._file(chat["id"]), chat)
        return chat

    def update(self, chat_id: str, **fields: Any) -> dict[str, Any]:
        chat = self._read(chat_id)
        chat.update(fields)
        return self.save(chat)

    def append(self, chat_id: str, kind: str, text: str, **extra: Any) -> dict[str, Any]:
        if kind not in MESSAGE_KINDS:
            raise ValueError(f"kind must be one of {MESSAGE_KINDS}")
        chat = self._read(chat_id)
        stamp = now().isoformat()
        chat["messages"].append({"k": kind, "t": text, "at": stamp, **extra})
        chat["updated_at"] = stamp
        if kind == "user" and chat["title"] == NEW_CHAT_TITLE and len(chat["messages"]) == 1:
            chat["title"] = text.strip().splitlines()[0][:48] or NEW_CHAT_TITLE
        return self.save(chat)

    def list(self) -> list[dict[str, Any]]:
        """Chats without their messages, newest activity first."""
        out = []
        for f in (self.dir / "chats").glob("*.json") if (self.dir / "chats").is_dir() else []:
            try:
                chat = json.loads(f.read_text())
            except (OSError, ValueError):
                continue
            if isinstance(chat, dict) and _ID.match(str(chat.get("id", ""))):
                out.append({k: v for k, v in chat.items() if k != "messages"} | {"messages_n": len(chat.get("messages") or [])})
        out.sort(key=lambda c: (c.get("updated_at") or "", c["id"]), reverse=True)
        return out
