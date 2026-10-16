// The tools of the agent that act on the frame: tabs, Läufe view, the analysis area (feature C).
import { useEffect } from "preact/hooks";
import type { MutableRef } from "preact/hooks";
import { getRuns } from "../api";
import type { FrameAction, FrameState } from "../state/frame";
import { provide, provideView, setFrame, type Outcome } from "./bus";
import { glow, settled } from "./commands";

const short = (run: string) => run.replace(/^\d{4}-\d{2}-\d{2}_\d{4,6}_/, "");

/** Provides the frame tools while the frame is mounted. `latest` mirrors the frame state. */
export function useFrameTools(latest: MutableRef<FrameState>, dispatch: (a: FrameAction) => void) {
  useEffect(() => {
    /** Applies actions and returns an outcome that goes back to the state before and forward to the state after. */
    const change = async (summary: string, undoText: string, actions: FrameAction[], glowSelector?: string): Promise<Outcome> => {
      const before = latest.current;
      actions.forEach(dispatch);
      await settled();
      const after = latest.current;
      if (glowSelector) glow(glowSelector);
      return {
        summary,
        undo: () => {
          dispatch({ type: "restore", state: before });
          return undoText;
        },
        redo: () => {
          dispatch({ type: "restore", state: after });
          return summary;
        },
      };
    };
    const runName = async (id: string) => (await getRuns().catch(() => [])).find((r) => r.id === id)?.name ?? short(id);

    const offs = [
      provide("open_run", async ({ run }) => {
        const name = await runName(String(run));
        return change(`Tab geöffnet · ${name}`, `Tab geschlossen · ${name}`, [{ type: "open-run", run: String(run) }], `[data-testid="tab-run"][title="${run}"]`);
      }),
      provide("focus_tab", async ({ run }) => {
        if (run === "pinned") return change("Fester Tab fokussiert", "Fokus zurückgesetzt", [{ type: "focus-pinned" }]);
        if (!latest.current.tabs.includes(String(run))) throw new Error("Dieser Lauf ist nicht als Tab geöffnet");
        const name = await runName(String(run));
        return change(`Tab fokussiert · ${name}`, "Fokus zurückgesetzt", [{ type: "focus-run", run: String(run) }]);
      }),
      provide("close_tab", async ({ run }) => {
        if (!latest.current.tabs.includes(String(run))) throw new Error("Dieser Lauf ist nicht als Tab geöffnet");
        const name = await runName(String(run));
        return change(`Tab geschlossen · ${name}`, `Tab wieder geöffnet · ${name}`, [{ type: "close-run", run: String(run) }]);
      }),
      provide("show_runs", ({ view }) => {
        const v = view === "issues" ? "issues" : "list";
        return change(`Läufe · ${v === "issues" ? "Issues" : "Liste"}`, "Läufe-Ansicht zurückgesetzt", [{ type: "select-area", area: "runs" }, { type: "set-runs-view", view: v }]);
      }),
      provide("open_analysis", ({ scope, runs }) => {
        const view = scope === "two" ? "two" : scope === "project" ? "project" : "run";
        const list = Array.isArray(runs) ? runs.map(String) : [];
        if (view === "two" && list.length < 2) throw new Error("Für „Zwei Läufe“ braucht es zwei Läufe");
        const title = { run: "Ein Lauf", two: "Zwei Läufe", project: "Projektverlauf" }[view];
        return change(`Analyse · ${title}`, "Analyse zurückgesetzt", [{ type: "show-analysis-view", view, runs: list }]);
      }),
    ];
    setFrame({
      async showAnalysis() {
        const f = latest.current;
        if (f.area === "analysis" && f.active === null) return;
        dispatch({ type: "select-area", area: "analysis" });
        await settled();
      },
    });
    const offView = provideView("frame", () => {
      const f = latest.current;
      return { area: f.area, runs_view: f.runsView, tabs: f.tabs, focused_tab: f.active ?? "pinned", compare: f.compare };
    });
    return () => {
      offs.forEach((o) => o());
      offView();
      setFrame(null);
    };
  }, [latest, dispatch]);
}
