"""Own notes on runs (v0.3.0, feature E).

`<project>/.mlviz/notes/<run-id>.json` is a list of `{id, text, created, updated, anchor: {kind, key}, by}`. `kind` is
`run` (key empty), `section` (key: `purpose`, `shows`, `expectation` or `notes` of the description) or `group` (key: the
values of the grid axes, e.g. `lstm_layer=2 · lr_epochs=40`). `by` is `user` or `agent` (an agent's proposal the user
confirmed). A missing file means no notes; everything is written atomically and only below `.mlviz/notes/`.
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

ANCHORS = ("run", "section", "group")
SECTIONS = ("purpose", "shows", "expectation", "notes")
MAX_TEXT = 4000
_RUN_ID = re.compile(r"^[\w.\-]+$")


class NoteNotFound(LookupError):
    pass


def clean_anchor(anchor: Any) -> dict[str, str]:
    """`{kind, key}` in its stored form, or ValueError."""
    if anchor is None:
        return {"kind": "run", "key": ""}
    if not isinstance(anchor, dict) or anchor.get("kind") not in ANCHORS:
        raise ValueError(f"anchor.kind muss eine von {ANCHORS} sein.")
    kind, key = anchor["kind"], str(anchor.get("key") or "")
    if kind == "run":
        key = ""
    elif kind == "section" and key not in SECTIONS:
        raise ValueError(f"Ein Abschnitt der Beschreibung ist einer von {SECTIONS}.")
    elif kind == "group" and not key.strip():
        raise ValueError("Eine Gruppe braucht ihre Achsenwerte als key, z. B. „lstm_layer=2 · lr_epochs=40“.")
    return {"kind": kind, "key": key}


class NoteStore:
    def __init__(self, project: Project):
        self.dir = project.root / ".mlviz" / "notes"
        self._lock = threading.RLock()

    def _file(self, run_id: str) -> Path:
        if not _RUN_ID.match(run_id):
            raise ValueError("ungültige Lauf-ID")
        return self.dir / f"{run_id}.json"

    def list(self, run_id: str) -> list[dict[str, Any]]:
        try:
            data = json.loads(self._file(run_id).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return []
        return [n for n in data if isinstance(n, dict) and "id" in n and "text" in n] if isinstance(data, list) else []

    def _write(self, run_id: str, notes: list[dict[str, Any]]) -> None:
        path = self._file(run_id)
        if not notes:
            path.unlink(missing_ok=True)
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, path)

    def counts(self) -> dict[str, int]:
        """Notes per run id (only runs that have some)."""
        if not self.dir.is_dir():
            return {}
        out = {}
        for f in self.dir.glob("*.json"):
            n = len(self.list(f.stem))
            if n:
                out[f.stem] = n
        return out

    def search(self, text: str, limit: int = 8) -> list[dict[str, str]]:
        """Notes whose text contains `text` (any case): `{run, id, excerpt}`."""
        q = text.strip().lower()
        out: list[dict[str, str]] = []
        if not q or not self.dir.is_dir():
            return out
        for f in sorted(self.dir.glob("*.json")):
            for n in self.list(f.stem):
                at = n["text"].lower().find(q)
                if at >= 0:
                    start = max(0, at - 30)
                    out.append({"run": f.stem, "id": n["id"], "excerpt": ("…" if start else "") + n["text"][start:start + 80].replace("\n", " ")})
        return out[:limit]

    def count(self, run_id: str) -> int:
        return len(self.list(run_id))

    def add(self, run_id: str, text: str, anchor: Any = None, by: str = "user", note_id: str | None = None, created: str | None = None) -> dict[str, Any]:
        text = self._text(text)
        stamp = now().isoformat(timespec="seconds")
        note = {"id": note_id or secrets.token_hex(6), "text": text, "created": created or stamp, "updated": stamp,
                "anchor": clean_anchor(anchor), "by": by if by in ("user", "agent") else "user"}
        with self._lock:
            notes = [n for n in self.list(run_id) if n["id"] != note["id"]]
            self._write(run_id, [*notes, note])
        return note

    def update(self, run_id: str, note_id: str, text: str) -> dict[str, Any]:
        text = self._text(text)
        with self._lock:
            notes = self.list(run_id)
            for n in notes:
                if n["id"] == note_id:
                    n["text"], n["updated"] = text, now().isoformat(timespec="seconds")
                    self._write(run_id, notes)
                    return n
        raise NoteNotFound(note_id)

    def delete(self, run_id: str, note_id: str) -> dict[str, Any]:
        with self._lock:
            notes = self.list(run_id)
            gone = next((n for n in notes if n["id"] == note_id), None)
            if gone is None:
                raise NoteNotFound(note_id)
            self._write(run_id, [n for n in notes if n["id"] != note_id])
        return gone

    @staticmethod
    def _text(text: Any) -> str:
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Die Notiz ist leer.")
        text = text.replace("\r\n", "\n").strip()
        if len(text) > MAX_TEXT:
            raise ValueError(f"Eine Notiz darf höchstens {MAX_TEXT} Zeichen haben (hier {len(text)}).")
        return text
