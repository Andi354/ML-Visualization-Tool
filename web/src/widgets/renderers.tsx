import { Val } from "./header";
import type { ProjectInfo, RunInfo, WidgetResult } from "../api";
import type { ConfigInfo } from "../api";
import { ConfigBlocks, ConfigView, Legend as ConfigLegend, type ConfigMode } from "../config/ConfigView";
import { formatMetric } from "../experiment/model";
import { formatNumber } from "../format";
import { OwnChart } from "./own";
import { bandPath, centredStart, linePath, linear, niceTicks, pad, shortDate, spread } from "./charts";
import { AllCombos, BestConfig, ConfigDiff, ParamEffect, ParamMap, ProjectBest, RankJumps, RankStability, RegionsAB, ScopeErrors, WhoWins } from "./renderers-compare";

export interface Ctx {
  project: ProjectInfo;
  run: RunInfo;
  combo: Record<string, string>;
  settings: Record<string, string | null>;
  onSettings: (patch: Record<string, string | null>) => void;
  /** Config data loaded in advance (export renders synchronously). */
  configData?: ConfigInfo;
  /** Scope of the board; "run" boards show the whole config blocks open. */
  scope?: string;
  selection?: { runs: string[] | null; toggle: (id: string, current: string[]) => void };
}

const W = 600;

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div class="w-legend small">
      {items.map((i) => (
        <span key={i.label} class="legend">
          <span class={"legend-line" + (i.dashed ? " dashed" : "")} style={{ background: i.dashed ? undefined : i.color, borderColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// --- Loss-Kurven --------------------------------------------------------------------------------
export function CurvesChart({ data }: { data: any }) {
  const H = 220;
  const m = { l: 48, r: 12, t: 10, b: 26 };
  const epochs: number[] = data.epochs;
  const all: number[] = [...data.mean.train, ...data.mean.val, ...(data.mode === "single" ? data.seeds.flatMap((s: any) => [...s.train, ...s.val]) : [])];
  const [y0, y1] = pad(Math.min(...all), Math.max(...all));
  const x = linear([epochs[0], epochs[epochs.length - 1]], [m.l, W - m.r]);
  const y = linear([y0, y1], [H - m.b, m.t]);
  const xs = epochs.map(x);
  const line = (vals: number[]) => linePath(xs, vals.map(y));
  const yTicks = niceTicks(y0, y1, 4);
  const xTicks = niceTicks(epochs[0], epochs[epochs.length - 1], 5);
  const colors = { train: "var(--series-1)", val: "var(--series-2)" };
  return (
    <div class="w-chart" data-testid="chart-curves">
      <Legend items={[{ label: "train_loss", color: colors.train }, { label: "val_loss", color: colors.val }]} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Loss-Kurven" class="w-svg">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} class="w-grid" />
            <text x={m.l - 6} y={y(t) + 3} class="w-tick" text-anchor="end">
              {formatNumber(t, 2)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 8} class="w-tick" text-anchor="middle">
            {t}
          </text>
        ))}
        {data.mode === "single" &&
          data.seeds.flatMap((s: any, i: number) => [
            <path key={`t${i}`} d={line(s.train)} stroke={colors.train} class="w-line thin" data-testid="seed-line" />,
            <path key={`v${i}`} d={line(s.val)} stroke={colors.val} class="w-line thin" data-testid="seed-line" />,
          ])}
        <path d={line(data.mean.train)} stroke={colors.train} class="w-line thick" data-testid="mean-line" />
        <path d={line(data.mean.val)} stroke={colors.val} class="w-line thick" data-testid="mean-line" />
        <line x1={x(data.best_epoch)} x2={x(data.best_epoch)} y1={m.t} y2={H - m.b} class="w-best-epoch" data-testid="best-epoch" />
        <text
          x={x(data.best_epoch) + (x(data.best_epoch) > W * 0.8 ? -4 : 4)}
          y={m.t + 9}
          class="w-tick"
          text-anchor={x(data.best_epoch) > W * 0.8 ? "end" : "start"}
        >
          Epoche {data.best_epoch}
        </text>
      </svg>
    </div>
  );
}

// --- Vorhersage -----------------------------------------------------------------------------------
export function ForecastChart({ data, onWindow }: { data: any; onWindow: (isoStart: string) => void }) {
  const s = data.series;
  const n = s.dates.length;
  const H1 = 170;
  const H2 = 64;
  const m = { l: 48, r: 12, t: 10, b: 4 };
  const x = linear([0, Math.max(n - 1, 1)], [m.l, W - m.r]);
  const xs = s.dates.map((_: string, i: number) => x(i));
  const cmp = data.compare;
  const vals: number[] = [...s.actual, ...s.min, ...s.max, ...(cmp ? cmp.mean : [])];
  const [y0, y1] = pad(Math.min(...vals), Math.max(...vals));
  const y = linear([y0, y1], [H1 - m.b, m.t]);
  const errAbs = Math.max(1, ...s.error.map((e: number) => Math.abs(e)));
  const ye = linear([-errAbs, errAbs], [H2 - 6, 6]);
  const labels = spread(n, 5);
  const ticks = niceTicks(y0, y1, 3);
  return (
    <div class="w-chart" data-testid="chart-forecast">
      <Legend
        items={[
          { label: "echt", color: "var(--text-2)" },
          { label: "Vorhersage", color: "var(--series-1)" },
          ...(cmp ? [{ label: cmp.label, color: "var(--series-5)", dashed: true }] : []),
        ]}
      />
      <svg viewBox={`0 0 ${W} ${H1}`} class="w-svg" role="img" aria-label="Vorhersage und echte Werte">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} class="w-grid" />
            <text x={m.l - 6} y={y(t) + 3} class="w-tick" text-anchor="end">
              {formatNumber(t, 0)}
            </text>
          </g>
        ))}
        <path d={bandPath(xs, s.min.map(y), s.max.map(y))} fill="var(--series-1)" opacity="0.18" data-testid="band" />
        <path d={linePath(xs, s.actual.map(y))} class="w-line thick actual" data-testid="actual-line" />
        <path d={linePath(xs, s.mean.map(y))} stroke="var(--series-1)" class="w-line thick" data-testid="pred-line" />
        {cmp && <path d={linePath(xs, cmp.mean.map(y))} stroke="var(--series-5)" class="w-line thick dashed" data-testid="compare-line" />}
      </svg>
      <svg viewBox={`0 0 ${W} ${H2 + 16}`} class="w-svg" role="img" aria-label="Fehler in Prozent" data-testid="error-panel">
        <line x1={m.l} x2={W - m.r} y1={ye(0)} y2={ye(0)} class="w-zero" data-testid="zero-line" />
        <text x={m.l - 6} y={ye(0) + 3} class="w-tick" text-anchor="end">
          0 %
        </text>
        <text x={m.l - 6} y={ye(errAbs) + 3} class="w-tick" text-anchor="end">
          +{formatNumber(errAbs, 0)}
        </text>
        <text x={m.l - 6} y={ye(-errAbs) + 3} class="w-tick" text-anchor="end">
          −{formatNumber(errAbs, 0)}
        </text>
        <path d={linePath(xs, s.error.map(ye))} stroke="var(--series-1)" class="w-line" />
        {labels.map((i) => (
          <text key={i} x={xs[i]} y={H2 + 12} class="w-tick" text-anchor="middle">
            {shortDate(s.dates[i])}
          </text>
        ))}
      </svg>
      <Overview data={data} onWindow={onWindow} />
    </div>
  );
}

