import { useEffect, useMemo, useState } from "preact/hooks";
import { getIssues, getRuns, StoreProblem, type IssueInfo, type ProjectInfo, type RunRow } from "../api";
import { formatNumber } from "../format";
import { Best, CellBar, StatusDot } from "../runs/components";
import { IssuesView } from "../runs/IssuesView";
import { ListView, type ListState } from "../runs/ListView";
import {
  buildSections,
  countLabel,
  currentEpoch,
  matchRun,
  NO_ISSUE,
  noFilters,
  overviewTiles,
  relTime,
  shortName,
  time,
  type Filters,
  type StatusFilter,
} from "../runs/model";
import { SearchIcon } from "../frame/icons";
import { Timeline } from "../runs/Timeline";
import type { RunsView as ViewName } from "../state/frame";

interface Props {
  project: ProjectInfo;
  view: ViewName;
  onView: (v: ViewName) => void;
  onOpen: (run: string) => void;
  onCompare: (runs: string[]) => void;
  /** "In Läufe zeigen" of the tab menu: open this run's issue and mark its row. */
  reveal?: { run: string; n: number } | null;
}

const STATUS: [StatusFilter, string][] = [
  ["all", "Alle"],
  ["running", "Läuft"],
  ["errors", "Mit Fehlern"],
  ["week", "Diese Woche"],
];

