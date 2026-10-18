"""Chats and settings of the agent, stored per project in `<project>/.mlviz/`.

One chat is one Claude Code session: the tool keeps its title, last activity, the `session_id` and the
numbers behind the context and cache display (see `docs/technical-reference.md`, "Agent"). Files:

- `.mlviz/chats/<id>.json`: one chat with its messages
- `.mlviz/settings.json`: the settings of the project (`agent.mode`, `agent.debug`, …, see `settings.py`);
  `.mlviz/agent.json` of v0.2 is still read when `settings.json` has no value

Everything is written atomically and only below `.mlviz/` of the project folder.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import threading
from pathlib import Path
from typing import Any

from .project import Project, now
from .settings import SettingsStore

STATE_DIR = ".mlviz"
MODES = ("direct", "mixed", "confirm")
DEFAULT_MODE = "mixed"
NEW_CHAT_TITLE = "Neuer Chat"
#: Longest text of the project instructions the agent may be given (and may write).
MAX_INSTRUCTIONS = 4000
MESSAGE_KINDS = ("user", "agent", "action", "info", "confirm", "choice")
_ID = re.compile(r"^[0-9a-f]{12}$")
#: Prompt cache lifetime with a subscription; 5 minutes if the run used an API key.
CACHE_TTL_S = 3600


class ChatNotFound(LookupError):
    pass


class InstructionsChanged(ValueError):
    """The instructions are not the text the caller expected (somebody changed them in between)."""


def _atomic_write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(tmp, path)


class AgentStore:
    def __init__(self, project: Project):
        self.dir = project.root / STATE_DIR
        self.settings = SettingsStore(project)
        # a chat file is changed from the reading thread of a request and from tool calls at the same time
        self._lock = threading.RLock()

    # --- settings -----------------------------------------------------------------------------
    @property
    def _settings_file(self) -> Path:
        return self.dir / "agent.json"

    def _settings(self) -> dict:
        try:
            data = json.loads(self._settings_file.read_text())
        except (OSError, ValueError):
            return {}
        return data if isinstance(data, dict) else {}

    def _drop_legacy(self, key: str) -> None:
        """A value set in the settings replaces the one in the `agent.json` of v0.2."""
        with self._lock:
            legacy = self._settings()
            if key in legacy:
                legacy.pop(key)
                if legacy:
                    _atomic_write(self._settings_file, legacy)
                else:
                    self._settings_file.unlink(missing_ok=True)

    def mode(self) -> str:
        if self.settings.explicit("agent.mode"):
            return self.settings.get("agent.mode")
        legacy = self._settings().get("mode")
        return legacy if legacy in MODES else DEFAULT_MODE

    def set_mode(self, mode: str) -> str:
        if mode not in MODES:
            raise ValueError(f"mode must be one of {MODES}")
        self.settings.change({"agent.mode": mode})
        self._drop_legacy("mode")
        return mode

    def debug(self) -> bool:
        """Debug display: the chat also shows the look-ups of the agent (a setting per project, off by default)."""
        if self.settings.explicit("agent.debug"):
            return True
        return self._settings().get("debug") is True

    def set_debug(self, on: bool) -> bool:
        self.settings.change({"agent.debug": bool(on)})
        self._drop_legacy("debug")
        return bool(on)

    # --- instructions of the project (v0.2.3) ----------------------------------------------------
    @property
    def _instructions_file(self) -> Path:
        return self.dir / "agent_instructions.md"

    def instructions(self) -> str:
        """What the user wants the agent to do in this project, in his own words ("" if there is nothing)."""
        try:
            return self._instructions_file.read_text(encoding="utf-8")
        except OSError:
            return ""

    def set_instructions(self, text: str, expect: str | None = None) -> str:
        """Replaces the instructions. With `expect` only if they are still that text (else ValueError)."""
        if not isinstance(text, str):
            raise ValueError("text must be a string")
        text = text.replace("\r\n", "\n").strip("\n")
        if len(text) > MAX_INSTRUCTIONS:
            raise ValueError(f"Die Anweisungen dürfen höchstens {MAX_INSTRUCTIONS} Zeichen haben (hier {len(text)}).")
        with self._lock:
            if expect is not None and self.instructions().strip("\n") != expect.replace("\r\n", "\n").strip("\n"):
                raise InstructionsChanged("Die Anweisungen wurden inzwischen geändert.")
            if text:
                self._instructions_file.parent.mkdir(parents=True, exist_ok=True)
                tmp = self._instructions_file.with_suffix(".tmp")
                tmp.write_text(text + "\n", encoding="utf-8")
                os.replace(tmp, self._instructions_file)
            else:
                self._instructions_file.unlink(missing_ok=True)
        return text

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

    def delete_all(self) -> int:
        """Deletes every chat file; returns how many."""
        with self._lock:
            files = list((self.dir / "chats").glob("*.json"))
            for f in files:
                f.unlink(missing_ok=True)
        return len(files)

    def save(self, chat: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            _atomic_write(self._file(chat["id"]), chat)
        return chat

    def update(self, chat_id: str, **fields: Any) -> dict[str, Any]:
        with self._lock:
            chat = self._read(chat_id)
            chat.update(fields)
            return self.save(chat)

    def replace(self, chat_id: str, cid: str, message: dict[str, Any]) -> dict[str, Any]:
        """Swaps the message that carries `cid` (a confirmation card) for another one, in place."""
        with self._lock:
            chat = self._read(chat_id)
            for i, m in enumerate(chat["messages"]):
                if m.get("cid") == cid:
                    chat["messages"][i] = {**message, "at": now().isoformat(), "cid": cid}
                    break
            else:
                chat["messages"].append({**message, "at": now().isoformat(), "cid": cid})
            chat["updated_at"] = now().isoformat()
            return self.save(chat)

    def set_action(self, chat_id: str, cid: str, **fields: Any) -> dict[str, Any]:
        """Updates an action line after undo or redo (`state`, `t`)."""
        with self._lock:
            chat = self._read(chat_id)
            for m in chat["messages"]:
                if m.get("cid") == cid and m.get("k") == "action":
                    m.update(fields)
                    return self.save(chat)
        raise ChatNotFound(cid)

    def append(self, chat_id: str, kind: str, text: str, **extra: Any) -> dict[str, Any]:
        if kind not in MESSAGE_KINDS:
            raise ValueError(f"kind must be one of {MESSAGE_KINDS}")
        with self._lock:
            chat = self._read(chat_id)
            stamp = now().isoformat()
            chat["messages"].append({"k": kind, "t": text, "at": stamp, **extra})
            chat["updated_at"] = stamp
            if kind == "user" and chat["title"] == NEW_CHAT_TITLE and len(chat["messages"]) == 1:
                first = (text.strip().splitlines() or [""])[0][:48]
                chat["title"] = first or ("Bild" if extra.get("images") else NEW_CHAT_TITLE)
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
                out.append({k: v for k, v in chat.items() if k != "messages"} | {"messages_n": len(chat.get("messages") or []), "_mtime": f.stat().st_mtime_ns})
        # same second (or a fixed clock in tests): the file written last is the newest
        out.sort(key=lambda c: (c.get("updated_at") or "", c["_mtime"]), reverse=True)
        for c in out:
            del c["_mtime"]
        return out
