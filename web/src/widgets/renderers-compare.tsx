// Renderers of the two-run and project widgets (feature E).
import { formatMetric } from "../experiment/model";
import { formatNumber } from "../format";
import { bandPath as _unused, linePath, linear, niceTicks, pad, shortDate, spread } from "./charts";
import type { Ctx } from "./renderers";

const W = 600;
export const A_COLOR = "var(--series-1)";
export const B_COLOR = "var(--series-5)";
void _unused;

const mdef = (m: any) => ({ unit: m.unit, scale: m.scale }) as never;
const fmt = (m: any, v: number | null) => formatMetric(mdef(m), v);

function RunKey({ data }: { data: any }) {
  return (
    <div class="w-legend small" data-testid="run-key">
      <span class="legend">
        <span class="legend-dot" style={{ background: A_COLOR }} /> A {data.a.name}
      </span>
      <span class="legend">
        <span class="legend-dot" style={{ background: B_COLOR }} /> B {data.b.name}
      </span>
    </div>
  );
}

const WarnIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18.5v.01" />
  </svg>
);

// --- Config-Unterschiede --------------------------------------------------------------------------
export function ConfigDiff({ data }: { data: any }) {
  return (
    <div class="w-chart" data-testid="chart-config-diff">
      <div class="diff-chips">
        {data.chips.map((c: any) => (
          <span key={c.key} class={"chip mono diff-chip" + (c.merkmal ? " merkmal" : "")} data-testid="diff-chip" data-key={c.key}>
            {c.key} <span class="muted">{c.a}</span> → <span>{c.b}</span>
          </span>
        ))}
        {!data.chips.length && <span class="muted small">keine Unterschiede</span>}
      </div>
      {data.warnings.map((w: any) => (
        <div class="warn-banner" key={w.kind} data-testid="diff-warning" data-kind={w.kind}>
          <WarnIcon />
          <span>{w.text}</span>
        </div>
      ))}
    </div>
  );
}

// --- Wer gewinnt wo? ----------------------------------------------------------------------------------
export function WhoWins({ data }: { data: any }) {
  const maxGap = Math.max(...data.rows.map((r: any) => r.gap), 1e-9);
  return (
    <div class="w-chart" data-testid="chart-who-wins">
      <RunKey data={data} />
      <div class="wins">
        {data.rows.map((r: any) => (
          <div class="wins-row" key={r.key} data-testid="wins-row" data-metric={r.key} data-winner={r.winner ?? ""}>
            <span class="wins-label ellipsis" title={r.key}>
              {r.label}
              {r.family !== "real" && <span class="tag tiny" data-testid="scaled-tag">skaliert</span>}
            </span>
            <span class={"mono wins-val" + (r.winner === "a" ? " best" : "")} data-testid="wins-a">
              {fmt(r, r.a)}
            </span>
            <span class="wins-bar" role="img" aria-label={r.winner ? `${r.winner.toUpperCase()} ist besser` : "gleich"}>
              <span class="wins-centre" />
              {r.winner === "a" && <span class="wins-fill a" style={{ width: `${(r.gap / maxGap) * 50}%` }} data-testid="wins-fill" />}
              {r.winner === "b" && <span class="wins-fill b" style={{ width: `${(r.gap / maxGap) * 50}%` }} data-testid="wins-fill" />}
            </span>
            <span class={"mono wins-val" + (r.winner === "b" ? " best" : "")} data-testid="wins-b">
              {fmt(r, r.b)}
            </span>
          </div>
        ))}
      </div>
      {data.scaled_hidden && <div class="small muted">Skalierte Metriken sind ausgeblendet, weil die Läufe verschiedene Forecaster haben.</div>}
    </div>
  );
}

