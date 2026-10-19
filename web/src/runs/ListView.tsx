import type { IssueInfo, ProjectInfo } from "../api";
import { StatusDot } from "./components";
import { RunCard } from "./RunCard";
import { countLabel, isOpen, NO_ISSUE, relTime, type Filters, type Section } from "./model";

export interface ListState {
  sel: Set<string>;
  open: Record<string, boolean>;
  olderOpen: Record<string, boolean>;
  focus: string | null;
}

interface Props {
  project: ProjectInfo;
  sections: Section[];
  issues: Record<string, IssueInfo>;
  filters: Filters;
  state: ListState;
  current: string | null;
  onToggleSel: (id: string) => void;
  onToggleIssue: (key: string, open: boolean) => void;
  onToggleOlder: (exp: string) => void;
  onOpen: (id: string) => void;
  onPath: (path: string) => void;
}

const Caret = ({ open }: { open: boolean }) => (
  <svg class={"caret" + (open ? " open" : "")} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
    <path d="M4 2.5l3.5 3.5L4 9.5" />
  </svg>
);

/** List view (v0.3.2, P): one section per issue, newest first, the runs without issue last; the experiments as cards. */
export function ListView(p: Props) {
  const now = new Date(p.project.now).getTime();
  return (
    <div class="sections">
      {p.sections.map((b) => {
        const none = b.key === NO_ISSUE;
        const info = none ? undefined : p.issues[b.key];
        const open = isOpen(b, now, p.filters, p.state.open[b.key]);
        return (
          <section key={b.key} class="issue-block" data-testid="issue-block" data-issue={b.key}>
            <div class="issue-head">
              <button class="issue-toggle" aria-expanded={open} data-testid="issue-toggle" onClick={() => p.onToggleIssue(b.key, !open)}>
                <Caret open={open} />
                <span class="issue-key mono">{none ? "ohne Issue" : b.key}</span>
                {none ? <span class="issue-title">Läufe ohne Issue</span> : info?.title && <span class="issue-title">{info.title}</span>}
              </button>
              {info?.status && (
                <span class="issue-status" style={{ background: "var(--raised)" }}>
                  <StatusDot info={info} />
                  {info.status}
                </span>
              )}
              {info?.analysis && (
                <button class="link" title={info.analysis} data-testid="link-report" onClick={() => p.onPath(info.analysis!)}>
                  Bericht
                </button>
              )}
              {info?.deliverable && (
                <button class="link" title={info.deliverable} data-testid="link-deliverables" onClick={() => p.onPath(info.deliverable!)}>
                  Deliverables
                </button>
              )}
              <span class="grow" />
              <span class="muted small nowrap">
                {open ? "" : `${countLabel(b.experiments.length, "Experiment", "Experimente")} · `}
                {countLabel(b.runs.length, "Lauf", "Läufe")} · {relTime(p.project.now, b.last)}
              </span>
            </div>
            {open && (
              <div class="cards cols-3">
                {b.experiments.map((e) => (
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
            )}
          </section>
        );
      })}
    </div>
  );
}
