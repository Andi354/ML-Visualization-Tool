import { useMemo } from "preact/hooks";
import type { IssueInfo, ProjectInfo, RunRow } from "../api";
import { StatusDot } from "./components";
import type { ListState } from "./ListView";
import { RunCard } from "./RunCard";
import { buildSections, countLabel, NO_ISSUE, relTime, statusColor, type Section } from "./model";

export { NO_ISSUE };

/** Search in the Issues view: issue ID, issue title, run names, axis names and the short description. */
export function entryMatches(e: Pick<Section, "key" | "runs">, issues: Record<string, IssueInfo>, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [e.key, issues[e.key]?.title ?? "", ...e.runs.map((r) => `${r.id} ${r.axes.join(" ")} ${r.short ?? ""}`)];
  return hay.join(" ").toLowerCase().includes(s);
}

interface Props {
  project: ProjectInfo;
  runs: RunRow[];
  issues: Record<string, IssueInfo>;
  q: string;
  onQ: (q: string) => void;
  selected: string | null;
  current: string | null;
  state: ListState;
  onSelect: (key: string) => void;
  onToggleSel: (id: string) => void;
  onToggleOlder: (exp: string) => void;
  onOpen: (id: string) => void;
  onPath: (path: string) => void;
}

/** Issues view (v0.3.2, P): the issue list on the left, the chosen issue with its experiment cards on the right. */
export function IssuesView(p: Props) {
  const entries = useMemo(() => buildSections(p.runs), [p.runs]);
  const shown = entries.filter((e) => entryMatches(e, p.issues, p.q));
  // Initial selection: the issue of the newest run.
  const sel = entries.find((e) => e.key === p.selected) ?? entries[0];
  const none = sel?.key === NO_ISSUE;
  const info = sel && !none ? p.issues[sel.key] : undefined;

  return (
    <div class="issues-view">
      <aside class="issue-list" data-testid="issue-list">
        <input
          type="search"
          class="search"
          placeholder="Issue oder Lauf suchen"
          aria-label="Issues durchsuchen"
          data-testid="search"
          value={p.q}
          onInput={(e) => p.onQ((e.target as HTMLInputElement).value)}
        />
        <div class="issue-list-gap" />
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
                <span class="muted tiny">{relTime(p.project.now, e.last)}</span>
                {running && <span class="running-flag">● läuft</span>}
                <span class="grow" />
                <span class="muted tiny mono">{e.runs.length}</span>
              </span>
              <span class="issue-item-title">{e.key === NO_ISSUE ? "Läufe ohne zugeordnetes Issue" : (i?.title ?? "")}</span>
              {i?.status && <span class="muted tiny issue-item-meta">{i.status}</span>}
            </button>
          );
        })}
        {!shown.length && <div class="muted small pad">Keine Treffer.</div>}
      </aside>
      {sel && (
        <main class="issue-detail" data-testid="issue-detail" data-issue={sel.key}>
          <div class="issue-detail-head">
            <div class="issue-detail-line">
              <span class="mono issue-detail-key">{none ? "Ohne Issue" : sel.key}</span>
              {info?.status && (
                <span class="status-pill" style={{ color: statusColor(info) }}>
                  {info.status}
                </span>
              )}
              <span class="grow" />
              {info?.url && (
                <a class="pill-link" href={info.url} target="_blank" rel="noreferrer">
                  In Linear ↗
                </a>
              )}
              {info?.analysis && (
                <button class="pill-link" title={info.analysis} data-testid="link-report" onClick={() => p.onPath(info.analysis!)}>
                  Bericht
                </button>
              )}
              {info?.deliverable && (
                <button class="pill-link" title={info.deliverable} data-testid="link-deliverables" onClick={() => p.onPath(info.deliverable!)}>
                  Deliverables
                </button>
              )}
            </div>
            <h1>{none ? "Läufe ohne zugeordnetes Issue" : (info?.title ?? sel.key)}</h1>
            <div class="muted" data-testid="issue-meta">
              {countLabel(sel.experiments.length, "Experiment", "Experimente")} · {countLabel(sel.runs.length, "Lauf", "Läufe")} · zuletzt {relTime(p.project.now, sel.last)}
            </div>
          </div>
          <div class="cards cols-2">
            {sel.experiments.map((e) => (
              <RunCard
                key={e.name}
                run={e.runs[0]}
                older={e.runs.slice(1)}
                project={p.project}
                current={p.current}
                selected={p.state.sel}
                focus={p.state.focus}
                olderOpen={!!p.state.olderOpen[e.name]}
                onToggleSel={p.onToggleSel}
                onToggleOlder={() => p.onToggleOlder(e.name)}
                onOpen={p.onOpen}
              />
            ))}
          </div>
        </main>
      )}
    </div>
  );
}
