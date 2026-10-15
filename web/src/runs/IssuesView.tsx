import { useMemo } from "preact/hooks";
import type { IssueInfo, ProjectInfo, RunRow } from "../api";
import { formatInt, formatNumber } from "../format";
import { Best, CellBar, Flags, StatusDot } from "./components";
import { buildBlocks, countLabel, relTime, stamp, time, type Block } from "./model";

export const NO_ISSUE = "—";

interface Entry {
  key: string; // issue ID or NO_ISSUE
  runs: RunRow[];
  last: number;
}

/** Entries of the left list: issues by their newest run, the standalone runs as one entry "Ohne Issue". */
export function issueEntries(blocks: Block[]): Entry[] {
  const entries: Entry[] = [];
  const none: RunRow[] = [];
  for (const b of blocks) {
    if (b.kind === "issue") entries.push({ key: b.key, runs: b.runs, last: b.last });
    else {
      if (!none.length) entries.push({ key: NO_ISSUE, runs: none, last: b.last });
      none.push(b.run);
    }
  }
  return entries;
}

/** Search in the Issues view: issue ID, issue title, run names and axis names. */
export function entryMatches(e: Entry, issues: Record<string, IssueInfo>, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [e.key, issues[e.key]?.title ?? "", ...e.runs.map((r) => `${r.id} ${r.axes.join(" ")}`)];
  return hay.join(" ").toLowerCase().includes(s);
}

interface Props {
  project: ProjectInfo;
  runs: RunRow[];
  issues: Record<string, IssueInfo>;
  q: string;
  selected: string | null;
  current: string | null;
  onSelect: (key: string) => void;
  onOpen: (id: string) => void;
  onPath: (path: string) => void;
}

function bestByMerkmal(runs: RunRow[], project: ProjectInfo) {
  const groups = new Map<string, { best: RunRow["best"]; label: string; value: number }>();
  for (const r of runs) {
    if (!r.best) continue;
    const key = r.merkmal?.value ?? "";
    const dir = project.metrics.find((m) => m.key === r.best!.metric)?.direction ?? "min";
    const v = r.best.value * r.best.scale;
    const g = groups.get(key);
    if (!g || (dir === "max" ? v > g.value : v < g.value))
      groups.set(key, { best: r.best, label: r.merkmal ? `${r.merkmal.label} ${r.merkmal.value}` : "", value: v });
  }
  return [...groups.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0]))
    .map(([, g]) => g);
}

