import type { Metric, TableResult, TableRow } from "../api";
import { formatInt } from "../format";
import { formatMetric, formatSd, nextSort, type Columns, type Sort } from "./model";

interface Props {
  result: TableResult;
  metrics: Metric[];
  visible: string[];
  columns: Columns;
  sort: Sort;
  onSort: (s: Sort) => void;
  stale: boolean;
  selectedKey: string | null;
  onRow: (row: TableRow) => void;
}

export function Table({ result, metrics, visible, columns, sort, onSort, stale, selectedKey, onRow }: Props) {
  const def = (k: string) => metrics.find((m) => m.key === k);
  const sortMetric = result.sort.metric;
  const sortDef = sortMetric ? def(sortMetric) : undefined;
  const sdColumn = columns.sd === "column";
  const statCols = [columns.n && "n", columns.min && "min", columns.max && "max", columns.status && "status"].filter(Boolean) as string[];
  const metricSpan = visible.length * (sdColumn ? 2 : 1);
  const arrow = (k: string) => (result.sort.metric === k && result.sort.stat === "mean" ? (result.sort.dir === "asc" ? "▲" : "▼") : "");
  return (
    <table class={"exp-table" + (stale ? " stale" : "")} data-testid="exp-table">
      <thead>
        <tr class="group-row">
          {result.params.length > 0 && <th colSpan={result.params.length}>Parameter ({result.params.length})</th>}
          {visible.length > 0 && (
            <th colSpan={metricSpan} class="group-sep">
              Metriken ({visible.length}/{metrics.length})
            </th>
          )}
          {statCols.length > 0 && (
            <th colSpan={statCols.length} class="group-sep">
              Statistik
            </th>
          )}
        </tr>
        <tr class="col-row">
          {result.params.map((p) => (
            <th key={p} class="mono param-head">
              {p}
            </th>
          ))}
          {visible.map((k) => {
            const m = def(k);
            return [
              <th key={k} class="metric-head" aria-sort={arrow(k) ? (result.sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                <button data-testid="metric-head" data-metric={k} title={k} onClick={() => onSort(nextSort(sort, k))}>
                  {m?.label ?? k} <span class="sort-arrow">{arrow(k)}</span>
                </button>
              </th>,
              sdColumn && (
                <th key={k + "-sd"} class="sd-head">
                  ± sd
                </th>
              ),
            ];
          })}
          {statCols.map((s) => (
            <th key={s} class="stat-head">
              {s === "status" ? "Status" : s === "n" ? "n" : `${s} ${sortDef?.label ?? ""}`}
            </th>
          ))}
        </tr>
      </thead>
      <tbody class="mono">
        {result.rows.map((r) => (
          <tr
            key={r.key}
            data-testid="exp-row"
            data-key={r.key}
            class={selectedKey === r.key ? "selected" : ""}
            aria-selected={selectedKey === r.key}
            onClick={() => onRow(r)}
          >
            {result.params.map((p) => (
              <td key={p} class="param-cell">
                {r.params[p]}
              </td>
            ))}
            {visible.map((k) => {
              const s = r.metrics[k];
              const best = result.sort.stat === "mean" && k === sortMetric && result.best.key === r.key && s?.mean !== null && s?.mean !== undefined;
              return [
                <td key={k} class={"metric-cell" + (best ? " best" : "")} data-metric={k}>
                  {best && <span class="best-tag">Bestwert</span>}
                  {formatMetric(def(k), s?.mean)}
                  {columns.sd === "under" && s?.std !== null && s?.std !== undefined && <div class="sd">{formatSd(def(k), s.std)}</div>}
                </td>,
                sdColumn && (
                  <td key={k + "-sd"} class="sd-cell">
                    {formatSd(def(k), s?.std)}
                  </td>
                ),
              ];
            })}
            {statCols.map((s) => (
              <td key={s} class={"stat-cell" + (s === "status" && r.errors ? " error" : "")}>
                {s === "n" && formatInt(r.n)}
                {s === "min" && formatMetric(sortDef, sortMetric ? r.metrics[sortMetric]?.min : null)}
                {s === "max" && formatMetric(sortDef, sortMetric ? r.metrics[sortMetric]?.max : null)}
                {s === "status" && (r.errors ? `${formatInt(r.errors)} Fehler` : "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
