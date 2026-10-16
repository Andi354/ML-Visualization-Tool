"""Runs the agent: one `claude -p` call per message (feature F).

One chat is one Claude Code session. A message starts `claude -p "<context>\\n<message>" [--resume <session_id>]
--output-format stream-json --verbose` in the project folder with the subscription login of the user running the
tool. The stream is read line by line; every change of the chat (the message, each answer block, the end) is
handed out as a snapshot so the browser can show it live. The tool never asks the agent for numbers it can
compute itself: context and cache come from the usage of the last API call, the clock of the tool and the TTL.

`MLVIZ_CLAUDE` replaces the `claude` command (a command line; the tests use a stand-in).
"""

from __future__ import annotations

import json
import os
import shlex
import shutil
import subprocess
import threading
from collections.abc import Iterator
from typing import Any

from .agent_store import AgentStore
from .project import Project, now

#: Cache lifetime with a subscription is 1 h, with an API key 5 min (see agent_store.CACHE_TTL_S).
CACHE_TTL_API_KEY_S = 300
DEFAULT_CONTEXT_WINDOW = 200_000

SYSTEM_PROMPT = (
    "Du bist der Agent im ML Visualization Tool, einer lokalen Ergebnis-Ansicht für Data-Science-Projekte "
    "(Läufe, Experimente, Vergleiche, Deliverables). Die erste Zeile jeder Nachricht beschreibt, was der Nutzer "
    "gerade sieht. Antworte knapp und auf Deutsch. Du darfst Projektdateien nur lesen."
)


class Busy(RuntimeError):
    """The chat already has a request running."""


def command() -> list[str] | None:
    """The `claude` command (a list), or None if Claude Code is not installed."""
    custom = os.environ.get("MLVIZ_CLAUDE")
    if custom:
        return shlex.split(custom)
    found = shutil.which("claude")
    return [found] if found else None


def api_key_set() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def setup_check() -> dict[str, Any]:
    """Is the agent usable here? `{ready, problem, step, api_key}`; problem and step are German texts for the window."""
    out: dict[str, Any] = {"ready": False, "problem": None, "step": None, "api_key": api_key_set()}
    cmd = command()
    if cmd is None:
        out["problem"] = "Claude Code ist nicht installiert (oder die Anwendung läuft in Docker)."
        out["step"] = "Claude Code installieren und das Tool ohne Docker starten (`make run`)."
        return out
    try:
        r = subprocess.run([*cmd, "auth", "status"], capture_output=True, text=True, timeout=30)
        status = json.loads(r.stdout or "{}")
    except (OSError, ValueError, subprocess.TimeoutExpired):
        status = {}
    if not status.get("loggedIn"):
        out["problem"] = "Claude Code ist nicht angemeldet."
        out["step"] = "Im Terminal `claude` ausführen und anmelden."
        return out
    out["ready"] = True
    return out


def _usage_tokens(usage: dict[str, Any] | None) -> int:
    u = usage or {}
    return int(u.get("input_tokens") or 0) + int(u.get("cache_creation_input_tokens") or 0) + int(u.get("cache_read_input_tokens") or 0)


def parse_limits(event: dict[str, Any]) -> dict[str, Any] | None:
    """Subscription usage from a `rate_limit_event`: `{five_hour, seven_day}` in percent, or None."""
    windows = (event.get("rate_limit_info") or {}).get("unifiedWindows") or {}
    out = {}
    for key in ("five_hour", "seven_day"):
        u = (windows.get(key) or {}).get("utilization")
        if isinstance(u, (int, float)):
            out[key] = round(u * 100)
    return out or None


