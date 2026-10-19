import { useEffect, useMemo, useState } from "preact/hooks";
import { getRuns, postWidget, type CatalogEntry, type ProjectInfo, type RunRow } from "../api";
import { BoardPage } from "../analysis/BoardPage";
import { time } from "../runs/model";
import { loadJson, saveJson, storageKey } from "../state/storage";
import { useCatalog } from "../widgets/WidgetTile";

type View = "run" | "two" | "project";
const VIEWS: [View, string][] = [
  ["run", "Ein Lauf"],
  ["two", "Zwei Läufe"],
  ["project", "Projektverlauf"],
];
const SCOPE: Record<View, string> = { run: "run", two: "two-runs", project: "project" };

interface Props {
  project: ProjectInfo;
  /** Runs ticked in Läufe ("Vergleichen") or chosen in a run tab ("Vergleichen mit …"). */
  compare: string[];
  /** "Als Analyse öffnen" / "Analysieren": one run, optionally with a combination as filter. */
  request: { run: string; combo: Record<string, string> } | null;
  /** The agent asks for a view of the analysis. */
  viewRequest: { view: View; n: number } | null;
}

const isView = (v: unknown): View | null => (v === "run" || v === "two" || v === "project" ? v : null);

/** Analysis area: boards of widgets for one run, two runs or the project history (features E, G). */
export function AnalysisView({ project, compare, request, viewRequest }: Props) {
  const catalogs = { run: useCatalog("run"), two: useCatalog("two-runs"), project: useCatalog("project") };
  const [runs, setRuns] = useState<RunRow[]>([]);
  useEffect(() => {
    getRuns().then(setRuns).catch(() => {});
  }, []);
  const [view, setView] = useState<View>(() => loadJson(storageKey(project.name, "analysisView"), isView) ?? "run");
  useEffect(() => {
    if (compare.length >= 2) setView("two");
  }, [compare]);
  useEffect(() => {
    if (request) setView("run");
  }, [request]);
  useEffect(() => {
    if (viewRequest) setView(viewRequest.view);
  }, [viewRequest]);
  useEffect(() => saveJson(storageKey(project.name, "analysisView"), view), [project.name, view]);

  const ready = runs.length > 0 && catalogs.run.length > 0 && catalogs.two.length > 0 && catalogs.project.length > 0;
  if (!ready)
    return (
      <div class="placeholder" data-testid="analysis-view">
        <div class="loading-row" />
      </div>
    );
  const switcher = (
    <span class="crumb">
      <span>Analyse</span>
      <span class="muted">/</span>
      <span class="crumb-view">{VIEWS.find(([v]) => v === view)![1]}</span>
    </span>
  );
  return (
    <div class="analysis-root" data-testid="analysis-view" data-view={view}>
      <div class="scope-strip">
        <span>Umfang</span>
        <div class="seg" role="group" aria-label="Ansicht">
          {VIEWS.map(([v, label]) => (
            <button key={v} class={view === v ? "on" : ""} aria-pressed={view === v} data-testid={`analysis-view-${v}`} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "run" && <RunBoard project={project} runs={runs} catalog={catalogs.run} request={request} switcher={switcher} />}
      {view === "two" && <TwoRunsBoard project={project} runs={runs} catalog={catalogs.two} compare={compare} switcher={switcher} />}
      {view === "project" && <ProjectBoard project={project} runs={runs} catalog={catalogs.project} switcher={switcher} />}
    </div>
  );
}

const byNewest = (runs: RunRow[]) => [...runs].sort((a, b) => time(b.started) - time(a.started));

function RunSelect({ runs, value, onChange, testid, label }: { runs: RunRow[]; value: string; onChange: (id: string) => void; testid: string; label: string }) {
  return (
    <label class="setting">
      <span class="small muted">{label}</span>
      <select class="select run-select" data-testid={testid} value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
        {byNewest(runs).map((r) => (
          <option key={r.id} value={r.id}>
            {r.id}
          </option>
        ))}
      </select>
    </label>
  );
}

// --- Ein Lauf --------------------------------------------------------------------------------------
function RunBoard({ project, runs, catalog, request, switcher }: { project: ProjectInfo; runs: RunRow[]; catalog: CatalogEntry[]; request: Props["request"]; switcher: preact.ComponentChildren }) {
  const newest = useMemo(() => byNewest(runs)[0], [runs]);
  const [runId, setRunId] = useState(request?.run ?? newest.id);
  const [combo, setCombo] = useState<Record<string, string>>(request?.combo ?? {});
  useEffect(() => {
    if (request) {
      setRunId(request.run);
      setCombo(request.combo);
    }
  }, [request]);
  const run = runs.find((r) => r.id === runId) ?? newest;
  const chips = Object.entries(combo);
  return (
    <BoardPage
      project={project}
      scope="run"
      catalog={catalog}
      req={{ scope: "run", run: run.id, combo }}
      run={run}
      footerRuns={[run]}
      defaultTitle={run.name}
      defaultIssue={run.issue}
      controls={
        <>
          {switcher}
          <RunSelect runs={runs} value={run.id} testid="run-select" label="Lauf" onChange={(id) => (setRunId(id), setCombo({}))} />
          {chips.map(([k, v]) => (
            <button key={k} class="chip-btn mono" data-testid="filter-chip" aria-label={`Filter ${k} entfernen`} onClick={() => setCombo(Object.fromEntries(chips.filter(([x]) => x !== k)))}>
              {k} = {v} <span class="muted">×</span>
            </button>
          ))}
        </>
      }
    />
  );
}

// --- Zwei Läufe -----------------------------------------------------------------------------------------
function TwoRunsBoard({ project, runs, catalog, compare, switcher }: { project: ProjectInfo; runs: RunRow[]; catalog: CatalogEntry[]; compare: string[]; switcher: preact.ComponentChildren }) {
  const sorted = byNewest(runs);
  const [a, setA] = useState(compare[0] ?? sorted[1]?.id ?? sorted[0].id);
  const [b, setB] = useState(compare[1] ?? sorted[0].id);
  useEffect(() => {
    if (compare.length >= 2) {
      setA(compare[0]);
      setB(compare[1]);
    }
  }, [compare]);
  const runA = runs.find((r) => r.id === a) ?? sorted[0];
  const runB = runs.find((r) => r.id === b) ?? sorted[0];
  const [both, setBoth] = useState<[number, number] | null>(null);
  useEffect(() => {
    let alive = true;
    setBoth(null);
    postWidget("config-diff", { scope: "two-runs", runs: [runA.id, runB.id] })
      .then((r) => alive && setBoth(r.data?.n_both ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [runA.id, runB.id]);
  const note = compare.length > 2 ? "Nur die ersten beiden Läufe werden verglichen" : null;
  return (
    <BoardPage
      project={project}
      scope="two-runs"
      catalog={catalog}
      req={{ scope: "two-runs", runs: [runA.id, runB.id] }}
      run={runA}
      footerRuns={[runA, runB]}
      defaultTitle={`${runA.name} gegen ${runB.name}`}
      defaultIssue={runA.issue ?? runB.issue}
      controls={
        <>
          {switcher}
          <span class="run-dot a" aria-hidden="true" />
          <RunSelect runs={runs} value={runA.id} testid="run-a" label="A" onChange={setA} />
          <span class="run-dot b" aria-hidden="true" />
          <RunSelect runs={runs} value={runB.id} testid="run-b" label="B" onChange={setB} />
          {both && (
            <span class="small muted" data-testid="both-count">
              {both[0]} von {both[1]} Kombinationen in beiden Läufen
            </span>
          )}
          {note && (
            <span class="small warn-text" data-testid="compare-note">
              {note}
            </span>
          )}
        </>
      }
    />
  );
}

// --- Projektverlauf ------------------------------------------------------------------------------------------
function ProjectBoard({ project, runs, catalog, switcher }: { project: ProjectInfo; runs: RunRow[]; catalog: CatalogEntry[]; switcher: preact.ComponentChildren }) {
  const [colorBy, setColorBy] = useState<string>(() => loadJson(storageKey(project.name, "colorBy"), (v) => (typeof v === "string" ? v : null)) ?? "");
  useEffect(() => saveJson(storageKey(project.name, "colorBy"), colorBy), [project.name, colorBy]);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([{ value: "none", label: "keins" }]);
  useEffect(() => {
    postWidget("project-best", { scope: "project", params: {} })
      .then((r) => setOptions((r.options?.color_by as { value: string; label: string }[]) ?? []))
      .catch(() => {});
  }, []);
  const [selected, setSelected] = useState<string[] | null>(() => loadJson(storageKey(project.name, "mapRuns"), (v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null)));
  useEffect(() => saveJson(storageKey(project.name, "mapRuns"), selected), [project.name, selected]);
  const newest = byNewest(runs)[0];
  const value = colorBy && options.some((o) => o.value === colorBy) ? colorBy : (options.find((o) => o.value !== "none")?.value ?? "none");
  return (
    <BoardPage
      project={project}
      scope="project"
      catalog={catalog}
      req={{ scope: "project", runs: selected ?? [], params: { color_by: value } }}
      run={newest}
      footerRuns={[]}
      footerText={`Projekt ${project.name} · ${runs.length} Läufe`}
      defaultTitle="Projektverlauf"
      defaultIssue={null}
      selection={{
        runs: selected,
        toggle: (id, current) => setSelected(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]),
      }}
      controls={
        <>
          {switcher}
          <label class="setting">
            <span class="small muted">Färben nach Lauf-Merkmal</span>
            <select class="select" data-testid="color-by" value={value} onChange={(e) => setColorBy((e.target as HTMLSelectElement).value)}>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <button class="btn" data-testid="reset-selection" onClick={() => setSelected(null)}>
              Auswahl zurücksetzen
            </button>
          )}
        </>
      }
    />
  );
}
