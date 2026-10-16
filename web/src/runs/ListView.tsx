import type { IssueInfo, ProjectInfo, RunRow } from "../api";
import { Best, CellBar, Flags, StatusDot, secondLine } from "./components";
import { relTime, shortName, stamp, statusColor, countLabel, isOpen, type Block, type Experiment, type Filters } from "./model";

export interface ListState {
  sel: Set<string>;
  open: Record<string, boolean>;
  olderOpen: Record<string, boolean>;
  focus: string | null;
}

interface Props {
  project: ProjectInfo;
  blocks: Block[];
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

function Row({
  run,
  older,
  standalone,
  project,
  current,
  p,
  hasOlder,
  olderCount,
  olderOpen,
}: {
  run: RunRow;
  older: boolean;
  standalone: boolean;
  project: ProjectInfo;
  current: string | null;
  p: Props;
  hasOlder?: boolean;
  olderCount?: number;
  olderOpen?: boolean;
}) {
  const focused = p.state.focus === run.id;
  const name = older ? "↳ " + run.id.slice(0, 15) : standalone ? run.name : shortName(run);
  return (
    <div
      class={"run-row" + (older ? " older" : "") + (standalone ? " standalone" : "") + (focused ? " focused" : "")}
      data-testid={older ? "older-row" : "run-row"}
      data-run={run.id}
      onClick={() => p.onOpen(run.id)}
    >
      <input
        type="checkbox"
        aria-label="zum Vergleich auswählen"
        data-testid="sel"
        checked={p.state.sel.has(run.id)}
        onClick={(e) => e.stopPropagation()}
        onChange={() => p.onToggleSel(run.id)}
      />
      <span class="name-col">
        <span class="name-line">
          <a
            class="run-name mono"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              p.onOpen(run.id);
            }}
          >
            {name}
          </a>
          <Flags run={run} current={current} />
        </span>
        {run.short && (
          <span class="short-line" data-testid="short" title={run.short}>
            {run.short}
          </span>
        )}
        <span class="sub mono">{secondLine(run, standalone)}</span>
        {hasOlder && (
          <button
            class="older-toggle"
            data-testid="older-toggle"
            aria-expanded={!!olderOpen}
            onClick={(e) => {
              e.stopPropagation();
              p.onToggleOlder(run.name);
            }}
          >
            {(olderOpen ? "▾ " : "▸ ") + olderCount + (olderCount === 1 ? " älterer Lauf" : " ältere Läufe")}
          </button>
        )}
      </span>
      <span class="when mono">{relTime(project.now, run.started)}</span>
      <CellBar run={run} />
      <Best run={run} />
    </div>
  );
}

function Experiments({ exps, p, current }: { exps: Experiment[]; p: Props; current: string | null }) {
  return (
    <>
      {exps.map((e) => {
        const open = !!p.state.olderOpen[e.name];
        return (
          <div key={e.name}>
            <Row
              run={e.runs[0]}
              older={false}
              standalone={false}
              project={p.project}
              current={current}
              p={p}
              hasOlder={e.runs.length > 1}
              olderCount={e.runs.length - 1}
              olderOpen={open}
            />
            {open &&
              e.runs.slice(1).map((r) => (
                <Row key={r.id} run={r} older standalone={false} project={p.project} current={current} p={p} />
              ))}
          </div>
        );
      })}
    </>
  );
}

export function ListView(p: Props) {
  const now = new Date(p.project.now).getTime();
  return (
    <div class="blocks">
      {p.blocks.map((b) => {
        if (b.kind === "standalone")
          return <Row key={b.key} run={b.run} older={false} standalone project={p.project} current={p.current} p={p} />;
        const info = p.issues[b.key];
        const open = isOpen(b, now, p.filters, p.state.open[b.key]);
        return (
          <section key={b.key} class="issue-block" data-testid="issue-block" data-issue={b.key}>
            <div class="issue-head">
              <button class="issue-toggle" aria-expanded={open} data-testid="issue-toggle" onClick={() => p.onToggleIssue(b.key, !open)}>
                <span class="caret">{open ? "▾" : "▸"}</span>
                <span class="issue-key mono">{b.key}</span>
                {info?.title && <span class="issue-title">{info.title}</span>}
              </button>
              {info?.status && (
                <span class="issue-status">
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
              <span class="muted small nowrap">
                {countLabel(b.runs.length, "Lauf", "Läufe")} · {relTime(p.project.now, b.last)}
              </span>
            </div>
            {open && <Experiments exps={b.experiments} p={p} current={p.current} />}
          </section>
        );
      })}
    </div>
  );
}

export { stamp, statusColor };
