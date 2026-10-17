import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getDescription, getDims, getRuns, NotFound, type Description, postTable, type DimsInfo, type ProjectInfo, type RunInfo, type RunRow, type TableResult, type TableRow } from "../api";
import { provide, provideView } from "../agent/bus";
import { DescriptionBlock, OverviewLine } from "./Description";
import { loadFolds, saveFolds, type Folds } from "./description";
import { DetailPanel } from "./DetailPanel";
import { Overview } from "./Overview";
import { Sidebar } from "./Sidebar";
import { Table } from "./Table";
import { Toolbar } from "./Toolbar";
import {
  chips,
  loadColumns,
  resetDim,
  setDim,
  saveColumns,
  summary,
  toggleValue,
  visibleMetrics,
  type Columns,
  type DimState,
  type Sort,
} from "./model";

interface Props {
  run: RunInfo;
  project: ProjectInfo;
  onBack: () => void;
  onMissing: () => void;
  onAnalyse: (combo: Record<string, string>) => void;
  onCompareWith: (other: string) => void;
  onOpenRun: (run: string) => void;
}

/** View of one run (feature D): sidebar of dimensions, toolbar, overview strip and group table. */
export function ExperimentView({ run, project, onBack, onMissing, onAnalyse, onCompareWith, onOpenRun }: Props) {
  const [info, setInfo] = useState<DimsInfo | null>(null);
  const [state, setState] = useState<DimState>({});
  const [sort, setSort] = useState<Sort>({ metric: null, stat: "mean", dir: null });
  const [overview, setOverview] = useState(true);
  const [columns, setColumns] = useState<Columns>(() => loadColumns(project.name));
  const [result, setResult] = useState<TableResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TableRow | null>(null);
  const seq = useRef(0);
  const [description, setDescription] = useState<Description | null>(null);
  const [folds, setFolds] = useState<Folds>(() => loadFolds(project.name));
  const [toolbarHeight, setToolbarHeight] = useState(49);
  const toolbarBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setDescription(null);
    getDescription(run.id)
      .then((d) => alive && setDescription(d))
      .catch(() => {}); // a description that cannot be loaded is shown as none
    return () => {
      alive = false;
    };
  }, [run.id]);
  const toggleDescription = () => {
    const next = { ...folds, [run.id]: !folds[run.id] };
    setFolds(next);
    saveFolds(project.name, next); // at once: a reload right after the click must keep it
  };

  // the toolbar sticks to the top of the scroll column and the table header right below it: measure its height
  useEffect(() => {
    const el = toolbarBox.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setToolbarHeight(el.offsetHeight));
    ro.observe(el);
    setToolbarHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [info !== null]);

  useEffect(() => {
    getDims(run.id).then(setInfo).catch((e) => (e instanceof NotFound ? onMissing() : setError(true)));
  }, [run.id]);

  useEffect(() => saveColumns(project.name, columns), [project.name, columns]);

  useEffect(() => {
    const ctl = new AbortController();
    const mine = ++seq.current;
    setLoading(true);
    postTable(run.id, { dims: state, sort, overview }, ctl.signal)
      .then((r) => {
        if (mine === seq.current) {
          setResult(r);
          setError(false);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        if (e instanceof NotFound) onMissing();
        else setError(true);
        setLoading(false);
      });
    return () => ctl.abort();
  }, [run.id, state, sort, overview]);

  const dims = info?.dims ?? [];

  // the agent sets filters and sorting of this run (feature C); the handler is for this run's tab
  const mirror = useRef({ state, sort, dims });
  mirror.current = { state, sort, dims };
  useEffect(() => {
    const offTool = provide(`set_run_view:${run.id}`, async (args) => {
      for (let i = 0; i < 100 && !mirror.current.dims.length; i++) await new Promise((r) => setTimeout(r, 40)); // the dimensions are still loading
      const { state: before, sort: sortBefore, dims: known } = mirror.current;
      if (!known.length) throw new Error("Die Dimensionen des Laufs sind noch nicht geladen");
      let next: DimState = { ...before };
      const filters = (args.filters ?? {}) as Record<string, unknown>;
      for (const [key, values] of Object.entries(filters)) {
        const d = known.find((x) => x.key === key);
        if (!d) throw new Error(`Der Lauf hat keine Dimension „${key}“ (vorhanden: ${known.map((x) => x.key).join(", ")})`);
        const list = (Array.isArray(values) ? values : [values]).map(String);
        const bad = list.filter((v) => !d.values.some((x) => x.value === v));
        if (bad.length) throw new Error(`„${key}“ kennt ${bad.join(", ")} nicht (vorhanden: ${d.values.map((x) => x.value).join(", ")})`);
        next = setDim(next, d, { sel: list });
      }
      const sortArg = args.sort as Partial<Sort> | undefined;
      const nextSortState: Sort = sortArg?.metric
        ? { metric: String(sortArg.metric), stat: (sortArg.stat as Sort["stat"]) ?? "mean", dir: (sortArg.dir as Sort["dir"]) ?? "asc" }
        : sortBefore;
      setState(next);
      setSort(nextSortState);
      const parts = [...Object.entries(filters).map(([k, v]) => `${k} ∈ ${([] as unknown[]).concat(v).join(", ") || "alle"}`), ...(sortArg?.metric ? [`sortiert nach ${sortArg.metric}`] : [])];
      return {
        summary: `Ansicht eingestellt · ${parts.join(" · ") || "unverändert"}`,
        undo: () => {
          setState(before);
          setSort(sortBefore);
          return "Ansicht zurückgesetzt";
        },
        redo: () => {
          setState(next);
          setSort(nextSortState);
          return `Ansicht eingestellt · ${parts.join(" · ")}`;
        },
      };
    });
    const offView = provideView(`run:${run.id}`, () => ({ filters: Object.fromEntries(Object.entries(mirror.current.state).filter(([, q]) => q.sel.length).map(([k, q]) => [k, q.sel])), sort: mirror.current.sort }));
    return () => {
      offTool();
      offView();
    };
  }, [run.id]);
  const shownChips = useMemo(() => chips(dims, state), [dims, state]);
  const visible = visibleMetrics(columns, project.metrics, info?.primary_metric ?? project.primary_metric);
  const sortMetric = result?.sort.metric ?? null;
  const sortDef = project.metrics.find((m) => m.key === sortMetric);
  const primary = info?.primary_metric ?? project.primary_metric;

  return (
    <div class="exp-view" data-testid="exp-view">
      <div class="view-head">
        <button class="crumb-link" data-testid="back-to-runs" onClick={onBack}>
          Läufe
        </button>
        <span class="muted">/</span>
        <span class="mono" data-testid="run-title" title={run.id}>
          {run.name}
        </span>
        <span class="grow" />
        <CompareWith runId={run.id} onPick={onCompareWith} />
        <button class="btn" data-testid="analyse-run" onClick={() => onAnalyse({})}>
          Analysieren
        </button>
        {run.epoch && <span class="epoch-chip mono">Epoche {run.epoch}</span>}
      </div>
      <div class="exp-body">
        {info ? <Sidebar info={info} state={state} onState={setState} /> : <aside class="exp-sidebar" />}
        <main class="exp-main" data-testid="exp-main" style={{ "--toolbar-h": `${toolbarHeight}px` }}>
          {description && (
            <DescriptionBlock
              description={description}
              open={!folds[run.id]}
              onToggle={toggleDescription}
              onOpenRun={onOpenRun}
            />
          )}
          <OverviewLine open={overview} onToggle={() => setOverview(!overview)} />
          {overview && result?.overview && result.overview.cards.length + 1 > 0 && (
            <Overview
              cards={result.overview.cards}
              result={result}
              metric={sortDef}
              onValue={(dimKey, value) => {
                const d = dims.find((x) => x.key === dimKey);
                if (d) setState((s) => toggleValue(s, d, value));
              }}
            />
          )}
          <div class="exp-toolbar-box" ref={toolbarBox}>
          <Toolbar
            overview={overview}
            onOverview={setOverview}
            columns={columns}
            onColumns={setColumns}
            metrics={project.metrics}
            primary={primary}
            chips={shownChips}
            onChip={(c) => setState((s) => resetDim(s, c.dim))}
            summary={result ? summary(result.groups, result.cells, result.shown) : ""}
          />
          </div>
          <div class="exp-table-wrap">
            {error && (
              <div class="notice" data-testid="table-error">
                Die Tabelle konnte nicht geladen werden.
              </div>
            )}
            {!result && !error && (
              <div class="placeholder">
                <div class="loading-row" />
                <div class="loading-row" />
                <div class="loading-row" />
              </div>
            )}
            {result && (
              <>
                <Table
                  result={result}
                  metrics={project.metrics}
                  visible={visible}
                  columns={columns}
                  sort={sort}
                  onSort={setSort}
                  stale={loading}
                  selectedKey={selected?.key ?? null}
                  onRow={setSelected}
                />
                {result.rows.length === 0 && (
                  <div class="empty" data-testid="exp-empty">
                    Keine Zellen unter diesen Filtern.
                  </div>
                )}
              </>
            )}
          </div>
        </main>
        {selected && (
          <DetailPanel run={run} project={project} row={selected} onClose={() => setSelected(null)} onAnalyse={onAnalyse} />
        )}
      </div>
    </div>
  );
}

/** "Vergleichen mit …": choose a second run; opens the two-run analysis. */
function CompareWith({ runId, onPick }: { runId: string; onPick: (other: string) => void }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);
  useEffect(() => {
    if (open) getRuns().then(setRuns).catch(() => {});
  }, [open]);
  return (
    <div class="relative">
      <button class="btn" aria-expanded={open} data-testid="compare-with" onClick={() => setOpen(!open)}>
        Vergleichen mit …
      </button>
      {open && (
        <div class="popover right wide" data-testid="compare-with-menu">
          {runs
            .filter((r) => r.id !== runId)
            .map((r) => (
              <button
                key={r.id}
                class="pop-choice mono"
                data-testid="compare-with-item"
                data-run={r.id}
                onClick={() => {
                  setOpen(false);
                  onPick(r.id);
                }}
              >
                {r.id}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
