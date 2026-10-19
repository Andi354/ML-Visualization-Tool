import { useCallback, useEffect, useReducer, useRef, useState } from "preact/hooks";
import { getProject, getRuns, getTemplates, type ProjectInfo, type RunRow } from "./api";
import { IconBar } from "./frame/IconBar";
import { TabMenu } from "./frame/TabMenu";
import { TabStrip } from "./frame/TabStrip";
import { AgentLayer } from "./agent/AgentLayer";
import { useFrameTools } from "./agent/frameTools";
import { contextLabel } from "./agent/model";
import { loadAgent, saveAgent, toggleFromIcon } from "./agent/state";
import { SETTINGS_TAB, frameReducer, type FrameState, initialFrame, loadFrame, saveFrame } from "./state/frame";
import { SettingsView } from "./settings/SettingsView";
import { load as loadSettings, nudgeScale, requestFocus } from "./settings/store";
import { handlerFor } from "./agent/bus";
import { StatusBar } from "./progress/StatusBar";
import { Palette, type Request as PaletteRequest } from "./palette/Palette";
import { shortcutFor, type Ctx } from "./palette/commands";
import { AnalysisView } from "./views/AnalysisView";
import { RunsView } from "./views/RunsView";
import { RunTab } from "./views/RunTab";

export function App() {
  const [project, setProject] = useState<ProjectInfo | null>(null);
  useEffect(() => {
    getProject().then(setProject);
  }, []);
  if (!project) return <div class="placeholder" />;
  return <Frame project={project} />;
}

