// Carries out the commands of the agent in the open tool and reports the result (feature C).
import { collectView, getFrame, handlerFor, rememberUndo, waitForHandler, type Outcome } from "./bus";

/** Tools that act on the board of the analysis: the analysis area is shown first. */
export const BOARD_TOOLS = new Set([
  "add_widget",
  "remove_widget",
  "configure_widget",
  "move_widget",
  "resize_widget",
  "apply_template",
  "save_template",
  "draft_widget",
  "keep_draft",
  "save_deliverable",
]);

export interface Command {
  id: string;
  tool: string;
  args: Record<string, unknown>;
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});

/** Runs one tool in the views. Throws an Error with a German message the agent can act on. */
export async function runTool(tool: string, args: Record<string, unknown>): Promise<Outcome> {
  if (tool === "get_view") return { data: collectView() };
  if (tool === "set_run_view") {
    const run = String(args.run);
    await handlerFor("open_run")?.({ run }); // the tab of the run is shown (and opened if needed)
    return (await (await waitForHandler(`set_run_view:${run}`))(args)) ?? {};
  }
  if (BOARD_TOOLS.has(tool)) await getFrame()?.showAnalysis();
  const handler = handlerFor(tool) ?? (BOARD_TOOLS.has(tool) || tool === "set_run_view" ? await waitForHandler(tool) : undefined);
  if (!handler) throw new Error(`Das Werkzeug ${tool} gibt es in dieser Ansicht nicht`);
  return (await handler(args)) ?? {};
}

/** A command from the agent: do it, remember how to undo it, and tell the tool. */
export async function carryOut(cmd: Command): Promise<void> {
  try {
    const out = await runTool(cmd.tool, cmd.args);
    if (out.undo) rememberUndo(cmd.id, { undo: out.undo, redo: out.redo });
    await post(`/api/agent/commands/${cmd.id}/result`, { ok: true, summary: out.summary, data: out.data, undoable: !!out.undo });
  } catch (e) {
    await post(`/api/agent/commands/${cmd.id}/result`, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Lets the element that matches `selector` glow for about 1.5 s (after the view has drawn it). */
export function glow(selector: string): void {
  setTimeout(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add("agent-glow");
    setTimeout(() => el.classList.remove("agent-glow"), 1500);
  }, 120);
}

/** Next tick of the views: state set by a dispatch has been drawn (and the refs that mirror it are current). */
export const settled = () => new Promise<void>((r) => setTimeout(r, 60));
