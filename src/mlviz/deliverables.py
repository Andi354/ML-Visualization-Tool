"""Saving widget images as deliverables and browsing target folders (feature G).

The tool writes only below the project folder, never into the run folder (`runs/`) and never into
hidden folders such as `.git`. Existing files are not overwritten unless asked for explicitly.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import re
from pathlib import Path

from .project import Project

PNG = b"\x89PNG\r\n\x1a\n"
_BAD = re.compile(r"[^\w .+()\-]", re.UNICODE)


class SaveError(Exception):
    def __init__(self, status: int, message: str, detail: list[str] | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.detail = detail or []


def _inside(project: Project, rel: str) -> Path:
    """A project-relative folder path, resolved and checked against escaping the project."""
    if not rel or rel.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", rel):
        raise SaveError(400, "Der Zielordner muss ein Pfad im Projekt sein")
    parts = [p for p in re.split(r"[\\/]+", rel) if p not in ("", ".")]
    if not parts or any(p == ".." or p.startswith(".") for p in parts):
        raise SaveError(400, "Ungültiger Zielordner")
    path = project.root.joinpath(*parts).resolve()
    if project.root not in path.parents:
        raise SaveError(400, "Der Zielordner liegt außerhalb des Projekts")
    runs = project.path("runs").resolve()
    if path == runs or runs in path.parents:
        raise SaveError(400, "In den Ordner der Läufe wird nichts geschrieben")
    return path


def safe_name(name: str) -> str:
    stem = _BAD.sub("_", Path(str(name)).name).strip(" .") or "bild"
    return stem if stem.lower().endswith(".png") else stem + ".png"


def list_dirs(project: Project, rel: str = "") -> dict:
    """Sub-folders of a project folder, for the folder picker."""
    base = project.root
    if rel:
        parts = [p for p in re.split(r"[\\/]+", rel) if p not in ("", ".")]
        if any(p == ".." for p in parts):
            raise SaveError(400, "Ungültiger Pfad")
        base = project.root.joinpath(*parts).resolve()
        if base != project.root and project.root not in base.parents:
            raise SaveError(400, "Der Pfad liegt außerhalb des Projekts")
    if not base.is_dir():
        raise SaveError(404, "Ordner nicht gefunden")
    runs = project.path("runs").resolve()
    dirs = sorted(
        d.name for d in base.iterdir() if d.is_dir() and not d.name.startswith(".") and d.resolve() != runs and d.name != "node_modules"
    )
    here = "" if base == project.root else str(base.relative_to(project.root))
    parent = None if base == project.root else ("" if base.parent == project.root else str(base.parent.relative_to(project.root)))
    return {"path": here, "parent": parent, "dirs": dirs}


def save(project: Project, payload: dict, run_lookup) -> dict:
    target = _inside(project, str(payload.get("target") or ""))
    files = payload.get("files") or []
    if not files:
        raise SaveError(400, "Keine Bilder zum Speichern")
    decoded: list[tuple[str, bytes, str | None]] = []
    used: set[str] = set()
    for f in files:
        raw = str(f.get("data") or "")
        raw = raw.split(",", 1)[1] if raw.startswith("data:") else raw
        try:
            data = base64.b64decode(raw, validate=True)
        except (binascii.Error, ValueError):
            raise SaveError(400, "Ein Bild ist kein gültiges Base64")
        if not data.startswith(PNG):
            raise SaveError(400, "Ein Bild ist keine PNG-Datei")
        name = safe_name(f.get("name") or "bild")
        if name.lower() in used:
            raise SaveError(400, f"Der Dateiname {name} kommt doppelt vor")
        used.add(name.lower())
        decoded.append((name, data, f.get("title")))

    configs: list[tuple[str, Path]] = []
    for rid in payload.get("configs") or []:
        run = run_lookup(rid)
        if run is not None and (run.path / "config.yaml").is_file():
            configs.append((f"configs/{safe_name(run.id)[:-4]}.yaml", run.path / "config.yaml"))

    readme = target / "README.md"
    targets = [target / n for n, _, _ in decoded] + [target / rel for rel, _ in configs] + [readme]
    clashes = [str(p.relative_to(target)) for p in targets if p.exists()]
    if clashes and not payload.get("overwrite"):
        raise SaveError(409, "Dateien existieren schon", clashes)

    target.mkdir(parents=True, exist_ok=True)
    for name, data, _ in decoded:
        (target / name).write_bytes(data)
    for rel, src in configs:
        (target / rel).parent.mkdir(parents=True, exist_ok=True)
        (target / rel).write_bytes(src.read_bytes())

    title = str(payload.get("title") or target.name)
    lines = [f"# {title}", ""]
    if payload.get("issue"):
        lines += [f"Issue: {payload['issue']}", ""]
    runs = [r for r in payload.get("runs") or []]
    if runs:
        lines += ["Läufe: " + ", ".join(f"`{r}`" for r in runs), ""]
    lines += ["| Datei | Titel |", "|---|---|"] + [f"| `{n}` | {t or ''} |" for n, _, t in decoded]
    readme.write_text("\n".join(lines) + "\n")
    rel_target = str(target.relative_to(project.root))
    written = [n for n, _, _ in decoded] + [rel for rel, _ in configs] + ["README.md"]
    return {
        "path": rel_target,
        "files": [n for n, _, _ in decoded],
        "configs": [rel for rel, _ in configs],
        "readme": "README.md",
        # what was written, to take it back later only if nobody has touched it since
        "hashes": {name: _sha(target / name) for name in written},
    }


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def undo(project: Project, rel: str, hashes: dict[str, str]) -> dict:
    """Takes back a save: deletes the files that still are what was written; changed or moved files stay.
    Returns `{deleted, kept, folder_removed}`. The folder goes only when it is empty afterwards."""
    target = _inside(project, rel)
    deleted: list[str] = []
    kept: list[str] = []
    for name, digest in hashes.items():
        path = (target / name).resolve()
        if target not in path.parents:  # a name that leaves the folder is never touched
            kept.append(name)
            continue
        if not path.is_file():
            continue
        if _sha(path) == digest:
            path.unlink()
            deleted.append(name)
        else:
            kept.append(name)
    for sub in sorted((p for p in target.rglob("*") if p.is_dir()), reverse=True):
        try:
            sub.rmdir()
        except OSError:
            pass
    removed = False
    try:
        target.rmdir()
        removed = True
    except OSError:
        pass
    return {"deleted": deleted, "kept": kept, "folder_removed": removed}