function Frame({ project }: { project: ProjectInfo }) {
  const [frame, dispatch] = useReducer(frameReducer, project.name, (name) => loadFrame(name) ?? initialFrame);
  const latest = useRef(frame);
  latest.current = frame;
  useFrameTools(latest, dispatch);
  useEffect(() => {
    void loadSettings().catch(() => undefined);
  }, []);
  const [templates, setTemplates] = useState<string[]>([]);
  useEffect(() => {
    getTemplates("one").then((t) => setTemplates(t.map((x) => x.name))).catch(() => undefined);
  }, [frame.settings]);
  // tab menu (right-click) and the undo toast after closing tabs (v0.3.2, N)
  const [menu, setMenu] = useState<{ item: string | null; x: number; y: number } | null>(null);
  const [closed, setClosed] = useState<{ n: number; before: FrameState } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  useEffect(() => {
    if (!closed) return;
    const t = setTimeout(() => setClosed(null), 6000);
    return () => clearTimeout(t);
  }, [closed]);
  const [agent, setAgent] = useState(() => loadAgent(project.name));
  const agentLatest = useRef(agent);
  agentLatest.current = agent;
  const appRef = useRef<HTMLDivElement>(null);
  const changeAgent = useCallback((patch: Partial<typeof agent>) => setAgent((a) => ({ ...a, ...patch })), []);
  // --- command palette and shortcuts (v0.3.0) ---
  const [palette, setPalette] = useState<PaletteRequest | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const openPalette = useCallback((input: string) => {
    setPalette((p) => ({ input, n: (p?.n ?? 0) + 1 }));
    getRuns().then(setRuns).catch(() => undefined);
  }, []);
  const toggleAgent = useCallback(() => changeAgent({ mode: toggleFromIcon(agentLatest.current.mode) }), [changeAgent]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === ",") {
        e.preventDefault();
        dispatch({ type: "open-settings" });
        return;
      }
      const sc = shortcutFor(e);
      if (!sc) return;
      const f = latest.current;
      if (sc === "save" && !(f.area === "analysis" && f.active === null)) return; // the browser's own Ctrl+S stays
      e.preventDefault();
      if (sc === "commands") openPalette(">");
      else if (sc === "runs") openPalette("");
      else if (sc === "agent") toggleAgent();
      else if (sc === "voice") void handlerFor("ui:voice")?.({});
      else if (sc === "save") void handlerFor("open_save_dialog")?.({});
      else void nudgeScale(sc === "bigger" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    document.body.dataset.shortcuts = "on"; // the keys work from now on (the browser tests wait for it)
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette, toggleAgent]);
  const paletteCtx: Ctx = {
    project,
    frame,
    dispatch,
    runs,
    agentOpen: agent.mode === "open",
    toggleAgent,
    openAgent: () => changeAgent({ mode: "open" }),
    ask: (text) => {
      changeAgent({ mode: "open" });
      void handlerFor("ui:ask")?.({ text });
    },
    openSetting: (key) => {
      dispatch({ type: "open-settings" });
      requestFocus(key);
    },
    later: (fn) => {
      setPalette(null);
      setTimeout(fn, 0);
    },
  };

  useEffect(() => saveFrame(project.name, frame), [project.name, frame]);
  useEffect(() => saveAgent(project.name, agent), [project.name, agent]);
  // Effects run after paint; flush on leaving so a quick reload cannot lose the last click.
  useEffect(() => {
    const flush = () => {
      saveFrame(project.name, latest.current);
      saveAgent(project.name, agentLatest.current);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [project.name]);

  return (
    <div class="app" ref={appRef}>
      <IconBar
        short={project.short}
        projectName={project.name}
        area={frame.area}
        onSelect={(area) => dispatch({ type: "select-area", area })}
        agentActive={agent.mode !== "closed"}
        onAgent={() => changeAgent({ mode: toggleFromIcon(agent.mode) })}
        settingsActive={frame.active === SETTINGS_TAB}
        onSettings={() => dispatch({ type: "open-settings" })}
      />
      <div class="main">
        {project.warnings.length > 0 && (
          <div class="project-warnings" role="alert" data-testid="project-warnings">
            {project.warnings.map((w) => (
              <div key={w}>⚠ {w}</div>
            ))}
          </div>
        )}
        <TabStrip
          area={frame.area}
          tabs={frame.tabs}
          active={frame.active}
          onFocusPinned={() => dispatch({ type: "focus-pinned" })}
          onFocus={(run) => dispatch({ type: "focus-run", run })}
          onClose={(run) => dispatch({ type: "close-run", run })}
          settings={frame.settings}
          projectName={project.name}
          onPalette={() => openPalette("")}
          onFocusSettings={() => dispatch({ type: "open-settings" })}
          onCloseSettings={() => dispatch({ type: "close-settings" })}
          pinned={frame.pinned}
          onMenu={(item, x, y) => { setClosed(null); setMenu({ item, x, y }); }}
          onUnpin={(item) => dispatch({ type: "unpin-tab", item })}
        />
        <div class="content">
          {/* Both areas stay mounted, so a search or filter in Läufe survives an area switch. */}
          <div class="pane" hidden={frame.active !== null || frame.area !== "runs"}>
            <RunsView
              project={project}
              view={frame.runsView}
              onView={(view) => dispatch({ type: "set-runs-view", view })}
              onOpen={(run) => dispatch({ type: "open-run", run })}
              onCompare={(runs) => dispatch({ type: "open-compare", runs })}
              reveal={frame.reveal}
            />
          </div>
          <div class="pane" hidden={frame.active !== null || frame.area !== "analysis"}>
            <AnalysisView project={project} compare={frame.compare} request={frame.analysis} viewRequest={frame.analysisView} />
          </div>
          {frame.settings && (
            <div class="pane" hidden={frame.active !== SETTINGS_TAB}>
              <SettingsView project={project} templates={templates} />
            </div>
          )}
          {/* Every open run stays mounted, so filters, sorting and scroll survive tab switches. */}
          {frame.tabs.map((run) => (
            <div class="pane" key={run} hidden={frame.active !== run}>
              <RunTab
                runId={run}
                project={project}
                onBack={() => dispatch({ type: "focus-pinned" })}
                onClose={() => dispatch({ type: "close-run", run })}
                onAnalyse={(combo) => dispatch({ type: "open-analysis", run, combo })}
                onCompareWith={(other) => dispatch({ type: "open-compare", runs: [run, other] })}
                onOpenRun={(other) => dispatch({ type: "open-run", run: other })}
              />
            </div>
          ))}
        </div>
      </div>
      <StatusBar
        projectName={project.name}
        onOpenRun={(run) => dispatch({ type: "open-run", run })}
        onAnalyse={(run) => dispatch({ type: "open-analysis", run, combo: {} })}
      />
      {menu && <TabMenu item={menu.item} x={menu.x} y={menu.y} frame={frame} dispatch={dispatch} onClose={closeMenu} onClosed={(n, before) => setClosed({ n, before })} />}
      {closed && (
        <div class="tab-toast" role="status" data-testid="tabs-toast">
          <span>{closed.n === 1 ? "1 Tab geschlossen" : `${closed.n} Tabs geschlossen`}</span>
          <button
            class="tab-toast-undo"
            data-testid="tabs-undo"
            onClick={() => {
              const b = closed.before;
              dispatch({ type: "restore-tabs", before: { tabs: b.tabs, pinned: b.pinned, settings: b.settings, active: b.active } });
              setClosed(null);
            }}
          >
            Rückgängig
          </button>
        </div>
      )}
      {palette && <Palette ctx={paletteCtx} request={palette} onClose={() => setPalette(null)} />}
      <AgentLayer agent={agent} onChange={changeAgent} context={contextLabel(frame)} appRef={appRef} />
    </div>
  );
}
