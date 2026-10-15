import { useEffect, useReducer, useState } from "preact/hooks";
import type { ProjectInfo, RunInfo, TableRow } from "../api";
import { formatInt } from "../format";
import { boardReducer, loadBoard, makeBoard, newId, saveBoard } from "../widgets/board";
import { useCatalog, WidgetTile } from "../widgets/WidgetTile";
import { formatMetric, formatSd } from "./model";

interface Props {
  run: RunInfo;
  project: ProjectInfo;
  row: TableRow;
  onClose: () => void;
  onAnalyse: (combo: Record<string, string>) => void;
}

const DEFAULT = ["curves", "forecast", "replicates", "config"]; // config last

/** Detail of one combination (feature F): head with its facts, and a mini board of widgets. */
export function DetailPanel({ run, project, row, onClose, onAnalyse }: Props) {
  const catalog = useCatalog();
  const known = catalog.map((c) => c.key);
  const [board, dispatch] = useReducer(boardReducer, null, () => loadBoard(project.name, "combination", DEFAULT, makeBoard("combination", DEFAULT)));
  useEffect(() => saveBoard(project.name, board), [project.name, board]);
  const [menu, setMenu] = useState(false);
  const own = catalog.filter((c) => c.scopes.includes("combination"));
  const combo = row.params;
  const entries = Object.entries(combo);
  return (
    <aside class="detail-panel" data-testid="detail-panel">
      <header class="dp-head">
        <div class="dp-title">
          <span class="dp-name">Kombination</span>
          <span class="muted small" data-testid="dp-cells">
            {formatInt(row.n + row.errors)} {row.n + row.errors === 1 ? "Zelle" : "Zellen"}
            {row.errors > 0 && <span class="error-text"> · {formatInt(row.errors)} Fehler</span>}
          </span>
          <span class="grow" />
          <button class="btn-primary active" data-testid="open-analysis" onClick={() => onAnalyse(combo)}>
            Als Analyse öffnen
          </button>
          <button class="icon-small" aria-label="Panel schließen" data-testid="dp-close" onClick={onClose}>
            ×
          </button>
        </div>
        {entries.length > 0 && (
          <div class="dp-chips" data-testid="dp-chips">
            {entries.map(([k, v]) => (
              <span key={k} class="chip mono">
                {k} = {v}
              </span>
            ))}
          </div>
        )}
        <div class="dp-metrics" data-testid="dp-metrics">
          {project.metrics
            .filter((m) => row.metrics[m.key])
            .map((m) => (
              <div class="dp-metric" key={m.key}>
                <span class="muted tiny">{m.label}</span>
                <span class="mono">{formatMetric(m, row.metrics[m.key].mean)}</span>
                <span class="muted tiny mono">{formatSd(m, row.metrics[m.key].std)}</span>
              </div>
            ))}
        </div>
      </header>
      <div class="dp-board" data-testid="dp-board">
        {board.widgets.map((w) => (
          <WidgetTile
            key={w.id}
            widget={w}
            def={catalog.find((c) => c.key === w.type)}
            run={run}
            project={project}
            combo={combo}
            onSettings={(patch) => dispatch({ type: "settings", id: w.id, patch })}
            onRemove={() => dispatch({ type: "remove", id: w.id })}
          />
        ))}
        <div class="relative dp-add">
          <button class="btn" data-testid="add-widget" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            + Widget
          </button>
          {menu && (
            <div class="popover left" data-testid="add-widget-menu">
              {own.map((c) => (
                <button
                  key={c.key}
                  class="pop-choice"
                  data-testid="add-widget-item"
                  data-widget={c.key}
                  onClick={() => {
                    dispatch({ type: "add", widget: c.key, id: newId(c.key) });
                    setMenu(false);
                  }}
                >
                  <span class="w-label">{c.label}</span>
                  <span class="muted small">{c.question}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
