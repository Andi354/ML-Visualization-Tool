import type { Metric, OverviewCard, TableResult } from "../api";
import { formatNumber } from "../format";
import { formatMetric } from "./model";

interface Props {
  cards: OverviewCard[];
  result: TableResult;
  metric: Metric | undefined;
  onValue: (dim: string, value: string) => void;
}

/** Strip of small charts: one card per axis (and the channel) plus a histogram of the group means. */
export function Overview({ cards, result, metric, onValue }: Props) {
  // one shared scale for all cards
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of cards)
    for (const v of c.values) {
      if (v.mean === null) continue;
      lo = Math.min(lo, v.mean - (v.std ?? 0));
      hi = Math.max(hi, v.mean + (v.std ?? 0));
    }
  if (!isFinite(lo) || lo === hi) {
    lo = (isFinite(lo) ? lo : 0) - 1;
    hi = hi + 1;
  }
  const pos = (x: number) => ((x - lo) / (hi - lo)) * 100;
  const h = result.histogram;
  const maxCount = Math.max(1, ...h.counts);
  const spread = (c: OverviewCard) => "Spanne " + formatMetric(metric, c.spread, false);
  return (
    <div class="overview" data-testid="overview">
      {cards.map((c) => (
        <div class="ov-card" key={c.key} data-testid="ov-card" data-dim={c.key}>
          <div class="ov-head mono">
            <span class="grow ellipsis">{c.key}</span>
            <span class="muted tiny" data-testid="ov-spread">
              {spread(c)}
            </span>
          </div>
          {c.values.map((v) => {
            const best = v.value === c.best_value;
            return (
              <button
                class="ov-row mono"
                key={v.value}
                data-testid="ov-value"
                data-value={v.value}
                aria-label={`${c.key} = ${v.value}: ${formatMetric(metric, v.mean, false)}`}
                onClick={() => onValue(c.key, v.value)}
              >
                <span class="ov-label ellipsis">{v.value}</span>
                <span class="ov-plot">
                  <span class="ov-axis" />
                  {v.mean !== null && v.std !== null && (
                    <span
                      class="ov-whisker"
                      style={{ left: `${pos(v.mean - v.std)}%`, width: `${pos(v.mean + v.std) - pos(v.mean - v.std)}%` }}
                    />
                  )}
                  {v.mean !== null && (
                    <span class={"ov-dot" + (best ? " best" : "")} style={{ left: `${pos(v.mean)}%` }} />
                  )}
                </span>
                <span class={"ov-val" + (best ? " best" : "")}>{formatMetric(metric, v.mean, false)}</span>
              </button>
            );
          })}
        </div>
      ))}
      {h.counts.length > 0 && (
        <div class="ov-card hist" data-testid="histogram">
          <div class="small muted-2">Verteilung der Gruppenmittel</div>
          <div class="hist-bars" role="img" aria-label="Verteilung der Gruppenmittel">
            {h.counts.map((n, i) => (
              <div
                key={i}
                class={"hist-bar" + (i === h.best_bin ? " best" : "")}
                style={{ height: `${Math.max((n / maxCount) * 100, n ? 4 : 0)}%` }}
                title={`${n}`}
              />
            ))}
          </div>
          <div class="hist-axis mono">
            <span class="best-text">{h.lo !== null ? formatMetric(metric, h.lo, false) : ""}</span>
            <span>{h.hi !== null ? formatMetric(metric, h.hi, false) : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { formatNumber };
