"""Runs the agent: one `claude -p` call per message (feature F).

One chat is one Claude Code session. A message starts `claude -p "<context>\\n<message>" [--resume <session_id>]
--output-format stream-json --verbose` in the project folder with the subscription login of the user running the
tool. The stream is read line by line; every change of the chat (the message, each answer block, the end) is
handed out as a snapshot so the browser can show it live. The tool never asks the agent for numbers it can
compute itself: context and cache come from the usage of the last API call, the clock of the tool and the TTL.

`MLVIZ_CLAUDE` replaces the `claude` command (a command line; the tests use a stand-in). Without it the PATH is searched,
then the newest Claude Code VS Code extension under `~/.vscode-server/extensions`.
"""

from __future__ import annotations

import json
import os
import queue
import re
import secrets
import shlex
import shutil
import subprocess
import threading
import time
from pathlib import Path
from dataclasses import dataclass, field
from collections.abc import Iterator
from typing import Any

from . import agent_tools
from .agent_attachments import AttachmentStore
from .agent_store import AgentStore
from .project import Project, now

#: Cache lifetime with a subscription is 1 h, with an API key 5 min (see agent_store.CACHE_TTL_S).
CACHE_TTL_API_KEY_S = 300
DEFAULT_CONTEXT_WINDOW = 200_000

SYSTEM_PROMPT = (
    "Du bist der Agent im ML Visualization Tool, einer lokalen Ergebnis-Ansicht für Data-Science-Projekte "
    "(Läufe, Experimente, Vergleiche, Deliverables). Antworte knapp und auf Deutsch. Die erste Zeile jeder "
    "Nachricht beschreibt, was der Nutzer gerade sieht und in welchem Modus du arbeitest. Du bedienst das Tool nur "
    "über die Werkzeuge des MCP-Servers `mlviz` (Läufe suchen und lesen, navigieren, Ansicht einstellen, Analyse "
    "ändern, Bilder speichern); Projektdateien darfst du nur lesen, Läufe nicht starten und nichts löschen. "
    "Fragt der Nutzer, was du kannst oder nicht kannst, oder bist du unsicher, ob etwas geht: ruf zuerst `help` auf "
    "(Thema `faehigkeiten`) und antworte nach dem Text, nicht aus dem Gedächtnis. Zahlen und Namen rätst du nie, "
    "schlag sie nach. Bei mehreren passenden Läufen frag mit `choose_run` zurück. Wird eine Aktion abgelehnt, mach "
    "ohne sie weiter. `get_view` zeigt dir den genauen Zustand der Ansicht. Nach einer Änderung am Board stehen die "
    "Zustände der Widgets im Ergebnis (`widgets`, je `state` ok, loading, error, unavailable oder gone, mit `reason`): "
    "Melde dem Nutzer Widgets mit Fehler oder `unavailable` und versuch eine Lösung, statt zu sagen, es habe geklappt. "
    "Bilder des Nutzers stehen als `[Bild n: Pfad]` in seiner Nachricht: lies sie mit `Read`. Dazu kann der Nutzer "
    "Anweisungen für dieses Projekt geben (am Ende, falls es welche gibt): Sie gelten zusätzlich, bei Widerspruch gilt "
    "dieser feste Teil. Du änderst sie nur mit `set_instructions` und nur, wenn der Nutzer es ausdrücklich will."
)
#: Introduces the project instructions the user wrote (appended to the fixed prompt, never in its place)
INSTRUCTIONS_HEAD = "\n\nAnweisungen des Nutzers für dieses Projekt:\n"
#: The modes as the agent reads them in the first line of a message
MODE_LABELS = {"direct": "Direkt", "mixed": "Gemischt", "confirm": "Bestätigen"}
#: How long the tool waits for the open browser to carry out a command
COMMAND_TIMEOUT_S = 120


def _clip(text: str, limit: int = 160) -> str:
    """One line for the chat: line breaks folded, cut with an ellipsis."""
    line = " ".join(str(text).split())
    return line if len(line) <= limit else line[:limit] + "…"


@dataclass
class Pending:
    """Something the agent waits for: a click on a card (`decision`) or the result of a command in the browser."""

    chat_id: str
    event: threading.Event = field(default_factory=threading.Event)
    value: dict[str, Any] = field(default_factory=dict)


