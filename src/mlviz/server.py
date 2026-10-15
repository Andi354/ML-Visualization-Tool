"""HTTP API and static frontend."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import aggregate, linear
from .listing import merkmal_candidates, run_listing
from .project import Project
from .runs import get_run, list_runs

STATIC = Path(__file__).parent / "static"


def create_app(project_root: Path | str | None = None) -> FastAPI:
    root = project_root or os.environ.get("MLVIZ_PROJECT") or "."
    project = Project.load(root)
    app = FastAPI(title="ML Visualization Tool")
    app.state.project = project

    @app.get("/api/project")
    def api_project() -> dict:
        return {**project.to_json(), "linear": bool(linear.api_key())}

    @app.get("/api/runs")
    def api_runs() -> list[dict]:
        runs = list_runs(project)
        candidates = merkmal_candidates(runs)
        return [run_listing(project, r, candidates) for r in runs]

    @app.get("/api/issues")
    def api_issues() -> dict:
        """Title, status and links per issue ID found in the runs (titles only with a Linear key)."""
        ids = sorted({r.issue for r in list_runs(project) if r.issue})
        return linear.issues_payload(project, ids)

    @app.get("/api/runs/{run_id}")
    def api_run(run_id: str) -> dict:
        run = get_run(project, run_id)
        if run is None:
            raise HTTPException(404, "run not found")
        return run.info()

    def _run_or_404(run_id: str):
        run = get_run(project, run_id)
        if run is None:
            raise HTTPException(404, "run not found")
        return run

    @app.get("/api/runs/{run_id}/dims")
    def api_dims(run_id: str) -> dict:
        """Dimensions (axes, replicates, channels) with value counts, and the constant parameters."""
        return aggregate.run_dims(_run_or_404(run_id))

    @app.post("/api/runs/{run_id}/table")
    def api_table(run_id: str, query: dict = Body(default_factory=dict)) -> dict:
        """Group table under the given averaging, filters and sorting."""
        return aggregate.run_table(_run_or_404(run_id), project, query)

    if STATIC.is_dir():
        app.mount("/assets", StaticFiles(directory=STATIC / "assets"), name="assets")

        @app.get("/{path:path}")
        def spa(path: str) -> FileResponse:
            if path == "api" or path.startswith("api/"):
                raise HTTPException(404, "not found")
            candidate = (STATIC / path).resolve()
            if path and candidate.is_file() and STATIC.resolve() in candidate.parents:
                return FileResponse(candidate)
            return FileResponse(STATIC / "index.html")

    return app