// --- Beste Config je Lauf ---------------------------------------------------------------------------------
export function BestConfig({ data }: { data: any }) {
  const side = (k: "a" | "b") => {
    const s = data[k];
    const other = k === "a" ? "B" : "A";
    return (
      <div class="bc-side" data-testid={`bc-${k}`}>
        <div class="bc-head">
          <span class="legend-dot" style={{ background: k === "a" ? A_COLOR : B_COLOR }} /> {k.toUpperCase()} <span class="muted small">{data[k].name ?? ""}</span>
        </div>
        <div class="bc-chips">
          {Object.entries(s.combo).map(([a, v]) => (
            <span class="chip mono" key={a}>
              {a} = {v as string}
            </span>
          ))}
        </div>
        <div class="mono bc-value">{fmt(data.metric, s.value)}</div>
        {s.in_other ? (
          <div class={"bc-other small" + (s.in_other.flag ? ` ${s.in_other.flag}` : "")} data-testid={`bc-other-${k}`} data-flag={s.in_other.flag ?? ""}>
            in {other}: <span class="mono">{fmt(data.metric, s.in_other.value)}</span> · Rang {s.in_other.rank} von {s.in_other.of}
          </div>
        ) : (
          <div class="bc-other small muted">in {other} nicht vorhanden</div>
        )}
      </div>
    );
  };
  return (
    <div class="w-chart" data-testid="chart-best-config">
      <div class="bc-grid">
        {side("a")}
        {side("b")}
      </div>
    </div>
  );
}