@dataclass
class ChatRun:
    """The live state of one request: what the browser's stream will hand out next."""

    out: queue.Queue = field(default_factory=queue.Queue)
    stopped: bool = False


class Busy(RuntimeError):
    """The chat already has a request running."""


def command(custom: str | None = None) -> list[str] | None:
    """The `claude` command (a list), or None if Claude Code is not installed. `custom` is the setting `agent.claude`."""
    custom = custom or os.environ.get("MLVIZ_CLAUDE")
    if custom:
        return shlex.split(custom)
    found = shutil.which("claude") or _vscode_claude()
    return [found] if found else None


def _vscode_claude() -> str | None:
    """The `claude` binary shipped with the Claude Code VS Code extension (newest version), for hosts where it is not on the PATH."""
    root = Path.home() / ".vscode-server" / "extensions"
    found = []
    for path in root.glob("anthropic.claude-code-*/resources/native-binary/claude"):
        version = re.search(r"claude-code-(\d+(?:\.\d+)*)", path.parent.parent.parent.name)
        if version and os.access(path, os.X_OK):
            found.append((tuple(int(n) for n in version.group(1).split(".")), str(path)))
    return max(found)[1] if found else None


def api_key_set() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def setup_check(custom: str | None = None) -> dict[str, Any]:
    """Is the agent usable here? `{ready, problem, step, api_key}`; problem and step are German texts for the window."""
    out: dict[str, Any] = {"ready": False, "problem": None, "step": None, "api_key": api_key_set()}
    cmd = command(custom)
    if cmd is None:
        out["problem"] = "Claude Code ist nicht installiert (oder die Anwendung läuft in Docker)."
        out["step"] = "Claude Code installieren und das Tool ohne Docker starten (`make run`); liegt `claude` nicht im PATH, den Pfad in `MLVIZ_CLAUDE` setzen."
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
        self.attachments = AttachmentStore(project)
        self.limits: dict[str, Any] | None = None
        self._procs: dict[str, subprocess.Popen] = {}
        self._stopped: set[str] = set()
        self._lock = threading.Lock()
        #: requests in progress, by chat; the MCP server of the tool answers only for these
        self.live: dict[str, ChatRun] = {}
        self.pending: dict[str, Pending] = {}
        #: a new secret per start of the tool; `claude` gets it in its MCP config
        self.token = secrets.token_urlsafe(24)

    def system_prompt(self) -> str:
        """The fixed prompt, and the instructions of the project after it if there are any (read afresh for every message)."""
        instructions = self.store.instructions().strip()
        return SYSTEM_PROMPT + (INSTRUCTIONS_HEAD + instructions if instructions else "")

    def running(self, chat_id: str) -> bool:
        with self._lock:
            return chat_id in self._procs

    def stop(self, chat_id: str) -> bool:
        with self._lock:
            if chat_id not in self._procs:
                return False
            proc = self._procs[chat_id]  # None while `claude` is still being started
            self._stopped.add(chat_id)
            live = self.live.get(chat_id)
            waiting = [p for p in self.pending.values() if p.chat_id == chat_id]
        if live:
            live.stopped = True
        for p in waiting:  # a card or a command nobody will answer any more
            p.event.set()
        if proc is not None:
            proc.terminate()
        return True

    def _snapshot(self, chat_id: str, busy: bool) -> dict[str, Any]:
        return {"chat": self.store.get(chat_id), "busy": busy, "limits": self.limits}

    def compact(self, chat_id: str) -> Iterator[dict[str, Any]]:
        """`/compact` on the session of a chat (works in `-p` mode); the chat notes "Chat komprimiert · 52k → 2k Tokens"."""
        return self.run(chat_id, "/compact", compact=True)

    def run(self, chat_id: str, text: str, context: str = "", resend: bool = False, compact: bool = False, base_url: str = "", images: list[dict] | None = None) -> Iterator[dict[str, Any]]:
        """Sends a message and yields snapshots of the chat until the answer is complete, stopped or failed.

        Between snapshots it also yields `{"command": {id, tool, args}}` items: what the open tool is asked to do."""
        cmd = command(self.store.settings.get("agent.claude") or None)
        with self._lock:
            if chat_id in self._procs:
                raise Busy(chat_id)
            self._procs[chat_id] = None  # type: ignore[assignment]  # reserved until the process exists
            live = self.live[chat_id] = ChatRun()
        try:
            chat = self.store.get(chat_id)
            if resend and chat["messages"] and chat["messages"][-1].get("error"):
                chat["messages"].pop()
                self.store.save(chat)
            if not resend and not compact:
                self.store.append(chat_id, "user", text, **({"images": images} if images else {}))
            yield self._snapshot(chat_id, True)
            if cmd is None:
                self.store.append(chat_id, "info", "Claude Code wurde nicht gefunden.", error=True)
                yield self._snapshot(chat_id, False)
                return

            def work() -> None:
                try:
                    for snap in self._call(cmd, chat_id, text, context, compact, base_url, live, images or []):
                        live.out.put(snap)
                finally:
                    live.out.put(None)

            threading.Thread(target=work, daemon=True).start()
            while (item := live.out.get()) is not None:
                yield item
            self._sweep(chat_id)
            yield self._snapshot(chat_id, False)
        finally:
            with self._lock:
                self._procs.pop(chat_id, None)
                self._stopped.discard(chat_id)
                self.live.pop(chat_id, None)

    def _call(self, cmd: list[str], chat_id: str, text: str, context: str, compact: bool, base_url: str, live: ChatRun, images: list[dict]) -> Iterator[dict[str, Any]]:
        chat = self.store.get(chat_id)
        mode = MODE_LABELS.get(self.store.mode(), "Gemischt")
        if compact:  # a slash command stands alone
            prompt = text
        else:
            prompt = f"[Ansicht: {context}, Modus: {mode}]\n{text}" if context else f"[Modus: {mode}]\n{text}"
            if images:  # where the images lie: the agent reads them with `Read`
                prompt += "\n" + "\n".join(self.attachments.lines(images))
        args = [
            *cmd,
            "-p",
            prompt,
            "--output-format",
            "stream-json",
            "--verbose",
            "--mcp-config",
            json.dumps(self.mcp_config(chat_id, base_url)),
            "--strict-mcp-config",
            "--allowedTools",
            "mcp__mlviz__*,Read,Glob,Grep",
            "--append-system-prompt",
            self.system_prompt(),
        ]
        if chat.get("session_id"):
            args += ["--resume", chat["session_id"]]
        try:
            proc = subprocess.Popen(args, cwd=self.project.root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        except OSError as e:
            self.store.append(chat_id, "info", f"Claude Code ließ sich nicht starten: {e}", error=True)
            return
        with self._lock:
            self._procs[chat_id] = proc
            stopped_early = chat_id in self._stopped  # stop came while `claude` was still being started
        if stopped_early:
            proc.terminate()
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

    # --- the tools of the agent: an MCP server on localhost ---------------------------------------------
    def mcp_config(self, chat_id: str, base_url: str) -> dict[str, Any]:
        """`--mcp-config` for `claude`: the tool's own server, one URL per chat, the secret of this start as token."""
        return {"mcpServers": {"mlviz": {"type": "http", "url": f"{base_url}/mcp/{chat_id}", "headers": {"Authorization": f"Bearer {self.token}"}}}}

    def authorised(self, header: str | None) -> bool:
        return bool(header) and secrets.compare_digest(str(header), f"Bearer {self.token}")

    def handle_mcp(self, chat_id: str, message: dict[str, Any]) -> dict[str, Any] | None:
        """One JSON-RPC message of the MCP protocol (streamable HTTP, JSON replies); None for notifications."""
        method, mid, params = message.get("method"), message.get("id"), message.get("params") or {}
        if mid is None:  # notifications/initialized and friends
            return None

        def ok(result: dict[str, Any]) -> dict[str, Any]:
            return {"jsonrpc": "2.0", "id": mid, "result": result}

        if method == "initialize":
            return ok(
                {
                    "protocolVersion": params.get("protocolVersion") or "2025-03-26",
                    "capabilities": {"tools": {"listChanged": False}},
                    "serverInfo": {"name": "mlviz", "version": "0.2.0"},
                }
            )
        if method == "ping":
            return ok({})
        if method == "tools/list":
            return ok({"tools": agent_tools.catalog()})
        if method == "tools/call":
            text, is_error = self.call_tool(chat_id, str(params.get("name")), params.get("arguments") or {})
            return ok({"content": [{"type": "text", "text": text}], "isError": is_error})
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"unknown method {method}"}}

    def _await(self, chat_id: str, cid: str) -> Pending:
        """Registers what the agent waits for under `cid`; the caller waits on it with `_wait`."""
        box = Pending(chat_id)
        with self._lock:
            self.pending[cid] = box
        return box

    def _wait(self, box: Pending, live: ChatRun, timeout: float | None) -> bool:
        """True once the answer is in; False when the request was stopped or the time ran out."""
        deadline = None if timeout is None else time.monotonic() + timeout
        while not box.event.wait(0.2):
            if live.stopped or (deadline is not None and time.monotonic() > deadline):
                return False
        return not live.stopped or bool(box.value)

    def _forget(self, cid: str) -> None:
        with self._lock:
            self.pending.pop(cid, None)

    def answer(self, cid: str, value: dict[str, Any]) -> bool:
        """A click on a card or the result of a command (from the browser); False if nobody waits for `cid` any more."""
        with self._lock:
            box = self.pending.get(cid)
        if box is None:
            return False
        box.value = value
        box.event.set()
        return True

    def _push(self, chat_id: str, live: ChatRun) -> None:
        live.out.put(self._snapshot(chat_id, True))

    def call_tool(self, chat_id: str, name: str, args: dict[str, Any]) -> tuple[str, bool]:
        """Runs one tool for the agent: `(text for the agent, is_error)`. Which tools wait for a click is the mode's call.

        What Tim sees in the chat: every failure (a line of its own unless the tool wrote one already), the look-up of
        `help` with its topic, and with the debug display on every look-up of the agent."""
        text, is_error, noted = self._call_tool(chat_id, name, args)
        try:
            self._trace(chat_id, name, args, text, is_error, noted)
        except Exception:  # a line in the chat must never break the call of the agent
            pass
        return text, is_error

    def _trace(self, chat_id: str, name: str, args: dict[str, Any], text: str, is_error: bool, noted: bool) -> None:
        with self._lock:
            live = self.live.get(chat_id)
        if is_error and not noted:
            self.store.append(chat_id, "info", f"{name}: {_clip(text)}", error=True, tool=name)
        elif not is_error and name == "help":
            topic = str(args.get("topic") or "").strip().lower()
            self.store.append(chat_id, "action", f"Hilfe gelesen · {topic or 'Inhaltsverzeichnis'}", state="done")
        elif not is_error and not noted and self.store.debug():
            shown = json.dumps(args, ensure_ascii=False) if args else ""
            self.store.append(chat_id, "action", f"{name} {_clip(shown, 100)} → {_clip(text)}".replace("  ", " "), state="done", debug=True)
        else:
            return
        if live is not None:
            self._push(chat_id, live)

    def _call_tool(self, chat_id: str, name: str, args: dict[str, Any]) -> tuple[str, bool, bool]:
        """`(text, is_error, noted)`: `noted` says that the tool has put a line into the chat itself."""
        tool = agent_tools.TOOLS.get(name)
        if tool is None:
            return f"Unbekanntes Werkzeug: {name}", True, False
        if tool.side == "backend" and name != "choose_run":
            try:
                result = agent_tools.run_tool(self.project, name, args)
                return (result if isinstance(result, str) else json.dumps(result, ensure_ascii=False, default=str)), False, False
            except ValueError as e:
                return str(e), True, False
        with self._lock:
            live = self.live.get(chat_id)
        if live is None:
            return "In diesem Chat läuft gerade keine Anfrage.", True, False
        if name == "choose_run":
            text, is_error = self._choose_run(chat_id, live, args)
            return text, is_error, not is_error  # the run cards and their result line are in the chat
        try:
            tool.check(args)
            args = agent_tools.resolve_runs(self.project, args)
        except ValueError as e:
            return str(e), True, False
        cid = secrets.token_hex(6)
        what = tool.describe(args) or name
        confirmed = False
        if agent_tools.asks(tool, self.store.mode()):
            details = tool.details(args)
            if name == "save_deliverable":
                details = [f"Ziel: {agent_tools.deliverable_target(self.project, str(args.get('title') or ''))}/", *details]
            if name == "set_instructions":
                details = self._instruction_details(str(args.get("text") or ""))
            self.store.append(chat_id, "confirm", what, cid=cid, tool=name, details=details, save=name == "save_deliverable")
            self._push(chat_id, live)
            box = self._await(chat_id, cid)
            answered = self._wait(box, live, None)
            self._forget(cid)
            if not answered or not box.value.get("approve"):
                self.store.replace(chat_id, cid, {"k": "action", "t": f"Abgelehnt · {what}", "rejected": True})
                self._push(chat_id, live)
                return "Der Nutzer hat diese Aktion abgelehnt. Mach ohne sie weiter.", False, True
            confirmed = True
        box = self._await(chat_id, cid)
        live.out.put({"command": {"id": cid, "tool": name, "args": args}})
        answered = self._wait(box, live, COMMAND_TIMEOUT_S)
        self._forget(cid)
        if not answered:
            note = "Die Ansicht hat nicht geantwortet (Browser geschlossen?)." if not live.stopped else "Abgebrochen."
            self._line(chat_id, cid, confirmed, {"k": "info", "t": f"{what}: {note}", "error": True, "tool": name})
            self._push(chat_id, live)
            return note, True, True
        result = box.value
        if not result.get("ok"):
            error = str(result.get("error") or "fehlgeschlagen")
            self._line(chat_id, cid, confirmed, {"k": "info", "t": f"{what}: {error}", "error": True, "tool": name})
            self._push(chat_id, live)
            return error, True, True
        if tool.silent:
            return json.dumps(result.get("data"), ensure_ascii=False, default=str), False, False
        undoable = bool(result.get("undoable"))
        line = {"k": "action", "t": str(result.get("summary") or what), "state": "done", "auto": not confirmed}
        if undoable:
            line["undo_id"] = cid
        self._line(chat_id, cid, confirmed, line)
        self._push(chat_id, live)
        return json.dumps({"ok": True, "summary": line["t"], "data": result.get("data")}, ensure_ascii=False, default=str), False, True

    def _instruction_details(self, new: str) -> list[str]:
        """The card for new project instructions shows the whole new text and the old one, so nothing is dropped unseen."""
        old = self.store.instructions().strip("\n")
        new = new.strip("\n")
        return [
            "Neuer Text (ersetzt den bisherigen):",
            *(new.splitlines() or ["(leer: die Anweisungen werden gelöscht)"]),
            "",
            "Bisher:",
            *(old.splitlines() or ["(leer)"]),
            "",
            "Gilt ab der nächsten Nachricht. Der Cache dieses Chats ist danach einmal kalt.",
        ]

    def _line(self, chat_id: str, cid: str, replace: bool, message: dict[str, Any]) -> None:
        """The result line of a tool: it takes the place of its confirmation card, else it is appended."""
        self.store.replace(chat_id, cid, message)

    def _choose_run(self, chat_id: str, live: ChatRun, args: dict[str, Any]) -> tuple[str, bool]:
        runs = []
        for rid in agent_tools.resolve_runs_lenient(self.project, args.get("runs") or []):
            run = get_run_info(self.project, str(rid))
            if run:
                runs.append({k: run.get(k) for k in ("id", "name", "started", "state", "axes", "issue")})
        if not runs:
            return "Keiner dieser Läufe existiert.", True
        cid = secrets.token_hex(6)
        self.store.append(chat_id, "choice", str(args.get("question") or "Welchen Lauf meinst du?"), cid=cid, runs=runs)
        self._push(chat_id, live)
        box = self._await(chat_id, cid)
        answered = self._wait(box, live, None)
        self._forget(cid)
        choice = str(box.value.get("choice") or "")
        if not answered or choice not in {r["id"] for r in runs}:
            self.store.replace(chat_id, cid, {"k": "action", "t": "Keine Auswahl getroffen", "rejected": True})
            self._push(chat_id, live)
            return "Der Nutzer hat keinen Lauf gewählt.", False
        picked = next(r for r in runs if r["id"] == choice)
        self.store.replace(chat_id, cid, {"k": "action", "t": f"Lauf gewählt · {picked['name']}"})
        self._push(chat_id, live)
        return json.dumps({"run": choice}), False

    def _sweep(self, chat_id: str) -> None:
        """Cards nobody answered before the request ended (stop, crash) are closed as rejected."""
        try:
            chat = self.store.get(chat_id)
        except LookupError:
            return
        for m in chat["messages"]:
            if m.get("k") in ("confirm", "choice") and m.get("cid"):
                self.store.replace(chat_id, m["cid"], {"k": "action", "t": f"Abgebrochen · {m.get('t', '')}", "rejected": True})


def get_run_info(project: Project, run_id: str) -> dict[str, Any] | None:
    from .runs import get_run

    run = get_run(project, run_id)
    return run.info() if run else None
