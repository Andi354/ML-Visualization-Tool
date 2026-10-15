import { useEffect, useMemo, useReducer, useState } from "preact/hooks";
import { getRuns, type CatalogEntry, type ProjectInfo, type RunRow, type WidgetResult } from "../api";
import { SaveDialog } from "../analysis/SaveDialog";
import { time } from "../runs/model";
import { boardReducer, loadBoard, makeBoard, newId, saveBoard, type Board } from "../widgets/board";
import { useCatalog, WidgetTile } from "../widgets/WidgetTile";

interface Props {
  project: ProjectInfo;
  compare: string[];
  request: { run: string; combo: Record<string, string> } | null;
}

/** Analysis area (features E and G): boards of widgets for one run, two runs or the project. */
export function AnalysisView({ project, request }: Props) {
  const entries = useCatalog("run");
  const [runs, setRuns] = useState<RunRow[]>([]);
  useEffect(() => {
    getRuns().then(setRuns).catch(() => {});
  }, []);
  if (!entries.length || !runs.length)
    return (
      <div class="placeholder" data-testid="analysis-view">
        <div class="loading-row" />
      </div>
    );
  return <RunAnalysis project={project} runs={runs} catalog={entries} request={request} />;
}

function RunAnalysis({ project, runs, catalog, request }: { project: ProjectInfo; runs: RunRow[]; catalog: CatalogEntry[]; request: Props["request"] }) {
  const newest = useMemo(() => [...runs].sort((a, b) => time(b.started) - time(a.started))[0], [runs]);
  const [runId, setRunId] = useState(request?.run ?? newest.id);
  const [combo, setCombo] = useState<Record<string, string>>(request?.combo ?? {});
  useEffect(() => {
    if (request) {
      setRunId(request.run);
      setCombo(request.combo);
    }
  }, [request]);
  const run = runs.find((r) => r.id === runId) ?? newest;

  const known = catalog.map((c) => c.key);
  const [board, dispatch] = useReducer(boardReducer, null, () =>
    loadBoard(project.name, "run", known, makeBoard("run", known)),
  );
  useEffect(() => saveBoard(project.name, board), [project.name, board]);

  const [menu, setMenu] = useState<"widgets" | "add" | null>(null);
  const [dialog, setDialog] = useState<{ initial: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const present = known.filter((k) => board.widgets.some((w) => w.type === k));
  const toggleType = (key: string) => {
    if (present.includes(key)) board.widgets.filter((w) => w.type === key).forEach((w) => dispatch({ type: "remove", id: w.id }));
    else dispatch({ type: "add", widget: key, id: newId(key) });
  };
  const chips = Object.entries(combo);

  return (
    <div class="analysis" data-testid="analysis-view">
      <div class="view-head">
        <span class="crumb">
          <span class="muted">Analyse /</span> Ein Lauf
        </span>
        <label class="setting">
          <span class="small muted">Lauf</span>
          <select class="select run-select" data-testid="run-select" value={run.id} onChange={(e) => (setRunId((e.target as HTMLSelectElement).value), setCombo({}))}>
            {[...runs]
              .sort((a, b) => time(b.started) - time(a.started))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id}
                </option>
              ))}
          </select>
        </label>
        {chips.map(([k, v]) => (
          <button key={k} class="chip-btn mono" data-testid="filter-chip" aria-label={`Filter ${k} entfernen`} onClick={() => setCombo(Object.fromEntries(chips.filter(([x]) => x !== k)))}>
            {k} = {v} <span class="muted">×</span>
          </button>
        ))}
        <span class="grow" />
        <div class="relative">
          <button class="btn" aria-expanded={menu === "widgets"} data-testid="widgets-menu" onClick={() => setMenu(menu === "widgets" ? null : "widgets")}>
            Widgets · {present.length} von {known.length}
          </button>
          {menu === "widgets" && (
            <div class="popover right" data-testid="widgets-menu-list">
              {catalog.map((c) => (
                <label key={c.key} class="pop-item">
                  <input type="checkbox" data-testid="widget-toggle" data-widget={c.key} checked={present.includes(c.key)} onChange={() => toggleType(c.key)} />
                  <span class="grow">{c.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button class="btn-primary active" data-testid="save-deliverable" onClick={() => setDialog({ initial: [] })}>
          Als Deliverable speichern
        </button>
      </div>
      <div class="analysis-scroll">
        <div class="board-grid" data-testid="board">
          {board.widgets.map((w) => (
            <WidgetTile
              key={w.id}
              widget={w}
              def={catalog.find((c) => c.key === w.type)}
              run={run}
              project={project}
              combo={combo}
              scope="run"
              onSettings={(patch) => dispatch({ type: "settings", id: w.id, patch })}
              onRemove={() => dispatch({ type: "remove", id: w.id })}
              onSave={(_r: WidgetResult) => setDialog({ initial: [w.id] })}
            />
          ))}
        </div>
        <div class="relative add-widget-row">
          <button class="btn" data-testid="add-widget" aria-expanded={menu === "add"} onClick={() => setMenu(menu === "add" ? null : "add")}>
            + Widget
          </button>
          {menu === "add" && (
            <div class="popover left" data-testid="add-widget-menu">
              {catalog.map((c) => (
                <button
                  key={c.key}
                  class="pop-choice"
                  data-testid="add-widget-item"
                  data-widget={c.key}
                  onClick={() => {
                    dispatch({ type: "add", widget: c.key, id: newId(c.key) });
                    setMenu(null);
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
      {dialog && (
        <SaveDialog
          project={project}
          run={run}
          scope="run"
          combo={combo}
          widgets={(board as Board).widgets}
          catalog={catalog}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onSaved={({ path, count }) => {
            setDialog(null);
            setToast(`${count} ${count === 1 ? "Bild" : "Bilder"} gespeichert: ${path}`);
          }}
        />
      )}
      {toast && (
        <div class="toast" role="status" data-testid="toast">
          {toast}
        </div>
      )}
    </div>
  );
}
