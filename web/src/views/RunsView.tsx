import { useEffect, useMemo, useState } from "preact/hooks";
import { getIssues, getRuns, StoreProblem, type IssueInfo, type ProjectInfo, type RunRow } from "../api";
import { formatNumber } from "../format";
import { Best, CellBar, StatusDot } from "../runs/components";
import { IssuesView } from "../runs/IssuesView";
import { ListView, type ListState } from "../runs/ListView";
import {
  buildBlocks,
  currentEpoch,
  matchRun,
  noFilters,
  relTime,
  time,
  type Filters,
  type StatusFilter,
} from "../runs/model";
import { Timeline } from "../runs/Timeline";
import type { RunsView as ViewName } from "../state/frame";

interface Props {
  project: ProjectInfo;
  view: ViewName;
  onView: (v: ViewName) => void;
  onOpen: (run: string) => void;
  onCompare: (runs: string[]) => void;
}

const STATUS: [StatusFilter, string][] = [
  ["all", "Alle"],
  ["running", "Läuft"],
  ["errors", "Mit Fehlern"],
];

function Seg<T extends string>({ items, value, onChange, label }: { items: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {items.map(([k, l]) => (
        <button key={k} class={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Start page of the tool (feature C): all runs, by issue and experiment, newest first. */
export function RunsView({ project, view, onView, onOpen, onCompare }: Props) {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [issues, setIssues] = useState<Record<string, IssueInfo>>({});
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [showTl, setShowTl] = useState(false);
  const [state, setState] = useState<ListState>({ sel: new Set(), open: {}, olderOpen: {}, focus: null });
  const [issueSel, setIssueSel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      getRuns()
        .then((r) => {
          if (!alive) return;
          setProblem(null);
          setRuns(r);
        })
        .catch((e) => {
          if (!alive) return;
          setProblem(e instanceof StoreProblem ? e.message : null);
          setRuns((p) => p ?? []);
        });
      getIssues().then((i) => alive && setIssues(i)).catch(() => {});
    };
    load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const current = currentEpoch(project);
  const all = runs ?? [];
  const sortedAll = useMemo(() => [...all].sort((a, b) => time(b.started) - time(a.started)), [all]);
  const matching = useMemo(() => all.filter((r) => matchRun(r, issues, filters)), [all, issues, filters]);
  const blocks = useMemo(() => buildBlocks(matching), [matching]);

  if (!runs)
    return (
      <div class="runs-view">
        <div class="placeholder">
          <div class="loading-row" />
          <div class="loading-row" />
          <div class="loading-row" />
        </div>
      </div>
    );

  if (problem)
    return (
      <div class="runs-view" data-testid="runs-view">
        <div class="notice" data-testid="store-problem">
          {problem}
        </div>
      </div>
    );

  const newest = sortedAll[0];
  const showNewest = newest && !filters.q.trim() && filters.status === "all";
  const selected = sortedAll.filter((r) => state.sel.has(r.id));
  const merkmalLabel = all.find((r) => r.merkmal)?.merkmal?.label ?? "";
  const copyPath = (path: string) => {
    try {
      void navigator.clipboard?.writeText(path);
    } catch {
      /* clipboard unavailable: the path is still shown in the message */
    }
    setToast(`Pfad kopiert: ${path}`);
  };
  const toggleSel = (id: string) =>
    setState((s) => {
      const sel = new Set(s.sel);
      sel.has(id) ? sel.delete(id) : sel.add(id);
      return { ...s, sel };
    });
  const pickDot = (id: string) => {
    const r = all.find((x) => x.id === id);
    setState((s) => ({ ...s, focus: id, open: r?.issue ? { ...s.open, [r.issue]: true } : s.open }));
    if (view !== "list") onView("list");
  };

  return (
    <div class="runs-view" data-testid="runs-view">
      <div class="view-head">
        <span class="crumb">
          <span class="muted">{project.name} /</span> Läufe
        </span>
        <div class="seg" role="group" aria-label="Ansicht">
          {(["list", "issues"] as const).map((v) => (
            <button key={v} class={view === v ? "on" : ""} aria-pressed={view === v} data-testid={`view-${v}`} onClick={() => onView(v)}>
              {v === "list" ? "Liste" : "Issues"}
            </button>
          ))}
        </div>
      </div>
      <div class="toolbar">
        <input
          type="search"
          class="search"
          placeholder="Issue, Lauf, Achse …"
          aria-label="Läufe durchsuchen"
          data-testid="search"
          value={filters.q}
          onInput={(e) => setFilters({ ...filters, q: (e.target as HTMLInputElement).value })}
        />
        {view === "list" && (
          <>
            <Seg items={STATUS} value={filters.status} onChange={(status) => setFilters({ ...filters, status })} label="Status" />
            <Seg
              items={[["all", "Alle Epochen"], ...project.epochs.map((e): [string, string] => [e.name, e.name])]}
              value={filters.epoch}
              onChange={(epoch) => setFilters({ ...filters, epoch })}
              label="Epoche"
            />
            <button class={"toggle" + (showTl ? " on" : "")} aria-expanded={showTl} data-testid="toggle-timeline" onClick={() => setShowTl(!showTl)}>
              {(showTl ? "▾ " : "▸ ") + "Verlauf"}
            </button>
            <span class="grow" />
            <span class="muted" data-testid="count">
              {matching.length} von {all.length} Läufen
            </span>
            <button
              class={"btn-primary" + (selected.length >= 2 ? " active" : "")}
              disabled={selected.length < 2}
              data-testid="compare"
              onClick={() => onCompare(selected.map((r) => r.id))}
            >
              {selected.length >= 2 ? `Vergleichen (${selected.length})` : "Vergleichen"}
            </button>
          </>
        )}
      </div>
      {view === "list" && showTl && (
        <Timeline runs={all} project={project} focus={state.focus} merkmalLabel={merkmalLabel} onPick={pickDot} />
      )}
      <div class="runs-scroll">
        {view === "list" ? (
          <>
            {showNewest && (
              <div class="newest" data-testid="newest">
                <div class="newest-main">
                  <span class="newest-label mono">Neuester Lauf · {relTime(project.now, newest.started)}</span>
                  <span class="mono newest-name">{newest.id}</span>
                  <span class="muted small">
                    {newest.issue ? `${newest.issue}${issues[newest.issue]?.title ? " · " + issues[newest.issue].title : ""}` : "ohne Issue"}
                  </span>
                </div>
                <div class="newest-cells">
                  <span class="bar big">
                    <span
                      class="bar-ok running"
                      style={{ width: `${Math.min(100, (newest.cells / Math.max(newest.planned, 1)) * 100)}%` }}
                    />
                  </span>
                  <span class="mono small muted">
                    {newest.running ? `läuft · ${newest.cells} / ${newest.planned} Zellen` : `${newest.cells} Zellen`}
                  </span>
                </div>
                <div class="newest-best">
                  <span class="mono newest-value">
                    {newest.best ? formatNumber(newest.best.value * newest.best.scale, 2) + (newest.best.unit ? " " + newest.best.unit : "") : "–"}
                  </span>
                  <span class="muted tiny">
                    {newest.best ? `bester ${newest.best.label}${newest.running ? " bisher" : ""}${newest.merkmal ? ` · ${newest.merkmal.label} ${newest.merkmal.value}` : ""}` : ""}
                  </span>
                </div>
                <button class="btn-primary active" data-testid="newest-open" onClick={() => onOpen(newest.id)}>
                  Öffnen
                </button>
              </div>
            )}
            {!blocks.length && (
              <div class="empty" data-testid="empty">
                {all.length ? "Keine Läufe passen zu Suche und Filtern." : "Dieses Projekt hat noch keine Läufe."}
              </div>
            )}
            <ListView
              project={project}
              blocks={blocks}
              issues={issues}
              filters={filters}
              state={state}
              current={current}
              onToggleSel={toggleSel}
              onToggleIssue={(key, open) => setState((s) => ({ ...s, open: { ...s.open, [key]: open } }))}
              onToggleOlder={(exp) => setState((s) => ({ ...s, olderOpen: { ...s.olderOpen, [exp]: !s.olderOpen[exp] } }))}
              onOpen={onOpen}
              onPath={copyPath}
            />
          </>
        ) : (
          <IssuesView
            project={project}
            runs={all}
            issues={issues}
            q={filters.q}
            selected={issueSel}
            current={current}
            onSelect={setIssueSel}
            onOpen={onOpen}
            onPath={copyPath}
          />
        )}
      </div>
      {toast && (
        <div class="toast" role="status" data-testid="toast">
          {toast}
        </div>
      )}
    </div>
  );
}

export { Best, CellBar, StatusDot };