function Overview({ data, onWindow }: { data: any; onWindow: (isoStart: string) => void }) {
  const o = data.overview;
  const len = o.dates.length;
  const H = 48;
  const x = linear([0, Math.max(len - 1, 1)], [0, W]);
  const [a0, a1] = pad(Math.min(...o.actual), Math.max(...o.actual));
  const y = linear([a0, a1], [H - 4, 4]);
  const startIdx = Math.max(o.dates.indexOf(data.window.start), 0);
  const endIdx = Math.max(o.dates.indexOf(data.window.end), startIdx);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      class="w-svg w-overview"
      role="img"
      aria-label="Gesamter Testzeitraum, Klick setzt das Fenster"
      data-testid="forecast-overview"
      onClick={(e) => {
        const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const idx = Math.round(((e.clientX - box.left) / box.width) * (len - 1));
        const start = centredStart(idx, data.window.days, len);
        onWindow(o.dates[start]);
      }}
    >
      <rect x={x(startIdx)} y="0" width={Math.max(x(endIdx) - x(startIdx), 2)} height={H} class="w-window" data-testid="window-marker" />
      <path d={linePath(o.dates.map((_: string, i: number) => x(i)), o.actual.map(y))} class="w-line actual" />
    </svg>
  );
}

// --- Wiederholungen -------------------------------------------------------------------------------
export function ReplicatesGrid({ data, project }: { data: any; project: ProjectInfo }) {
  const metric = project.metrics.find((m) => m.key === data.metric.key);
  const worse = (v: number) => {
    const t = data.hi === data.lo ? 0 : (v - data.lo) / (data.hi - data.lo);
    return data.metric.direction === "max" ? 1 - t : t; // 0 = best, 1 = worst
  };
  return (
    <div class="w-chart" data-testid="chart-replicates">
      <table class="rep-grid">
        <thead>
          <tr>
            <th class="mono">
              {data.row_key}
              {data.col_key ? ` \\ ${data.col_key}` : ""}
            </th>
            {data.cols.map((c: string) => (
              <th key={c} class="mono">
                {data.col_key ? `${data.col_key} ${c}` : data.metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r: string, i: number) => (
            <tr key={r}>
              <th class="mono"><Val v={r} /></th>
              {data.grid[i].map((c: any, j: number) => (
                <td
                  key={j}
                  class={"rep-cell mono" + (c.value === null ? " empty" : "") + (data.best.row === r && data.best.col === data.cols[j] ? " best" : "")}
                  data-testid="rep-cell"
                  data-failed={c.failed}
                  style={c.value === null ? undefined : { background: `color-mix(in srgb, var(--accent) ${Math.round(20 + 60 * (1 - worse(c.value)))}%, transparent)` }}
                >
                  {c.value === null ? "" : formatMetric(metric, c.value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Vergleichstabelle --------------------------------------------------------------------------
const metricOf = (c: { unit: string; scale: number }) => ({ unit: c.unit, scale: c.scale }) as never;

export function CompareTable({ data }: { data: any }) {
  const groups: (string | null)[] = data.groups;
  return (
    <div class="w-chart w-scroll" data-testid="chart-compare-table">
      <table class="w-table">
        <thead>
          {groups[0] !== null && (
            <tr>
              <th />
              {groups.map((g) => (
                <th key={g} colSpan={data.columns.length} class="group-head mono">
                  {data.groups_key} {g}
                </th>
              ))}
            </tr>
          )}
          <tr>
            <th class="mono">{data.row_key}</th>
            {groups.flatMap((g) => data.columns.map((c: any) => <th key={`${g}-${c.key}`}>{c.label}</th>))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r: string, i: number) => (
            <tr key={r} class={data.own_row === r ? "own" : ""} data-testid="ct-row" data-row={r}>
              <th class="mono row-head"><Val v={r} /></th>
              {data.cells[i].flatMap((block: any, gi: number) =>
                data.columns.map((c: any) => {
                  const cell = block[c.key];
                  return (
                    <td
                      key={`${gi}-${c.key}`}
                      class={"mono num" + (cell.best ? " best" : "")}
                      data-testid="ct-cell"
                      data-best={cell.best}
                    >
                      {formatMetric(metricOf(c), cell.value)}
                    </td>
                  );
                }),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Je Region ------------------------------------------------------------------------------------
export function RegionChart({ data }: { data: any }) {
  const m = metricOf(data.metric);
  const colors = data.series.map((_: string, i: number) => `var(--series-${[1, 2, 3, 4, 5, 6][i] ?? 6})`);
  if (data.format === "bars") {
    const vals = data.grid.flat().map((c: any) => c.value).filter((v: number | null) => v !== null) as number[];
    const max = Math.max(...vals);
    const H = 220;
    const m0 = { l: 8, r: 8, t: 20, b: 26 };
    const groupW = (W - m0.l - m0.r) / data.channels.length;
    const barW = Math.min(36, (groupW - 14) / data.series.length);
    const y = linear([0, max * 1.12], [H - m0.b, m0.t]);
    return (
      <div class="w-chart" data-testid="chart-region-bars">
        <Legend items={data.series.map((s: string, i: number) => ({ label: s, color: colors[i] }))} />
        <svg viewBox={`0 0 ${W} ${H}`} class="w-svg" role="img" aria-label="Je Region">
          <line x1={m0.l} x2={W - m0.r} y1={H - m0.b} y2={H - m0.b} class="w-grid" />
          {data.channels.map((c: string, ci: number) => {
            const x0 = m0.l + ci * groupW + (groupW - barW * data.series.length) / 2;
            return (
              <g key={c}>
                {data.series.map((s: string, si: number) => {
                  const v = data.grid[ci][si].value;
                  if (v === null) return null;
                  return (
                    <g key={s}>
                      <rect x={x0 + si * barW} y={y(v)} width={barW - 2} height={H - m0.b - y(v)} fill={colors[si]} data-testid="region-bar" />
                      <text x={x0 + si * barW + (barW - 2) / 2} y={y(v) - 4} class="w-tick" text-anchor="middle">
                        {formatMetric(m, v, false)}
                      </text>
                    </g>
                  );
                })}
                <text x={m0.l + ci * groupW + groupW / 2} y={H - 8} class="w-tick" text-anchor="middle">
                  {c}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }
  return (
    <div class="w-chart w-scroll" data-testid="chart-region-table">
      <table class="w-table">
        <thead>
          <tr>
            <th class="mono">Region</th>
            {data.series.map((s: string, i: number) => (
              <th key={s} class="mono">
                <span class="legend-dot" style={{ background: colors[i] }} /> {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.channels.map((c: string, ci: number) => (
            <tr key={c} data-testid="region-row" data-channel={c}>
              <th class="mono row-head">{c}</th>
              {data.grid[ci].map((cell: any, si: number) => (
                <td key={si} class={"mono num" + (cell.best ? " best" : "")} data-testid="region-cell" data-best={cell.best}>
                  {formatMetric(m, cell.value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Wirkung je Achse ------------------------------------------------------------------------------
export function AxisEffect({ data }: { data: any }) {
  const max = Math.max(...data.axes.map((a: any) => a.spread), 1);
  return (
    <div class="w-chart" data-testid="chart-axis-effect">
      {data.axes.map((a: any) => (
        <div class="effect-row" key={a.axis} data-testid="effect-row" data-axis={a.axis}>
          <span class="mono effect-label ellipsis" title={a.axis}>
            {a.axis}
          </span>
          <span class="effect-track">
            <span class="effect-bar" style={{ width: `${(a.spread / max) * 100}%` }} />
          </span>
          <span class="mono effect-value">{formatNumber(a.spread, 1)} %</span>
          <span class="effect-best small muted ellipsis">
            bester Wert: <span class="mono">{a.best}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// --- Stabilität ---------------------------------------------------------------------------------------
export function StabilityChart({ data }: { data: any }) {
  const m = metricOf(data.metric);
  const all: number[] = data.rows.flatMap((r: any) => r.points.map((p: any) => p.value));
  const [lo, hi] = pad(Math.min(...all), Math.max(...all), 0.06);
  const rowH = 30;
  const left = 110;
  const H = data.rows.length * rowH + 26;
  const x = linear([lo, hi], [left, W - 64]);
  return (
    <div class="w-chart" data-testid="chart-stability">
      <svg viewBox={`0 0 ${W} ${H}`} class="w-svg" role="img" aria-label="Stabilität über die Wiederholungen">
        {niceTicks(lo, hi, 4).map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1="0" y2={H - 22} class="w-grid" />
            <text x={x(t)} y={H - 8} class="w-tick" text-anchor="middle">
              {formatMetric(m, t, false)}
            </text>
          </g>
        ))}
        {data.rows.map((r: any, i: number) => {
          const cy = i * rowH + rowH / 2;
          return (
            <g key={r.value} data-testid="stab-row" data-row={r.value}>
              <text x={left - 10} y={cy + 3} class="w-tick strong" text-anchor="end">
                {r.value.length > 16 ? r.value.slice(0, 15) + "…" : r.value}
              </text>
              {r.sd !== null && <rect x={x(r.mean - r.sd)} y={cy - 8} width={Math.max(x(r.mean + r.sd) - x(r.mean - r.sd), 1)} height="16" class="w-sd-band" data-testid="sd-band" />}
              {r.points.map((p: any, j: number) => (
                <circle key={j} cx={x(p.value)} cy={cy} r="3.2" fill="var(--series-1)" opacity="0.85" data-testid="rep-dot">
                  <title>{`${p.label}: ${formatMetric(m, p.value)}`}</title>
                </circle>
              ))}
              <line x1={x(r.mean)} x2={x(r.mean)} y1={cy - 10} y2={cy + 10} class="w-mean-tick" data-testid="mean-tick" />
              <text x={W - 4} y={cy + 3} class="w-tick" text-anchor="end">
                {r.sd === null ? "" : `sd ${formatMetric(m, r.sd, false)}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Registry ------------------------------------------------------------------------------------
export function renderWidget(type: string, result: WidgetResult, ctx: Ctx) {
  const d = result.data;
  if (type === "own-draft" || type.startsWith("own:")) return <OwnChart data={d} />;
  switch (type) {
    case "curves":
      return <CurvesChart data={d} />;
    case "forecast":
      return <ForecastChart data={d} onWindow={(w) => ctx.onSettings({ window: w })} />;
    case "replicates":
      return <ReplicatesGrid data={d} project={ctx.project} />;
    case "config-diff":
      return <ConfigDiff data={d} />;
    case "who-wins":
      return <WhoWins data={d} />;
    case "best-config":
      return <BestConfig data={d} />;
    case "all-combos":
      return <AllCombos data={d} />;
    case "regions-ab":
      return <RegionsAB data={d} />;
    case "scope-errors":
      return <ScopeErrors data={d} />;
    case "param-effect":
      return <ParamEffect data={d} />;
    case "rank-stability":
      return <RankStability data={d} />;
    case "rank-jumps":
      return <RankJumps data={d} />;
    case "project-best":
      return <ProjectBest data={d} ctx={ctx} />;
    case "param-map":
      return <ParamMap data={d} />;
    case "compare-table":
      return <CompareTable data={d} />;
    case "per-region":
      return <RegionChart data={d} />;
    case "axis-effect":
      return <AxisEffect data={d} />;
    case "stability":
      return <StabilityChart data={d} />;
    case "config":
      if (ctx.configData)
        return (
          <div class="w-chart" data-testid="chart-config">
            <ConfigLegend baseKnown={ctx.configData.base_known} />
            <ConfigBlocks data={ctx.configData} embedded={false} />
          </div>
        );
      return (
        <ConfigView
          runId={ctx.run.id}
          projectName={ctx.project.name}
          combo={(d?.combo as Record<string, string> | undefined) ?? ctx.combo}
          embedded={ctx.scope !== "run"}
          showSwitch={false}
          mode={(d?.view as ConfigMode) ?? "blocks"}
        />
      );
    default:
      return <div class="notice">Unbekanntes Widget: {type}</div>;
  }
}