// --- Alle Kombinationen ----------------------------------------------------------------------------------------
export function AllCombos({ data }: { data: any }) {
  const all: number[] = [...data.a.values, ...data.b.values];
  const [lo, hi] = pad(Math.min(...all), Math.max(...all), 0.05);
  const m = { l: 36, r: 14 };
  const H = 130;
  const x = linear([lo, hi], [m.l, W - m.r]);
  const rowY = { a: 38, b: 92 };
  const jitter = (i: number) => ((i * 37) % 17) - 8;
  const ticks = niceTicks(lo, hi, 5);
  return (
    <div class="w-chart" data-testid="chart-all-combos">
      <svg viewBox={`0 0 ${W} ${H}`} class="w-svg" role="img" aria-label="Alle Kombinationen beider Läufe">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1="6" y2={H - 20} class="w-grid" />
            <text x={x(t)} y={H - 6} class="w-tick" text-anchor="middle">
              {fmt(data.metric, t)}
            </text>
          </g>
        ))}
        {(["a", "b"] as const).map((k) => {
          const run = data[k];
          const color = k === "a" ? A_COLOR : B_COLOR;
          const y = rowY[k];
          return (
            <g key={k} data-testid={`strip-${k}`}>
              <text x="4" y={y + 4} class="w-tick strong">
                {k.toUpperCase()}
              </text>
              <line x1={m.l} x2={W - m.r} y1={y + 20} y2={y + 20} class="w-grid" />
              {run.values.map((v: number, i: number) => (
                <circle key={i} cx={x(v)} cy={y + jitter(i)} r="3" fill={color} opacity="0.7" data-testid={`dot-${k}`} />
              ))}
              <line x1={x(run.median)} x2={x(run.median)} y1={y - 14} y2={y + 14} class="w-mean-tick" data-testid={`median-${k}`} />
              <circle cx={x(run.best)} cy={y} r="6" fill={color} stroke="var(--text)" stroke-width="1.5" data-testid={`best-${k}`} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Regionen -------------------------------------------------------------------------------------------------------
export function RegionsAB({ data }: { data: any }) {
  const rows: any[] = data.rows;
  const max = Math.max(...rows.flatMap((r) => [r.a, r.b]));
  const H = 220;
  const m = { l: 8, r: 8, t: 22, b: 30 };
  const groupW = (W - m.l - m.r) / rows.length;
  const barW = Math.min(40, (groupW - 16) / 2);
  const y = linear([0, max * 1.12], [H - m.b, m.t]);
  return (
    <div class="w-chart" data-testid="chart-regions-ab">
      <RunKey data={data} />
      <svg viewBox={`0 0 ${W} ${H}`} class="w-svg" role="img" aria-label="Je Region A gegen B">
        <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} class="w-grid" />
        {rows.map((r, i) => {
          const x0 = m.l + i * groupW + (groupW - barW * 2 - 4) / 2;
          return (
            <g key={r.channel} data-testid="region-pair" data-channel={r.channel}>
              <rect x={x0} y={y(r.a)} width={barW} height={H - m.b - y(r.a)} fill={A_COLOR} data-testid="bar-a" />
              <rect x={x0 + barW + 4} y={y(r.b)} width={barW} height={H - m.b - y(r.b)} fill={B_COLOR} data-testid="bar-b" />
              <text x={x0 + barW + 2} y={H - 16} class="w-tick" text-anchor="middle">
                {r.channel}
              </text>
              <text x={x0 + barW + 2} y={H - 4} class={"w-tick diff" + (r.diff < 0 ? " good" : "")} text-anchor="middle" data-testid="region-diff">
                {r.diff > 0 ? "+" : r.diff < 0 ? "−" : ""}
                {formatNumber(Math.abs(r.diff), 1)} %
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Umfang und Fehler -------------------------------------------------------------------------------------------------
function duration(seconds: number | null): string {
  if (seconds === null) return "läuft";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function ScopeErrors({ data }: { data: any }) {
  const rows: [string, (s: any) => preact.ComponentChild][] = [
    ["Zellen", (s) => formatNumber(s.cells, 0)],
    [
      "Fehler",
      (s) => (
        <span class={s.errors > data.error_limit ? "error-text" : ""} data-testid="errors-value" data-over={s.errors > data.error_limit}>
          {formatNumber(s.errors, 0)}
        </span>
      ),
    ],
    ["Dauer", (s) => duration(s.duration)],
    ...(data.a.merkmal as any[]).map((m, i): [string, (s: any) => preact.ComponentChild] => [m.label, (s) => s.merkmal[i]?.value ?? "–"]),
    ["Epoche", (s) => s.epoch ?? "–"],
  ];
  return (
    <div class="w-chart" data-testid="chart-scope-errors">
      <table class="w-table">
        <thead>
          <tr>
            <th />
            <th>
              <span class="legend-dot" style={{ background: A_COLOR }} /> A
            </th>
            <th>
              <span class="legend-dot" style={{ background: B_COLOR }} /> B
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label} data-testid="scope-row" data-label={label}>
              <th>{label}</th>
              <td class="mono num">{f(data.a)}</td>
              <td class="mono num">{f(data.b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Wirkung je Parameter ------------------------------------------------------------------------------------------------
export function ParamEffect({ data }: { data: any }) {
  const scale = data.scale as number;
  const rowH = 22;
  const left = 150;
  const H = data.rows.length * rowH + 28;
  const x = linear([-scale, scale], [left, W - 20]);
  const clamp = (v: number) => Math.max(-scale, Math.min(scale, v));
  return (
    <div class="w-chart" data-testid="chart-param-effect">
      <RunKey data={data} />
      <svg viewBox={`0 0 ${W} ${H}`} class="w-svg" role="img" aria-label="Wirkung je Parameterwert in A und B">
        {[-8, -4, 0, 4, 8].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1="0" y2={H - 20} class={t === 0 ? "w-zero" : "w-grid"} />
            <text x={x(t)} y={H - 6} class="w-tick" text-anchor="middle">
              {t > 0 ? "+" : t < 0 ? "−" : ""}
              {Math.abs(t)} %
            </text>
          </g>
        ))}
        {data.rows.map((r: any, i: number) => {
          const cy = i * rowH + rowH / 2 + 2;
          return (
            <g key={`${r.axis}-${r.value}`} data-testid="effect-pair" data-axis={r.axis} data-value={r.value} data-flips={r.flips}>
              <text x={left - 8} y={cy + 3} class="w-tick strong" text-anchor="end">
                {`${r.axis} = ${r.value}`.slice(0, 26)}
              </text>
              <line x1={x(clamp(r.a))} x2={x(clamp(r.b))} y1={cy} y2={cy} class="dumbbell" />
              <circle cx={x(clamp(r.a))} cy={cy} r="4" fill={A_COLOR} data-testid="effect-a" />
              <circle cx={x(clamp(r.b))} cy={cy} r="4" fill={B_COLOR} data-testid="effect-b" />
              {r.flips && (
                <text x={W - 2} y={cy + 3} class="w-tick warn-fill" text-anchor="end" data-testid="flip-tag">
                  kippt
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Hält die Rangfolge? ---------------------------------------------------------------------------------------------------
export function RankStability({ data }: { data: any }) {
  const n = data.n;
  const S = 260;
  const m = 34;
  const x = linear([1, n], [m, S - 10]);
  const y = linear([1, n], [S - m, 10]);
  return (
    <div class="w-chart" data-testid="chart-rank-stability">
      <svg viewBox={`0 0 ${S} ${S}`} class="w-svg rank-svg" role="img" aria-label="Rang in A gegen Rang in B">
        <line x1={x(1)} y1={y(1)} x2={x(n)} y2={y(n)} class="w-best-epoch" data-testid="diagonal" />
        {data.points.map((p: any, i: number) => (
          <circle key={i} cx={x(p.a)} cy={y(p.b)} r="3.5" fill={A_COLOR} opacity="0.8" data-testid="rank-point">
            <title>{`${Object.entries(p.combo).map(([k, v]) => `${k} = ${v}`).join(", ")}: A ${p.a}, B ${p.b}`}</title>
          </circle>
        ))}
        <text x={S / 2} y={S - 6} class="w-tick" text-anchor="middle">
          Rang in A
        </text>
        <text x="10" y={S / 2} class="w-tick" text-anchor="middle" transform={`rotate(-90 10 ${S / 2})`}>
          Rang in B
        </text>
      </svg>
      <div class="rank-stats mono small">
        <span data-testid="spearman">Spearman {formatNumber(data.spearman, 2)}</span>
        <span data-testid="top-overlap">
          Top {data.top_overlap[1]}: {data.top_overlap[0]} gemeinsam
        </span>
        <span data-testid="best-rank">Bestes von A ist in B Rang {data.best_a_rank_in_b}</span>
      </div>
    </div>
  );
}

export function RankJumps({ data }: { data: any }) {
  const max = Math.max(...data.rows.map((r: any) => r.jump), 1);
  return (
    <div class="w-chart" data-testid="chart-rank-jumps">
      <table class="w-table">
        <thead>
          <tr>
            <th>Kombination</th>
            <th>A</th>
            <th>B</th>
            <th>Sprung</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r: any, i: number) => (
            <tr key={i} data-testid="jump-row">
              <th class="mono">{Object.entries(r.combo).map(([k, v]) => `${k} = ${v}`).join(", ") || "–"}</th>
              <td class="mono num">{r.a}</td>
              <td class="mono num">{r.b}</td>
              <td>
                <span class="jump-bar" style={{ width: `${(r.jump / max) * 100}%` }} />
                <span class="mono small"> {r.jump}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Bester Wert je Lauf (Projektverlauf) ------------------------------------------------------------------------------------
export function ProjectBest({ data, ctx }: { data: any; ctx: Ctx }) {
  const pts: any[] = data.points;
  const selected: string[] = ctx.selection?.runs ?? data.default_runs;
  const H = 280;
  const m = { l: 52, r: 16, t: 20, b: 28 };
  const ts = pts.map((p) => new Date(p.date).getTime());
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const dayMs = 86_400_000;
  const x = linear([t0 - dayMs, t1 + dayMs], [m.l, W - m.r]);
  const vals: number[] = pts.map((p) => p.value);
  const [v0, v1] = pad(Math.min(...vals), Math.max(...vals), 0.12);
  const y = linear([v0, v1], [H - m.b, m.t]);
  const epochX = data.epoch_since ? x(new Date(data.epoch_since).getTime()) : null;
  const colorOf = (s: string | null) => {
    const i = data.series.findIndex((x: any) => x.value === s);
    return i < 0 || data.series[i].index < 0 ? (s === null ? "var(--series-1)" : "var(--text-3)") : `var(--series-${data.series[i].index + 1})`;
  };
  const sc = data.metric.scale as number;
  const yTicks = niceTicks(v0 * sc, v1 * sc, 4);
  const xTicks = spread(8, 5).map((i) => t0 + ((t1 - t0) * i) / 7);
  return (
    <div class="w-chart" data-testid="chart-project-best">
      <div class="w-legend small">
        {data.series
          .filter((s: any) => s.index >= 0)
          .map((s: any) => (
            <span class="legend" key={s.value}>
              <span class="legend-dot" style={{ background: `var(--series-${s.index + 1})` }} /> {data.color_label} {s.value}
            </span>
          ))}
        {data.series.some((s: any) => s.index < 0) && (
          <span class="legend">
            <span class="legend-dot" style={{ background: "var(--text-3)" }} /> Andere
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} class="w-svg" role="img" aria-label="Bester Wert je Lauf über die Zeit">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t / sc)} y2={y(t / sc)} class="w-grid" />
            <text x={m.l - 6} y={y(t / sc) + 3} class="w-tick" text-anchor="end">
              {formatNumber(t, 1)}
              {data.metric.unit ? " " + data.metric.unit : ""}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={x(t)} y={H - 8} class="w-tick" text-anchor="middle">
            {shortDate(new Date(t).toISOString().slice(0, 10))}
          </text>
        ))}
        {epochX !== null && epochX > m.l && <line x1={epochX} x2={epochX} y1={m.t} y2={H - m.b} class="w-best-epoch" data-testid="epoch-line" />}
        {data.lines.map((l: any, i: number) => {
          const xs: number[] = [];
          const ys: number[] = [];
          l.points.forEach((p: any, j: number) => {
            const px = x(new Date(p.date).getTime());
            if (j > 0) {
              xs.push(px);
              ys.push(ys[ys.length - 1]);
            }
            xs.push(px);
            ys.push(y(p.value));
          });
          xs.push(W - m.r);
          ys.push(ys[ys.length - 1]);
          return <path key={i} d={linePath(xs, ys)} class="w-line thick" stroke={colorOf(l.series)} data-testid="best-line" />;
        })}
        {pts.map((p) => {
          const px = x(new Date(p.date).getTime());
          const py = y(p.value);
          const sel = selected.includes(p.id);
          const col = colorOf(p.series);
          return (
            <g
              key={p.id}
              class="pb-point"
              data-testid="pb-point"
              data-run={p.id}
              data-older={p.older}
              data-selected={sel}
              role="button"
              tabIndex={0}
              aria-pressed={sel}
              aria-label={`${p.label}${p.running ? " (vorläufig)" : ""}`}
              onClick={() => ctx.selection?.toggle(p.id, selected)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ctx.selection?.toggle(p.id, selected)}
            >
              {sel && <circle cx={px} cy={py} r="9" fill="none" stroke="var(--accent)" stroke-width="2" data-testid="selected-ring" />}
              <circle cx={px} cy={py} r="5" fill={p.older ? "var(--bg)" : col} stroke={col} stroke-width="2" stroke-dasharray={p.running ? "2 2" : undefined} />
              <text x={px} y={py - 10} class="w-tick" text-anchor="middle">
                {p.label}
                {p.running ? " vorläufig" : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Parameter-Landkarte ----------------------------------------------------------------------------------------------------------
export function ParamMap({ data }: { data: any }) {
  const cap = data.cap as number;
  const groups: (string | null)[] = data.groups;
  const better = data.metric.direction !== "max";
  const cell = (e: number | null) => {
    if (e === null) return <td class="pm-cell empty" data-testid="pm-cell" data-empty="true" />;
    const good = (e < 0) === better;
    const alpha = 0.12 + 0.78 * Math.min(Math.abs(e) / cap, 1);
    return (
      <td
        class="pm-cell mono"
        data-testid="pm-cell"
        data-empty="false"
        data-direction={good ? "better" : "worse"}
        style={{ background: `color-mix(in srgb, ${good ? "var(--better)" : "var(--worse)"} ${Math.round(alpha * 100)}%, transparent)` }}
        title={`${e > 0 ? "+" : "−"}${formatNumber(Math.abs(e), 1)} %`}
      >
        {e > 0 ? "+" : e < 0 ? "−" : ""}
        {formatNumber(Math.abs(Math.min(Math.abs(e), 99)), 1)}
      </td>
    );
  };
  const spans = groups.map((g) => ({ g, n: data.runs.filter((r: any) => r.group === g).length }));
  return (
    <div class="w-chart w-scroll" data-testid="chart-param-map">
      <table class="w-table pm-table">
        <thead>
          {data.color_label && (
            <tr>
              <th />
              {spans.map((s) => (
                <th key={String(s.g)} colSpan={s.n} class="group-head mono">
                  {data.color_label} {s.g}
                </th>
              ))}
              {groups.length > 1 || data.color_label ? (
                <th colSpan={groups.length} class="group-head">
                  Konsistenz
                </th>
              ) : null}
            </tr>
          )}
          <tr>
            <th>Parameter</th>
            {data.runs.map((r: any) => (
              <th key={r.id} class="mono pm-run" title={r.id}>
                {r.label}
              </th>
            ))}
            {data.color_label && groups.map((g) => <th key={`c-${String(g)}`} class="mono">{g}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r: any) => (
            <tr key={`${r.axis}=${r.value}`} data-testid="pm-row" data-axis={r.axis} data-value={r.value} data-flips={r.flips}>
              <th class="mono row-head">
                {r.axis} = {r.value}
              </th>
              {r.cells.map((e: number | null, i: number) => (
                <>{cell(e)}</>
              ))}
              {data.color_label &&
                r.consistency.map((c: any) => (
                  <td key={String(c.group)} class={"pm-cons small" + (r.flips ? " warn" : "")} data-testid="pm-consistency">
                    {c.text ?? "–"}
                  </td>
                ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
