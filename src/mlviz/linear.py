"""Issue titles and status from Linear (optional, needs `LINEAR_API_KEY`) and local issue links."""

from __future__ import annotations

import os
import re
import time
from pathlib import Path

import httpx

from .project import Project

API = "https://api.linear.app/graphql"
TTL_SECONDS = 300
_ID = re.compile(r"^[A-Za-z][A-Za-z0-9]*-\d+$")
_cache: dict[str, tuple[float, dict]] = {}


def api_key() -> str:
    return os.environ.get("LINEAR_API_KEY", "").strip()


def fetch_linear(ids: list[str], key: str, client: httpx.Client | None = None) -> dict[str, dict]:
    """Title, status and URL for issue identifiers. Network or API errors yield an empty result."""
    wanted = [i for i in dict.fromkeys(ids) if _ID.match(i)]
    out: dict[str, dict] = {}
    stale: list[str] = []
    for i in wanted:
        hit = _cache.get(i)
        if hit and time.monotonic() - hit[0] < TTL_SECONDS:
            out[i] = hit[1]
        else:
            stale.append(i)
    if not stale or not key:
        return out
    fields = "identifier title url state { name type }"
    query = "query { " + " ".join(f'i{n}: issue(id: "{i}") {{ {fields} }}' for n, i in enumerate(stale)) + " }"
    own = client is None
    client = client or httpx.Client(timeout=5.0)
    try:
        r = client.post(API, json={"query": query}, headers={"Authorization": key})
        r.raise_for_status()
        data = (r.json() or {}).get("data") or {}
    except (httpx.HTTPError, ValueError):
        return out
    finally:
        if own:
            client.close()
    for n, i in enumerate(stale):
        node = data.get(f"i{n}")
        if not node:
            continue
        info = {
            "title": node.get("title"),
            "url": node.get("url"),
            "status": (node.get("state") or {}).get("name"),
            "status_type": (node.get("state") or {}).get("type"),
        }
        _cache[i] = (time.monotonic(), info)
        out[i] = info
    return out


def clear_cache() -> None:
    _cache.clear()


def local_links(project: Project, issue: str) -> dict[str, str | None]:
    """Analysis folder (`analysis/<ISSUE>_*`) and deliverable folder of an issue, project-relative.

    A deliverable folder belongs to an issue when its name contains the issue ID or its
    `README.md` mentions it.
    """
    analysis = None
    base = project.path("analysis")
    if base.is_dir():
        for d in sorted(base.iterdir()):
            if d.is_dir() and (d.name == issue or d.name.startswith(issue + "_")):
                analysis = str(d.relative_to(project.root))
                break
    deliverable = None
    base = project.path("deliverables")
    if base.is_dir():
        for d in sorted(base.iterdir()):
            if not d.is_dir():
                continue
            readme = d / "README.md"
            try:
                mentions = readme.is_file() and issue in readme.read_text(errors="ignore")
            except OSError:
                mentions = False
            if issue in d.name or mentions:
                deliverable = str(d.relative_to(project.root))
                break
    return {"analysis": analysis, "deliverable": deliverable}


def issues_payload(project: Project, ids: list[str], client: httpx.Client | None = None) -> dict[str, dict]:
    key = api_key()
    remote = fetch_linear(ids, key, client) if key else {}
    return {i: {**remote.get(i, {}), **local_links(project, i)} for i in dict.fromkeys(ids)}
