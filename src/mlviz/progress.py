"""Progress and events of running runs (v0.3.0, feature D).

`run_progress(run, now, stall_min)` computes the numbers of one running run from its cells: done, planned, failed,
the rate (from `finished_at` of the last 50 cells, at most the last 2 hours), the remaining time and whether it
stalls. `ProgressWatcher` checks the runs every 10 s in the background and keeps the events the browser shows
(a run finished, many failed cells, a run stalls, a new run). It works in memory: a restart of the tool forgets the
events; the runs that are running then are the starting point and raise nothing.
"""

from __future__ import annotations

import json
import threading
import time
from collections import deque
from datetime import datetime, timedelta
from typing import Any, Callable

import pandas as pd

from .listing import group_best
from .project import Project, now as clock
from .runs import Run, list_runs

WINDOW_CELLS = 50
WINDOW = timedelta(hours=2)
#: fewer finished cells than this: no remaining time
MIN_CELLS_FOR_ETA = 5
ACTIVE = ("running", "stalled")
MAX_EVENTS = 200


def _times(run: Run) -> list[datetime]:
    c = run.cells
    if c.empty or "finished_at" not in c:
        return []
    ts = pd.to_datetime(c["finished_at"], errors="coerce", utc=False).dropna()
    return sorted(t.to_pydatetime().replace(tzinfo=None) for t in ts)


def _naive(t: datetime | None) -> datetime | None:
    return t.replace(tzinfo=None) if t else None


def run_progress(run: Run, now: datetime, stall_min: int = 30) -> dict[str, Any]:
    """The progress of one run; every number is None when it cannot be known."""
    now = _naive(now)
    times = _times(run)
    done = run.done_cells
    planned = run.planned_cells
    failed = run.error_count()
    last = times[-1] if times else None
    recent = [t for t in times if t >= now - WINDOW][-WINDOW_CELLS:]
    rate = None
    if len(recent) >= 2 and (recent[-1] - recent[0]).total_seconds() > 0:
        rate = (len(recent) - 1) / (recent[-1] - recent[0]).total_seconds() * 3600
    remaining_s = None
    if rate and planned is not None and len(times) >= MIN_CELLS_FOR_ETA:
        remaining_s = max(0, planned - done) / rate * 3600
    active = run.state in ACTIVE
    since = last or _naive(run.started)
    stalled_since = None
    if active and since is not None and now - since > timedelta(minutes=stall_min):
        stalled_since = since + timedelta(minutes=stall_min)
        remaining_s = None  # a stalled run has no time left to name
    return {
        "id": run.id,
        "name": run.name,
        "issue": run.issue,
        "short": run.short,
        "state": "stalled" if stalled_since else run.state,
        "cells_done": done,
        "cells_planned": planned,
        "cells_failed": failed,
        "rate_per_hour": round(rate, 1) if rate else None,
        "remaining": _iso_duration(remaining_s),
        "remaining_s": round(remaining_s) if remaining_s is not None else None,
        "eta": (now + timedelta(seconds=remaining_s)).isoformat(timespec="minutes") if remaining_s is not None else None,
        "last_cell_at": last.isoformat() if last else None,
        "stalled_since": stalled_since.isoformat() if stalled_since else None,
        "started": _naive(run.started).isoformat() if run.started else None,
    }


def _iso_duration(seconds: float | None) -> str | None:
    if seconds is None:
        return None
    s = int(round(seconds))
    h, rest = divmod(s, 3600)
    m, sec = divmod(rest, 60)
    return "PT" + (f"{h}H" if h else "") + (f"{m}M" if m else "") + (f"{sec}S" if sec or not (h or m) else "")


def last_error(run: Run) -> str | None:
    c = run.cells
    if c.empty or "error" not in c or "status" not in c:
        return None
    msgs = c.loc[c["status"] == "error", "error"].dropna()
    return str(msgs.iloc[-1]) if len(msgs) else None


def summary_prompt(project: Project, run: Run) -> str:
    """The question for the summary of a finished run: the facts are in the text, no tool is needed."""
    from . import aggregate

    table = aggregate.run_table(run, project, {})
    rows = [{"group": r["params"], "n": r["n"], "mean": {m: v["mean"] for m, v in list(r["metrics"].items())[:4]}} for r in table["rows"][:5]]
    facts: dict[str, Any] = {"run": run.id, "cells": run.done_cells, "failed": run.error_count(), "best": table["best"], "sorted_by": table["sort"], "top_groups": rows}
    metric = project.first_real_metric() or (project.metric(project.primary_metric or "") if project.primary_metric else None)
    if run.issue and metric is not None:
        before = [r for r in list_runs(project) if r.issue == run.issue and r.id != run.id and r.started and run.started and r.started < run.started and not r.problem]
        if before:
            prev = max(before, key=lambda r: r.started)
            facts["previous_run"] = {"run": prev.id, "best": group_best(prev, metric), "metric": metric.key}
    return (
        "Fasse den fertigen Lauf in höchstens drei kurzen Sätzen auf Deutsch zusammen: die besten Konfigurationen und, falls vorhanden, "
        "den Vergleich mit dem vorherigen Lauf desselben Issues. Antworte nur mit dem Text, ohne Überschrift und ohne Werkzeuge. "
        "Zahlen nur aus diesen Fakten:\n" + json.dumps(facts, ensure_ascii=False, default=str)
    )


