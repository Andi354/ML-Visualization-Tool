// The tools of the agent that act on the frame: tabs, Läufe view, the analysis area (feature C).
import { useEffect } from "preact/hooks";
import type { MutableRef } from "preact/hooks";
import { getRuns } from "../api";
import { getInstructions, putInstructions } from "./api";
import type { FrameAction, FrameState } from "../state/frame";
import { collectView, provide, provideView, setFrame, type Outcome } from "./bus";
import { problemSummary, reportFor, whenLoaded } from "../widgets/status";
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
      provide("set_instructions", async ({ text }) => {
        // the user has confirmed the card (in every mode); the old text comes back with Rückgängig
        const before = (await getInstructions()).text;
        const after = await putInstructions(String(text ?? ""));
        const summary = after ? `Projekt-Anweisungen gespeichert · ${after.length} Zeichen` : "Projekt-Anweisungen gelöscht";
        return {
          summary,
          undo: async () => {
            await putInstructions(before, after);
            return "Projekt-Anweisungen zurückgesetzt";
          },
          redo: async () => {
            await putInstructions(after, before);
            return summary;
          },
        };
      }),
      provide("open_analysis", ({ scope, runs }) => {
        const view = scope === "two" ? "two" : scope === "project" ? "project" : "run";
        const list = Array.isArray(runs) ? runs.map(String) : [];
        if (view === "two" && list.length < 2) throw new Error("Für „Zwei Läufe“ braucht es zwei Läufe");
        const title = { run: "Ein Lauf", two: "Zwei Läufe", project: "Projektverlauf" }[view];
        return change(`Analyse · ${title}`, "Analyse zurückgesetzt", [{ type: "show-analysis-view", view, runs: list }]).then(async (out) => {
          // the board of that view is drawn now: wait for its widgets and report how they came out
          const board = () => collectView().board as { scope?: string; widgets?: { id: string; type: string; label?: string }[] } | undefined;
          const widgets = () => board()?.widgets ?? [];
          const scope = { run: "run", two: "two-runs", project: "project" }[view];
          for (let i = 0; i < 100 && board()?.scope !== scope; i++) await new Promise((r) => setTimeout(r, 40)); // the board of that view is mounting
          await whenLoaded(() => widgets().map((w) => w.id), 5000, 100);
          const report = reportFor(widgets(), (t) => widgets().find((w) => w.type === t)?.label ?? t);
          const problems = problemSummary(report);
          return { ...out, summary: problems ? `${out.summary} · ${problems}` : out.summary, data: { widgets: report } };
        });
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
