import type { IssueInfo, RunRow } from "../api";
import { bestText, cellBar, cellText, flags, secondLine, statusColor } from "./model";

export const seriesVar = (index: number) => (index >= 0 ? `var(--series-${index + 1})` : "var(--text-3)");

export function Flags({ run, current }: { run: RunRow; current: string | null }) {
  return (
    <>
      {flags(run, current).map((f) => (
        <span key={f.text} class={"flag " + f.kind} title={f.title}>
          {f.text}
        </span>
      ))}
      {(run.notes ?? 0) > 0 && (
        <span class="run-notes" data-testid="run-notes" title="Eigene Notizen">
          ✎ {run.notes}
        </span>
      )}
    </>
  );
}

export function CellBar({ run }: { run: RunRow }) {
  const bar = cellBar(run);
  return (
    <span class="cells">
      <span class="bar">
        <span class={"bar-ok" + (run.running ? " running" : "")} style={{ width: `${bar.ok}%` }} />
        <span class="bar-err" style={{ width: `${bar.err}%` }} />
      </span>
      <span class={"cell-text mono" + (run.errors && !run.running ? " has-errors" : "")}>{cellText(run)}</span>
    </span>
  );
}

export function Best({ run }: { run: RunRow }) {
  const b = bestText(run);
  return (
    <span class="run-best">
      <span class={"mono best-value" + (run.running ? " provisional" : "")}>{b.value}</span>
      <span class="note">{b.note}</span>
    </span>
  );
}

export function StatusDot({ info }: { info: IssueInfo | undefined }) {
  if (!info?.status) return null; // without a Linear key the status dot is left out
  return <span class="status-dot" style={{ background: statusColor(info) }} />;
}

export { secondLine };