class ProgressWatcher:
    def __init__(self, project: Project, settings, interval: float = 10, now: Callable[[], datetime] = clock):
        self.project = project
        self.settings = settings
        self.interval = interval
        self._now = now
        self._lock = threading.RLock()
        self._seen: dict[str, dict[str, Any]] = {}
        self._events: deque[dict[str, Any]] = deque(maxlen=MAX_EVENTS)
        self._next = 1
        self._runs: list[dict[str, Any]] = []
        self._first = True
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # --- background -------------------------------------------------------------------------------
    def ensure(self) -> None:
        """Starts the background check once (first look at the runs, then every `interval` seconds)."""
        with self._lock:
            if self._thread is not None:
                return
            self._thread = threading.Thread(target=self._loop, daemon=True, name="progress-watcher")
        self.poll()
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.wait(self.interval):
            try:
                self.poll()
            except Exception:  # a run folder that is being written must not stop the watcher
                time.sleep(0)

    # --- one check ---------------------------------------------------------------------------------
    def _event(self, kind: str, run: dict[str, Any] | Run, **data: Any) -> None:
        info = run if isinstance(run, dict) else {"id": run.id, "name": run.name, "short": run.short, "issue": run.issue}
        self._events.append({"id": self._next, "kind": kind, "at": self._now().isoformat(timespec="seconds"),
                             "run": info["id"], "name": info["name"], "short": info.get("short"), "issue": info.get("issue"), **data})
        self._next += 1

    def poll(self) -> None:
        stall_min = int(self.settings.get("runs.stallMin"))
        err_warn = int(self.settings.get("runs.errWarn"))
        now = self._now()
        runs = list_runs(self.project)
        active = [r for r in runs if r.state in ACTIVE and not r.problem]
        with self._lock:
            first, self._first = self._first, False
            current: list[dict[str, Any]] = []
            ids = {r.id for r in active}
            for r in active:
                p = run_progress(r, now, stall_min)
                current.append(p)
                seen = self._seen.get(r.id)
                if seen is None:
                    self._seen[r.id] = seen = {"warned": False, "stalled": False}
                    if not first:
                        self._event("started", r)
                planned = p["cells_planned"] or p["cells_done"] or 1
                share = p["cells_failed"] / planned * 100 if planned else 0
                if share >= err_warn and p["cells_failed"] and not seen["warned"]:
                    seen["warned"] = True
                    if not first:
                        self._event("errors", r, share=round(share, 1), failed=p["cells_failed"], message=last_error(r))
                if p["stalled_since"] and not seen["stalled"]:
                    seen["stalled"] = True
                    if not first:
                        self._event("stalled", r, since=p["stalled_since"], last_cell_at=p["last_cell_at"], minutes=stall_min)
                elif not p["stalled_since"]:
                    seen["stalled"] = False  # a new cell arrived: the next stall raises an event again
            by_id = {r.id: r for r in runs}
            for rid in [i for i in self._seen if i not in ids]:
                run = by_id.get(rid)
                self._seen.pop(rid)
                if run is not None and run.state == "finished":
                    self._event("finished", run, **self._finish_data(run))
            self._runs = current

    def _finish_data(self, run: Run) -> dict[str, Any]:
        best = None
        metric = self.project.first_real_metric() or (self.project.metric(self.project.primary_metric or "") if self.project.primary_metric else None)
        if metric is not None:
            value = group_best(run, metric)
            if value is not None:
                best = {"metric": metric.key, "label": metric.label, "unit": metric.unit, "scale": metric.scale, "value": value}
        started, ended = _naive(run.started), _naive(run.ended)
        return {
            "cells": run.done_cells,
            "failed": run.error_count(),
            "duration_s": int((ended - started).total_seconds()) if started and ended else None,
            "best": best,
        }

    # --- what the API hands out ----------------------------------------------------------------------
    def snapshot(self, since: int = 0) -> dict[str, Any]:
        with self._lock:
            return {
                "now": self._now().isoformat(timespec="seconds"),
                "runs": list(self._runs),
                "events": [e for e in self._events if e["id"] > since],
                "last_event": self._next - 1,
            }

    def progress_of(self, run: Run) -> dict[str, Any]:
        return run_progress(run, self._now(), int(self.settings.get("runs.stallMin")))