export function IssuesView(p: Props) {
  const blocks = useMemo(() => buildBlocks(p.runs), [p.runs]);
  const entries = useMemo(() => issueEntries(blocks), [blocks]);
  const shown = entries.filter((e) => entryMatches(e, p.issues, p.q));
  // Initial selection: the issue of the newest run.
  const sel = entries.find((e) => e.key === p.selected) ?? entries[0];
  const info = sel && sel.key !== NO_ISSUE ? p.issues[sel.key] : undefined;
  const exps = useMemo(() => {
    if (!sel) return [];
    const m = new Map<string, RunRow[]>();
    for (const r of [...sel.runs].sort((a, b) => time(b.started) - time(a.started))) {
      m.set(r.name, [...(m.get(r.name) ?? []), r]);
    }
    return [...m.entries()];
  }, [sel]);

  return (
    <div class="issues-view">
      <aside class="issue-list" data-testid="issue-list">
        {shown.map((e) => {
          const i = e.key === NO_ISSUE ? undefined : p.issues[e.key];
          const running = e.runs.some((r) => r.running);
          return (
            <button
              key={e.key}
              class={"issue-item" + (sel && sel.key === e.key ? " active" : "")}
              data-testid="issue-item"
              data-issue={e.key}
              onClick={() => p.onSelect(e.key)}
            >
              <span class="issue-item-top">
                <StatusDot info={i} />
                <span class="mono issue-key">{e.key === NO_ISSUE ? "Ohne Issue" : e.key}</span>
                <span class="grow" />
                <span class="muted tiny">{relTime(p.project.now, e.last)}</span>
              </span>
              <span class="issue-item-title">{e.key === NO_ISSUE ? "Läufe ohne zugeordnetes Issue" : (i?.title ?? "")}</span>
              <span class="muted tiny issue-item-meta">
                <span>
                  {countLabel(e.runs.length, "Lauf", "Läufe")}
                  {i?.status ? ` · ${i.status}` : ""}
                </span>
                {running && <span class="running-flag">● läuft</span>}
              </span>
            </button>
          );
        })}
        {!shown.length && <div class="muted small pad">Keine Treffer.</div>}
      </aside>
      {sel && (
        <main class="issue-detail" data-testid="issue-detail" data-issue={sel.key}>
          <div class="issue-detail-head">
            <div class="issue-detail-line">
              <span class="mono muted">{sel.key === NO_ISSUE ? "Ohne Issue" : sel.key}</span>
              {info?.status && (
                <span class="status-pill" style={{ color: `var(--text-2)` }}>
                  <StatusDot info={info} /> {info.status}
                </span>
              )}
              <span class="grow" />
              {info?.url && (
                <a class="btn-link" href={info.url} target="_blank" rel="noreferrer">
                  In Linear ↗
                </a>
              )}
              {info?.analysis && (
                <button class="btn-link" title={info.analysis} onClick={() => p.onPath(info.analysis!)}>
                  Bericht
                </button>
              )}
              {info?.deliverable && (
                <button class="btn-link" title={info.deliverable} onClick={() => p.onPath(info.deliverable!)}>
                  Deliverables
                </button>
              )}
            </div>
            <h1>{sel.key === NO_ISSUE ? "Läufe ohne zugeordnetes Issue" : (info?.title ?? sel.key)}</h1>
          </div>
          <div class="stats">
            <div class="stat">
              <span class="muted tiny">Läufe</span>
              <span class="mono stat-value">{formatInt(sel.runs.length)}</span>
            </div>
            <div class="stat">
              <span class="muted tiny">Zellen</span>
              <span class="mono stat-value">{formatInt(sel.runs.reduce((a, r) => a + r.cells, 0))}</span>
              <span class="muted tiny">{formatInt(sel.runs.reduce((a, r) => a + r.errors, 0))} Fehler</span>
            </div>
            {bestByMerkmal(sel.runs, p.project).map((g) => (
              <div class="stat" key={g.label}>
                <span class="muted tiny">bester {g.best!.label}</span>
                <span class="mono stat-value">
                  {formatNumber(g.value, 2)}
                  {g.best!.unit ? " " + g.best!.unit : ""}
                </span>
                <span class="muted tiny">{g.label}</span>
              </div>
            ))}
          </div>
          {exps.map(([name, runs]) => (
            <div class="exp-card" key={name} data-testid="exp-card">
              <div class="exp-head">
                <span class="mono exp-name">{name}</span>
                <span class="muted tiny">{countLabel(runs.length, "Lauf", "Läufe")}</span>
                <span class="grow" />
                {runs[0].axes.map((a) => (
                  <span class="chip mono" key={a}>
                    {a}
                  </span>
                ))}
              </div>
              {runs.map((r) => (
                <div class="exp-run" key={r.id} data-testid="exp-run" data-run={r.id}>
                  <span class="when-col">
                    <span class="mono">{relTime(p.project.now, r.started)}</span>
                    <span class="mono muted tiny">{stamp(r.started)}</span>
                  </span>
                  <span class="tags">
                    <Flags run={r} current={p.current} />
                    {r.migrated && <span class="flag">migriert</span>}
                  </span>
                  <CellBar run={r} />
                  <Best run={r} />
                  <button class="btn" data-testid="open" onClick={() => p.onOpen(r.id)}>
                    Öffnen
                  </button>
                </div>
              ))}
            </div>
          ))}
        </main>
      )}
    </div>
  );
}
