"""HTTP API and static frontend."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import Body, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import json

from . import aggregate, configview, deliverables, linear, widgets
from . import own_widgets, templates
from . import agent_attachments, agent_run
from .agent_attachments import AttachmentError
from .agent_store import MAX_INSTRUCTIONS, AgentStore, ChatNotFound, InstructionsChanged
from .store import StoreError
from .listing import merkmal_candidates, run_listing
from .project import Project, now
from .descriptions import describe
from .runs import get_run, list_runs

STATIC = Path(__file__).parent / "static"


def create_app(project_root: Path | str | None = None) -> FastAPI:
    root = project_root or os.environ.get("MLVIZ_PROJECT") or "."
    project = Project.load(root)
    app = FastAPI(title="ML Visualization Tool")
    app.state.project = project

    @app.exception_handler(StoreError)
    def store_error(_, e: StoreError) -> JSONResponse:
        """ds-store could not read a run (missing package, `store_version` too new): say it plainly."""
        return JSONResponse({"detail": str(e), "store_error": True}, status_code=409)

    @app.get("/api/project")
    def api_project() -> dict:
        return {**project.to_json(), "linear": bool(linear.api_key())}

    @app.get("/api/runs")
    def api_runs() -> list[dict]:
        runs = list_runs(project)
        candidates = merkmal_candidates(runs)
        feature, metric = agent.settings.get("runs.feature"), agent.settings.get("runs.metric")
        return [run_listing(project, r, candidates, feature, metric) for r in runs]

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

    @app.get("/api/runs/{run_id}/description")
    def api_run_description(run_id: str) -> dict:
        """The description of a run (`null` for a run without one), see `descriptions.py`."""
        run = get_run(project, run_id)
        if run is None:
            raise HTTPException(404, "run not found")
        return {"description": describe(project, run)}

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

    @app.get("/api/runs/{run_id}/config")
    def api_config(run_id: str, combo: str | None = None) -> dict:
        """Resolved config for the config view; `combo` (JSON `{axis: value}`) selects a combination."""
        chosen: dict[str, str] = {}
        if combo:
            try:
                parsed = json.loads(combo)
            except ValueError:
                raise HTTPException(400, "combo must be JSON")
            if isinstance(parsed, dict):
                chosen = {str(k): str(v) for k, v in parsed.items()}
        return configview.run_config(project, _run_or_404(run_id), chosen)

    @app.get("/api/widgets/catalog")
    def api_widget_catalog(scope: str | None = None) -> list[dict]:
        """The widget catalog: key, label, question, scopes, settings."""
        return widgets.catalog(scope)

    @app.post("/api/widgets/{key}")
    def api_widget(key: str, request: dict = Body(default_factory=dict)) -> dict:
        """Data of one widget for a scope: `{run, combo, settings}` (more scopes follow)."""
        try:
            return widgets.compute(project, key, request)
        except KeyError:
            raise HTTPException(404, "unknown widget")
        except LookupError:
            raise HTTPException(404, "run not found")

    # --- agent (chats and settings, stored in <project>/.mlviz/) -------------------------------
    agent = AgentStore(project)
    runner = agent_run.AgentRunner(project, agent)
    app.state.agent_runner = runner

    def _chat_or_404(chat_id: str) -> dict:
        try:
            return agent.get(chat_id)
        except ChatNotFound:
            raise HTTPException(404, "chat not found")

    @app.get("/api/agent")
    def api_agent() -> dict:
        """Chats of the project (newest first, without messages) and the mode of the agent."""
        return {"chats": agent.list(), "mode": agent.mode(), "debug": agent.debug(), "now": now().isoformat(), "limits": runner.limits}

    @app.post("/api/agent/chats")
    def api_agent_new_chat(payload: dict = Body(default_factory=dict)) -> dict:
        return agent.create(str(payload.get("title") or ""))

    @app.get("/api/agent/chats/{chat_id}")
    def api_agent_chat(chat_id: str) -> dict:
        return _chat_or_404(chat_id)

    @app.post("/api/agent/chats/{chat_id}/messages")
    def api_agent_message(chat_id: str, payload: dict = Body(...)) -> dict:
        """Appends a message of the user to the chat (the connection to Claude Code follows in F)."""
        text = str(payload.get("text") or "").strip()
        if not text:
            raise HTTPException(400, "text is empty")
        _chat_or_404(chat_id)
        return agent.append(chat_id, "user", text)

    @app.get("/api/agent/setup")
    def api_agent_setup() -> dict:
        """Can the agent run here? (Claude Code found and logged in; warning if an API key is set.)"""
        return agent_run.setup_check(agent.settings.get("agent.claude") or None)

    @app.post("/api/agent/chats/{chat_id}/run")
    def api_agent_run(chat_id: str, request: Request, payload: dict = Body(...)) -> StreamingResponse:
        """Sends a message to the agent; the answer streams back as server-sent events (`data: {chat, busy, limits}`)."""
        text = str(payload.get("text") or "").strip()
        resend = bool(payload.get("resend"))
        try:
            images = runner.attachments.check(payload.get("images"))
        except AttachmentError as e:
            raise HTTPException(400, str(e))
        if not text and not images:
            raise HTTPException(400, "text is empty")
        _chat_or_404(chat_id)  # 404 if there is no such chat
        if runner.running(chat_id):
            raise HTTPException(409, "the chat is already working")

        def events():
            try:
                for snap in runner.run(chat_id, text, str(payload.get("context") or ""), resend, base_url=f"http://127.0.0.1:{request.url.port or 80}", images=images):
                    yield f"data: {json.dumps(snap, ensure_ascii=False)}\n\n"
            except agent_run.Busy:
                yield f"data: {json.dumps({'error': 'busy'})}\n\n"

        return StreamingResponse(events(), media_type="text/event-stream", headers={"cache-control": "no-cache"})

    @app.post("/api/agent/attachments")
    def api_agent_attachment(payload: dict = Body(...)) -> dict:
        """Keeps an image for the agent (`{name, data}` with base64 data); answers `{file, name, size, url}`."""
        try:
            kept = runner.attachments.save(str(payload.get("name") or ""), str(payload.get("data") or ""))
        except AttachmentError as e:
            raise HTTPException(400, str(e))
        return {**kept, "url": f"/api/agent/attachments/{kept['file']}"}

    @app.get("/api/agent/attachments/{file}")
    def api_agent_attachment_file(file: str) -> FileResponse:
        path = runner.attachments.path(file)
        if path is None:
            raise HTTPException(404, "image not found")
        return FileResponse(path, media_type=agent_attachments.MEDIA[path.suffix[1:]], headers={"cache-control": "private, max-age=86400"})

    @app.post("/api/agent/chats/{chat_id}/compact")
    def api_agent_compact(chat_id: str) -> StreamingResponse:
        """Compacts the session of a chat (`/compact`); streams snapshots like `run`."""
        chat = _chat_or_404(chat_id)
        if not chat.get("session_id"):
            raise HTTPException(400, "the chat has no session yet")
        if runner.running(chat_id):
            raise HTTPException(409, "the chat is already working")

        def events():
            try:
                for snap in runner.compact(chat_id):
                    yield f"data: {json.dumps(snap, ensure_ascii=False)}\n\n"
            except agent_run.Busy:
                yield f"data: {json.dumps({'error': 'busy'})}\n\n"

        return StreamingResponse(events(), media_type="text/event-stream", headers={"cache-control": "no-cache"})

    @app.post("/mcp/{chat_id}")
    def mcp_post(chat_id: str, message: dict = Body(...), authorization: str | None = Header(None)) -> Response:
        """The MCP server of the tool (JSON-RPC over HTTP), for the `claude` the tool started; the secret of this start is required."""
        if not runner.authorised(authorization):
            raise HTTPException(401, "unauthorised")
        reply = runner.handle_mcp(chat_id, message)
        if reply is None:
            return Response(status_code=202)
        return JSONResponse(reply)

    @app.get("/mcp/{chat_id}")
    def mcp_get(chat_id: str) -> Response:
        return Response(status_code=405)  # no server-initiated stream

    @app.post("/api/agent/commands/{cid}/result")
    def api_agent_command_result(cid: str, payload: dict = Body(...)) -> dict:
        """The open tool reports a command of the agent: `{ok, summary?, data?, error?, undoable?}`."""
        return {"accepted": runner.answer(cid, {**payload, "ok": bool(payload.get("ok"))})}

    @app.post("/api/agent/commands/{cid}/decision")
    def api_agent_command_decision(cid: str, payload: dict = Body(...)) -> dict:
        """A click on a confirmation card (`{approve}`) or a run card (`{choice}`)."""
        return {"accepted": runner.answer(cid, {"approve": bool(payload.get("approve")), "choice": payload.get("choice")})}

    @app.post("/api/agent/chats/{chat_id}/actions/{cid}")
    def api_agent_action(chat_id: str, cid: str, payload: dict = Body(...)) -> dict:
        """After Rückgängig / Wiederholen in the browser: the action line shows its new state (`done`, `reverted`)."""
        state = payload.get("state")
        if state not in ("done", "reverted"):
            raise HTTPException(400, "state must be done or reverted")
        try:
            return agent.set_action(chat_id, cid, state=state, t=str(payload.get("text") or ""))
        except ChatNotFound:
            raise HTTPException(404, "action not found")

    @app.post("/api/agent/chats/{chat_id}/stop")
    def api_agent_stop(chat_id: str) -> dict:
        return {"stopped": runner.stop(chat_id)}

    @app.put("/api/agent/mode")
    def api_agent_mode(payload: dict = Body(...)) -> dict:
        try:
            return {"mode": agent.set_mode(str(payload.get("mode")))}
        except ValueError as e:
            raise HTTPException(400, str(e))

    @app.get("/api/settings")
    def api_settings() -> dict:
        """The settings of the project (`.mlviz/settings.json`): values that differ from the default, the defaults, a warning."""
        return agent.settings.payload(project)

    @app.put("/api/settings")
    def api_settings_change(payload: dict = Body(...)) -> dict:
        """Changes settings in one write: `{set: {key: value}, unset: [key]}`; 400 (nothing written) for an unknown key or unusable value."""
        set_, unset = payload.get("set") or {}, payload.get("unset") or []
        if not isinstance(set_, dict) or not isinstance(unset, list):
            raise HTTPException(400, "set must be an object and unset a list")
        try:
            agent.settings.change(set_, unset)
        except ValueError as e:
            raise HTTPException(400, str(e))
        return agent.settings.payload(project)

    @app.delete("/api/agent/chats")
    def api_agent_delete_chats() -> dict:
        """Deletes every chat of the project (Einstellungen › Agent); settings and instructions stay."""
        if any(runner.running(c["id"]) for c in agent.list()):
            raise HTTPException(409, "a chat is still working")
        return {"deleted": agent.delete_all()}

    @app.get("/api/agent/instructions")
    def api_agent_instructions() -> dict:
        """The instructions of the project for the agent (the text of `.mlviz/agent_instructions.md`)."""
        return {"text": agent.instructions().strip("\n"), "max": MAX_INSTRUCTIONS}

    @app.put("/api/agent/instructions")
    def api_agent_set_instructions(payload: dict = Body(...)) -> dict:
        """Replaces the instructions: `{text, expect?}`; with `expect` only if they still are that text (409 otherwise)."""
        expect = payload.get("expect")
        try:
            return {"text": agent.set_instructions(payload.get("text"), expect if isinstance(expect, str) else None), "max": MAX_INSTRUCTIONS}
        except InstructionsChanged as e:
            raise HTTPException(409, str(e))
        except ValueError as e:
            raise HTTPException(400, str(e))

    @app.put("/api/agent/debug")
    def api_agent_debug(payload: dict = Body(...)) -> dict:
        return {"debug": agent.set_debug(payload.get("on") is True)}

    # --- own widgets (descriptions kept in <project>/.mlviz/widgets/) ------------------------------
    widget_store = own_widgets.OwnWidgetStore(project)

    @app.get("/api/own-widgets")
    def api_own_widgets(scope: str | None = None) -> list[dict]:
        """Kept own widgets as catalog entries (with `definition`), optionally of one catalog scope."""
        out = []
        for d in widget_store.list():
            entry = own_widgets.catalog_entry(d)
            if scope is None or scope in entry["scopes"]:
                out.append({**entry, "definition": d})
        return out

    @app.post("/api/own-widgets/validate")
    def api_own_widgets_validate(payload: dict = Body(...)) -> dict:
        return {"errors": own_widgets.validate(payload.get("definition"))}

    @app.post("/api/own-widgets")
    def api_own_widgets_keep(payload: dict = Body(...)) -> dict:
        """Keeps a description under its name (an existing name is overwritten); 400 with the reasons if invalid."""
        try:
            d = widget_store.save(payload.get("definition"))
        except own_widgets.OwnWidgetError as e:
            raise HTTPException(400, {"errors": e.errors})
        return {**own_widgets.catalog_entry(d), "definition": d}

    @app.delete("/api/own-widgets/{slug}")
    def api_own_widgets_delete(slug: str) -> dict:
        try:
            widget_store.delete(slug)
        except KeyError:
            raise HTTPException(404, "widget not found")
        return {"deleted": slug}

    # --- templates of analysis boards (<project>/.mlviz/templates.json) ------------------------------
    template_store = templates.TemplateStore(project)

    @app.get("/api/templates")
    def api_templates(scope: str | None = None) -> list[dict]:
        """Stored templates (the built-in Standard of each scope is not among them), by name."""
        return template_store.list(scope)

    @app.post("/api/templates")
    def api_template_save(payload: dict = Body(...)) -> dict:
        """Saves a board as a template: `{scope, name, widgets: [{type, settings, width}]}`; the same name overwrites."""
        try:
            return template_store.save(str(payload.get("scope")), str(payload.get("name") or ""), payload.get("widgets"))
        except templates.TemplateError as e:
            raise HTTPException(400, str(e))

    @app.post("/api/templates/used")
    def api_template_used(payload: dict = Body(...)) -> dict:
        """Notes the runs a template was applied to (`last_used`)."""
        try:
            return template_store.mark_used(str(payload.get("scope")), str(payload.get("name") or ""), list(payload.get("runs") or []))
        except KeyError:
            raise HTTPException(404, "template not found")

    @app.post("/api/templates/delete")
    def api_template_delete(payload: dict = Body(...)) -> dict:
        try:
            template_store.delete(str(payload.get("scope")), str(payload.get("name") or ""))
        except templates.TemplateError as e:
            raise HTTPException(400, str(e))
        except KeyError:
            raise HTTPException(404, "template not found")
        return {"deleted": payload.get("name")}

    @app.get("/api/folders")
    def api_folders(path: str = "") -> dict:
        """Sub-folders of a project folder (for choosing the target of a deliverable)."""
        try:
            return deliverables.list_dirs(project, path)
        except deliverables.SaveError as e:
            raise HTTPException(e.status, e.message)

    @app.post("/api/deliverables")
    def api_deliverables(payload: dict = Body(...)) -> dict:
        """Write widget images (base64 PNG) into a project folder; refuses to overwrite by default."""
        try:
            return deliverables.save(project, payload, lambda rid: get_run(project, rid))
        except deliverables.SaveError as e:
            raise HTTPException(e.status, {"message": e.message, "conflicts": e.detail})

    @app.post("/api/deliverables/undo")
    def api_deliverables_undo(payload: dict = Body(...)) -> dict:
        """Takes back a save of the agent: deletes the files that still are what was written (by hash)."""
        try:
            return deliverables.undo(project, str(payload.get("path") or ""), dict(payload.get("hashes") or {}))
        except deliverables.SaveError as e:
            raise HTTPException(e.status, {"message": e.message})

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
