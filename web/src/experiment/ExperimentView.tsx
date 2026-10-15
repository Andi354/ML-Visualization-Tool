import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getDims, getRuns, NotFound, postTable, type DimsInfo, type ProjectInfo, type RunInfo, type RunRow, type TableResult, type TableRow } from "../api";
import { DetailPanel } from "./DetailPanel";
import { Overview } from "./Overview";
import { Sidebar } from "./Sidebar";
import { Table } from "./Table";
import { Toolbar } from "./Toolbar";
import {
  chips,
  loadColumns,
  resetDim,
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
}

/** View of one run (feature D): sidebar of dimensions, toolbar, overview strip and group table. */
export function ExperimentView({ run, project, onBack, onMissing, onAnalyse, onCompareWith }: Props) {
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
        <main class="exp-main">
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
