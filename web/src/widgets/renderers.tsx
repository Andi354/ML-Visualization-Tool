import type { ProjectInfo, RunInfo, WidgetResult } from "../api";
import { ConfigView, type ConfigMode } from "../config/ConfigView";
import { formatMetric } from "../experiment/model";
import { formatNumber } from "../format";
import { bandPath, centredStart, linePath, linear, niceTicks, pad, shortDate, spread } from "./charts";

export interface Ctx {
  project: ProjectInfo;
  run: RunInfo;
  combo: Record<string, string>;
  settings: Record<string, string | null>;
  onSettings: (patch: Record<string, string | null>) => void;
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
              <th class="mono">{r}</th>
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

// --- Registry ------------------------------------------------------------------------------------
export function renderWidget(type: string, result: WidgetResult, ctx: Ctx) {
  const d = result.data;
  switch (type) {
    case "curves":
      return <CurvesChart data={d} />;
    case "forecast":
      return <ForecastChart data={d} onWindow={(w) => ctx.onSettings({ window: w })} />;
    case "replicates":
      return <ReplicatesGrid data={d} project={ctx.project} />;
    case "config":
      return (
        <ConfigView
          runId={ctx.run.id}
          projectName={ctx.project.name}
          combo={ctx.combo}
          embedded
          showSwitch={false}
          mode={(d?.view as ConfigMode) ?? "blocks"}
        />
      );
    default:
      return <div class="notice">Unbekanntes Widget: {type}</div>;
  }
}