function Seg<T extends string>({ items, value, onChange, label }: { items: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div class="chips" role="group" aria-label={label}>
      {items.map(([k, l]) => (
        <button key={k} class={"pill" + (value === k ? " on" : "")} aria-pressed={value === k} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Marks a run and opens what hides it: its issue section and, for an older run, the folded runs of its experiment. */
function focusRun(s: ListState, runs: RunRow[], id: string): ListState {
  const r = runs.find((x) => x.id === id);
  if (!r) return { ...s, focus: id };
  const newest = runs.filter((x) => x.name === r.name && x.issue === r.issue).sort((a, b) => time(b.started) - time(a.started))[0];
  return {
    ...s,
    focus: id,
    open: { ...s.open, [r.issue ?? NO_ISSUE]: true },
    olderOpen: newest.id === id ? s.olderOpen : { ...s.olderOpen, [r.name]: true },
  };
}

/** Start page of the tool (feature C): all runs, by issue and experiment, newest first. */
export function RunsView({ project, view, onView, onOpen, onCompare, reveal }: Props) {
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
    window.addEventListener("mlviz:notes-changed", load); // a note was added or deleted: the count in the list follows
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("mlviz:notes-changed", load);
    };
  }, []);

  useEffect(() => {
    if (!reveal || !runs) return;
    setState((s) => focusRun(s, runs, reveal.run));
  }, [reveal?.n, runs !== null]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const current = currentEpoch(project);
  const all = runs ?? [];
  const sortedAll = useMemo(() => [...all].sort((a, b) => time(b.started) - time(a.started)), [all]);
  const matching = useMemo(() => all.filter((r) => matchRun(r, issues, filters, time(project.now))), [all, issues, filters, project.now]);
  const sections = useMemo(() => buildSections(matching), [matching]);

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
    setState((s) => focusRun(s, all, id));
    if (view !== "list") onView("list");
  };
  const issueCount = new Set(all.map((r) => r.issue ?? NO_ISSUE)).size;
  const filtered = filters.q.trim() !== "" || filters.status !== "all" || filters.epoch !== "all";
  const tiles = showNewest ? overviewTiles(all, project.metrics) : null;
  const clearSel = () => setState((s) => ({ ...s, sel: new Set() }));
  const onToggleOlder = (exp: string) => setState((s) => ({ ...s, olderOpen: { ...s.olderOpen, [exp]: !s.olderOpen[exp] } }));

  return (
    <div class={"runs-view" + (view === "list" ? " is-list" : "")} data-testid="runs-view">
      <div class="view-head">
        <div class="view-title">
          <span class="view-name">Läufe</span>
          <span class="muted" data-testid="count">
            {filtered ? `${matching.length} von ${all.length} Läufen` : `${countLabel(all.length, "Lauf", "Läufe")} in ${countLabel(issueCount, "Issue", "Issues")}`}
            {!filtered && sortedAll[0] ? ` · zuletzt ${relTime(project.now, sortedAll[0].started)}` : ""}
          </span>
        </div>
        <div class="switch-pill" role="group" aria-label="Ansicht">
          {(["list", "issues"] as const).map((v) => (
            <button key={v} class={view === v ? "on" : ""} aria-pressed={view === v} data-testid={`view-${v}`} onClick={() => onView(v)}>
              {v === "list" ? "Liste" : "Issues"}
            </button>
          ))}
        </div>
        {view === "list" && (
          <div class="head-tools">
            <Seg items={STATUS} value={filters.status} onChange={(status) => setFilters({ ...filters, status })} label="Status" />
            {project.epochs.length > 0 && (
              <Seg
                items={[["all", "Alle Epochen"], ...project.epochs.map((e): [string, string] => [e.name, e.name])]}
                value={filters.epoch}
                onChange={(epoch) => setFilters({ ...filters, epoch })}
                label="Epoche"
              />
            )}
            <button class={"pill" + (showTl ? " on" : "")} aria-expanded={showTl} data-testid="toggle-timeline" onClick={() => setShowTl(!showTl)}>
              {(showTl ? "▾ " : "▸ ") + "Verlauf"}
            </button>
            <label class="search-pill">
              <SearchIcon />
              <input
                type="search"
                class="search"
                placeholder="Suchen …"
                aria-label="Läufe durchsuchen"
                data-testid="search"
                value={filters.q}
                onInput={(e) => setFilters({ ...filters, q: (e.target as HTMLInputElement).value })}
              />
            </label>
          </div>
        )}
      </div>
      {view === "list" && showTl && (
        <Timeline runs={all} project={project} focus={state.focus} merkmalLabel={merkmalLabel} onPick={pickDot} />
      )}
      <div class="runs-scroll">
        {view === "list" ? (
          <>
            {tiles && tiles.first && <Tiles tiles={tiles} project={project} issues={issues} onOpen={onOpen} />}
            {!sections.length && (
              <div class="empty" data-testid="empty">
                {all.length ? "Keine Läufe passen zu Suche und Filtern." : "Dieses Projekt hat noch keine Läufe."}
              </div>
            )}
            <ListView
              project={project}
              sections={sections}
              issues={issues}
              filters={filters}
              state={state}
              current={current}
              onToggleSel={toggleSel}
              onToggleIssue={(key, open) => setState((s) => ({ ...s, open: { ...s.open, [key]: open } }))}
              onToggleOlder={onToggleOlder}
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
            onQ={(q) => setFilters({ ...filters, q })}
            selected={issueSel}
            current={current}
            state={state}
            onSelect={setIssueSel}
            onToggleSel={toggleSel}
            onToggleOlder={onToggleOlder}
            onOpen={onOpen}
            onPath={copyPath}
          />
        )}
      </div>
      {selected.length > 0 && (
        <div class="compare-bar" data-testid="compare-bar">
          <span data-testid="compare-count">{selected.length === 1 ? "1 Lauf ausgewählt" : `${selected.length} Läufe ausgewählt`}</span>
          <button class="bar-clear" data-testid="compare-clear" onClick={clearSel}>
            Aufheben
          </button>
          <button
            class={"btn-primary" + (selected.length >= 2 ? " active" : "")}
            disabled={selected.length < 2}
            data-testid="compare"
            onClick={() => onCompare(selected.map((r) => r.id))}
          >
            Vergleichen
          </button>
        </div>
      )}
      {toast && (
        <div class="toast" role="status" data-testid="toast">
          {toast}
        </div>
      )}
    </div>
  );
}

/** The three overview tiles of the list view (v0.3.2, P): the running run (else the newest) and the best values. */
function Tiles({ tiles, project, issues, onOpen }: { tiles: ReturnType<typeof overviewTiles>; project: ProjectInfo; issues: Record<string, IssueInfo>; onOpen: (id: string) => void }) {
  const r = tiles.first;
  const pct = r.running ? Math.min(100, Math.round((r.cells / Math.max(r.planned, 1)) * 100)) : 100;
  const C = 2 * Math.PI * 26;
  return (
    <div class="tiles">
      <div class="tile tile-run" data-testid="newest">
        {r.running ? (
          <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${pct} Prozent fertig`}>
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="7" />
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 32 32)" />
            <text x="32" y="37" text-anchor="middle" font-family="IBM Plex Mono" font-size="14" font-weight="500" fill="var(--text)">{pct}%</text>
          </svg>
        ) : null}
        <div class="tile-text">
          <span class={"tile-kicker" + (r.running ? " accent" : "")}>{r.running ? `Läuft gerade · seit ${relTime(project.now, r.started)}` : `Neuester Lauf · ${relTime(project.now, r.started)}`}</span>
          <span class="mono tile-name" title={r.id}>{r.id}</span>
          <span class="tile-sub">
            {r.issue ? `${r.issue}${issues[r.issue]?.title ? " · " + issues[r.issue].title : ""}` : "ohne Issue"} ·{" "}
            {r.running ? `${r.cells} / ${r.planned} Zellen` : `${r.cells} Zellen`}
            {r.errors ? ` · ${r.errors} Fehler` : ""}
          </span>
        </div>
        <button class="btn-primary active" data-testid="newest-open" onClick={() => onOpen(r.id)}>
          Öffnen
        </button>
      </div>
      {tiles.bests.map((b) => (
        <div class="tile" key={b.run.id} data-testid="best-tile">
          <span class="tile-kicker">Bester Wert{b.run.merkmal ? ` · ${b.run.merkmal.label} ${b.run.merkmal.value}` : ""}</span>
          <span class="mono tile-value">
            {formatNumber(b.value, 2)}
            {b.run.best?.unit ? " " + b.run.best.unit : ""}
          </span>
          <span class="tile-sub">
            {shortName(b.run)} · {b.run.issue ?? "ohne Issue"} · {b.run.running ? "vorläufig" : relTime(project.now, b.run.started)}
          </span>
        </div>
      ))}
    </div>
  );
}

export { Best, CellBar, StatusDot };
