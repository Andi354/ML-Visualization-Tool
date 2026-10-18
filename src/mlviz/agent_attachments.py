"""Images the user sends to the agent (v0.2.3, feature L).

An image is kept in `<project>/.mlviz/attachments/<hash>.<ext>` (named after its content, so the same image is kept once;
the files stay until someone deletes them). The message to `claude` names the file (`[Bild 1: .mlviz/attachments/…]`, a path
relative to the project folder the agent runs in) and the agent reads it with `Read`. The kind of an image is decided by its
first bytes, not by the name or the type the browser reports.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import re
from pathlib import Path

from .agent_store import STATE_DIR
from .project import Project

MAX_BYTES = 5 * 1024 * 1024
MAX_PER_MESSAGE = 4
MEDIA = {"png": "image/png", "jpg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}
FILE = re.compile(r"^[0-9a-f]{16}\.(png|jpg|gif|webp)$")


class AttachmentError(ValueError):
    """The image cannot be kept; the message is for the user."""


def sniff(data: bytes) -> str | None:
    """`png`, `jpg`, `gif` or `webp` by the first bytes, else None."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


class AttachmentStore:
    def __init__(self, project: Project):
        self.dir = project.root / STATE_DIR / "attachments"
        self.relative = f"{STATE_DIR}/attachments"

    def save(self, name: str, data_b64: str) -> dict:
        """Keeps an image sent as base64 and returns `{file, name, size}`."""
        try:
            data = base64.b64decode(data_b64, validate=True)
        except (binascii.Error, ValueError):
            raise AttachmentError("Das Bild ließ sich nicht lesen.")
        if not data:
            raise AttachmentError("Das Bild ist leer.")
        if len(data) > MAX_BYTES:
            raise AttachmentError(f"Das Bild ist größer als {MAX_BYTES // (1024 * 1024)} MB.")
        kind = sniff(data)
        if kind is None:
            raise AttachmentError("Das ist kein Bild, das der Agent lesen kann (PNG, JPEG, WebP oder GIF).")
        file = f"{hashlib.sha256(data).hexdigest()[:16]}.{kind}"
        self.dir.mkdir(parents=True, exist_ok=True)
        target = self.dir / file
        if not target.exists():
            tmp = target.with_suffix(".tmp")
            tmp.write_bytes(data)
            tmp.replace(target)
        return {"file": file, "name": re.sub(r"[\r\n]+", " ", str(name or "Bild")).strip()[:80] or "Bild", "size": len(data)}

    def path(self, file: str) -> Path | None:
        """The file of a kept image, None for a name that is not one of ours or a file that is gone."""
        if not FILE.match(str(file)):
            return None
        p = self.dir / file
        return p if p.is_file() else None

    def check(self, images: object) -> list[dict]:
        """The images of a message (`[{file, name}]`) validated against what is kept. Raises AttachmentError."""
        if images in (None, []):
            return []
        if not isinstance(images, list) or not all(isinstance(i, dict) for i in images):
            raise AttachmentError("images must be a list")
        if len(images) > MAX_PER_MESSAGE:
            raise AttachmentError(f"Höchstens {MAX_PER_MESSAGE} Bilder je Nachricht.")
        out = []
        for i in images:
            file = str(i.get("file") or "")
            if self.path(file) is None:
                raise AttachmentError(f"Das Bild {file or '?'} gibt es nicht (mehr).")
            out.append({"file": file, "name": re.sub(r"[\r\n]+", " ", str(i.get("name") or "Bild")).strip()[:80] or "Bild"})
        return out

    def lines(self, images: list[dict]) -> list[str]:
        """The lines for the message to `claude`: where each image lies, relative to the project folder."""
        return [f"[Bild {n}: {self.relative}/{i['file']}]" for n, i in enumerate(images, 1)]
