import type { ComponentChildren } from "preact";
import { useEffect, useReducer, useState } from "preact/hooks";
import type { CatalogEntry, ProjectInfo, RunInfo, WidgetRequest } from "../api";
import { boardReducer, loadBoard, makeBoard, newId, saveBoard } from "../widgets/board";
import { WidgetTile } from "../widgets/WidgetTile";
import { SaveDialog } from "./SaveDialog";

interface Props {
  project: ProjectInfo;
  scope: string;
  catalog: CatalogEntry[];
  /** What the board is about; widgets and the save dialog build their requests from it. */
  req: WidgetRequest;
  run: RunInfo;
  footerRuns: RunInfo[];
  footerText?: string;
  defaultTitle: string;
  defaultIssue: string | null;
  /** Scope controls (runs, filter, colouring) shown in the header. */
  controls: ComponentChildren;
  selection?: { runs: string[] | null; toggle: (id: string, current: string[]) => void };
}

/** A board of widgets for one scope: header with scope controls, Widgets menu, tiles, "+ Widget" and
 *  the save dialog. The selection of widgets is remembered per project and scope. */
export function BoardPage({ project, scope, catalog, req, run, footerRuns, footerText, defaultTitle, defaultIssue, controls, selection }: Props) {
  const known = catalog.map((c) => c.key);
  const defaults = catalog.filter((c) => !c.optional).map((c) => c.key); // optional widgets start off
  const [board, dispatch] = useReducer(boardReducer, null, () => loadBoard(project.name, scope, known, makeBoard(scope, defaults)));
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

  return (
    <div class="analysis" data-testid="board-page" data-scope={scope}>
      <div class="view-head">
        {controls}
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
                  {c.optional && <span class="muted tiny">optional</span>}
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
              req={req}
              selection={selection}
              onSettings={(patch) => dispatch({ type: "settings", id: w.id, patch })}
              onRemove={() => dispatch({ type: "remove", id: w.id })}
              onSave={() => setDialog({ initial: [w.id] })}
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
          req={req}
          run={run}
          footerRuns={footerRuns}
          footerText={footerText}
          defaultTitle={defaultTitle}
          defaultIssue={defaultIssue}
          widgets={board.widgets}
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