class AgentRunner:
    def __init__(self, project: Project, store: AgentStore):
        self.project = project
        self.store = store
        self.limits: dict[str, Any] | None = None
        self._procs: dict[str, subprocess.Popen] = {}
        self._stopped: set[str] = set()
        self._lock = threading.Lock()

    def running(self, chat_id: str) -> bool:
        with self._lock:
            return chat_id in self._procs

    def stop(self, chat_id: str) -> bool:
        with self._lock:
            proc = self._procs.get(chat_id)
            if proc is None:
                return False
            self._stopped.add(chat_id)
        proc.terminate()
        return True

    def _snapshot(self, chat_id: str, busy: bool) -> dict[str, Any]:
        return {"chat": self.store.get(chat_id), "busy": busy, "limits": self.limits}

    def compact(self, chat_id: str) -> Iterator[dict[str, Any]]:
        """`/compact` on the session of a chat (works in `-p` mode); the chat notes "Chat komprimiert · 52k → 2k Tokens"."""
        return self.run(chat_id, "/compact", compact=True)

    def run(self, chat_id: str, text: str, context: str = "", resend: bool = False, compact: bool = False) -> Iterator[dict[str, Any]]:
        """Sends a message and yields snapshots of the chat until the answer is complete, stopped or failed."""
        cmd = command()
        with self._lock:
            if chat_id in self._procs:
                raise Busy(chat_id)
            self._procs[chat_id] = None  # type: ignore[assignment]  # reserved until the process exists
        try:
            chat = self.store.get(chat_id)
            if resend and chat["messages"] and chat["messages"][-1].get("error"):
                chat["messages"].pop()
                self.store.save(chat)
            if not resend and not compact:
                self.store.append(chat_id, "user", text)
            yield self._snapshot(chat_id, True)
            if cmd is None:
                self.store.append(chat_id, "info", "Claude Code wurde nicht gefunden.", error=True)
                yield self._snapshot(chat_id, False)
                return
            yield from self._call(cmd, chat_id, text, context, compact)
        finally:
            with self._lock:
                self._procs.pop(chat_id, None)
                self._stopped.discard(chat_id)

    def _call(self, cmd: list[str], chat_id: str, text: str, context: str, compact: bool = False) -> Iterator[dict[str, Any]]:
        chat = self.store.get(chat_id)
        prompt = f"[Ansicht: {context}]\n{text}" if context else text
        args = [
            *cmd,
            "-p",
            prompt,
            "--output-format",
            "stream-json",
            "--verbose",
            "--mcp-config",
            json.dumps({"mcpServers": {}}),
            "--strict-mcp-config",
            "--allowedTools",
            "Read,Glob,Grep",
            "--append-system-prompt",
            SYSTEM_PROMPT,
        ]
        if chat.get("session_id"):
            args += ["--resume", chat["session_id"]]
        try:
            proc = subprocess.Popen(args, cwd=self.project.root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        except OSError as e:
            self.store.append(chat_id, "info", f"Claude Code ließ sich nicht starten: {e}", error=True)
            yield self._snapshot(chat_id, False)
            return
        with self._lock:
            self._procs[chat_id] = proc
        last_tokens = 0
        window = chat.get("context_window") or DEFAULT_CONTEXT_WINDOW
        error: str | None = None
        saw_result = False
        boundary: dict[str, Any] | None = None
        for line in proc.stdout:  # type: ignore[union-attr]
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            kind = ev.get("type")
            if kind == "system" and ev.get("subtype") == "init" and ev.get("session_id"):
                self.store.update(chat_id, session_id=ev["session_id"])
            elif kind == "system" and ev.get("subtype") == "compact_boundary":
                boundary = ev.get("compact_metadata") or {}
            elif kind == "rate_limit_event":
                self.limits = parse_limits(ev) or self.limits
            elif kind == "assistant":
                msg = ev.get("message") or {}
                if ev.get("parent_tool_use_id") is None:
                    last_tokens = _usage_tokens(msg.get("usage")) or last_tokens
                    for block in msg.get("content") or []:
                        if block.get("type") == "text" and (block.get("text") or "").strip():
                            self.store.append(chat_id, "agent", block["text"].strip())
                            yield self._snapshot(chat_id, True)
            elif kind == "result":
                saw_result = True
                for m in (ev.get("modelUsage") or {}).values():
                    if m.get("contextWindow"):
                        window = int(m["contextWindow"])
                last_tokens = last_tokens or _usage_tokens(ev.get("usage"))
                if ev.get("is_error"):
                    error = str(ev.get("result") or "Claude Code meldet einen Fehler.")
        proc.wait()
        stderr = (proc.stderr.read() if proc.stderr else "").strip()  # type: ignore[union-attr]
        with self._lock:
            stopped = chat_id in self._stopped
        if stopped:
            self.store.append(chat_id, "info", "Abgebrochen")
        elif error:
            self.store.append(chat_id, "info", error, error=True)
        elif not saw_result:
            self.store.append(chat_id, "info", (stderr.splitlines() or ["Claude Code hat nicht geantwortet."])[-1], error=True)
        if compact and boundary and not error:
            before, after = int(boundary.get("pre_tokens") or 0), int(boundary.get("post_tokens") or 0)
            self.store.append(chat_id, "info", f"Chat komprimiert · {round(before / 1000)}k → {round(after / 1000)}k Tokens")
            self.store.update(chat_id, tokens=after, last_turn_at=now().isoformat())
        elif compact and not error and not stopped:
            self.store.append(chat_id, "info", "Der Chat ließ sich nicht komprimieren.", error=True)
        elif last_tokens:
            self.store.update(
                chat_id,
                tokens=last_tokens,
                last_turn_at=now().isoformat(),
                cache_ttl_s=CACHE_TTL_API_KEY_S if api_key_set() else 3600,
                context_window=window,
            )
        yield self._snapshot(chat_id, False)
