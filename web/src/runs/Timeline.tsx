import type { ProjectInfo, RunRow } from "../api";
import { seriesVar } from "./components";
import { buildTimeline } from "./model";

interface Props {
  runs: RunRow[];
  project: ProjectInfo;
  focus: string | null;
  merkmalLabel: string;
  onPick: (id: string) => void;
}

/** Collapsible strip "Verlauf": best value per run over time, one colour per Lauf-Merkmal value. */
export function Timeline({ runs, project, focus, merkmalLabel, onPick }: Props) {
  const tl = buildTimeline(runs, project);
  if (!tl) return <div class="timeline muted">Noch keine Läufe mit Bestwert.</div>;
  const title = (r: { id: string }, v: number) => `${r.id} · ${v.toFixed(2).replace(".", ",")}`;
  return (
    <div class="timeline" data-testid="timeline">
      <div class="timeline-head">
        <span class="muted small">{tl.label}</span>
        <span class="grow" />
        {tl.series
          .filter((s) => s.index >= 0)
          .map((s) => (
            <span key={s.value} class="legend">
              <span class="legend-dot" style={{ background: seriesVar(s.index) }} />
              {merkmalLabel} {s.value}
            </span>
          ))}
        {tl.series.some((s) => s.index < 0) && (
          <span class="legend">
            <span class="legend-dot" style={{ background: seriesVar(-1) }} />
            Andere
          </span>
        )}
      </div>
      <div class="timeline-body">
        <div class="y-axis mono">
          {tl.yTicks.map((t) => (
            <span key={t.y} style={{ top: `${t.y}%` }}>
              {t.label}
            </span>
          ))}
        </div>
        <div class="plot" role="img" aria-label="Bestwert je Lauf über die Zeit">
          <div class="plot-base" />
          {tl.epochX !== null && <div class="epoch-line" style={{ left: `${tl.epochX}%` }} title="Beginn der aktuellen Epoche" />}
          <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
            {tl.lines.map((l) => (
              <polyline key={l.index} points={l.points} fill="none" stroke={seriesVar(l.index)} stroke-width="1.5" vector-effect="non-scaling-stroke" />
            ))}
          </svg>
          {tl.points.map((p) => (
            <button
              key={p.id}
              class={"dot" + (focus === p.id ? " focus" : "")}
              data-testid="timeline-dot"
              data-run={p.id}
              aria-label={title(p, p.value)}
              title={title(p, p.value)}
              style={{ left: `${p.x}%`, top: `${p.y}%`, background: seriesVar(p.series), opacity: p.older ? 0.4 : 1 }}
              onClick={() => onPick(p.id)}
            />
          ))}
        </div>
      </div>
      <div class="x-axis mono">
        {tl.xTicks.map((t) => (
          <span key={t.x} style={{ left: `${t.x}%` }}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
