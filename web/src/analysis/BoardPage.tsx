import { setting } from "../settings/store";
import type { ComponentChildren } from "preact";
import { useEffect, useReducer, useRef, useState } from "preact/hooks";
import { deleteOwnWidget, deleteTemplate, getJson, getOwnWidgets, getTemplates, keepOwnWidget, markTemplateUsed, saveTemplate, OwnWidgetRefused, type CatalogEntry, type ProjectInfo, type RunInfo, type WidgetRequest } from "../api";
import { glow as glowElement, settled } from "../agent/commands";
import { provide, provideView, type Outcome } from "../agent/bus";
import { boardReducer, loadBoard, makeBoard, newId, saveBoard, type Board, type OwnDefinition, type Width } from "../widgets/board";
import { BUILTIN, isDirty, lastUsed, loadCurrent, saveCurrent, standardWidgets, templateScope, toTemplateWidgets, widgetsFromTemplate, type StoredTemplate } from "../widgets/templates";
import { storageKey } from "../state/storage";
import { WidgetTile } from "../widgets/WidgetTile";
import { problemSummary, reportFor, whenLoaded } from "../widgets/status";
import { DraftRow } from "./DraftRow";
import { saveWidgets } from "./agentSave";
import { SaveDialog } from "./SaveDialog";
import { TemplateBar } from "./TemplateBar";

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
  const addWidth = (w: Width): Width => { const s = setting<string>("ana.width"); return s === "half" || s === "full" ? s : w; };
  const defaults = catalog.filter((c) => !c.optional).map((c) => c.key); // optional widgets start off
  const widths = Object.fromEntries(catalog.map((c) => [c.key, c.width])) as Record<string, Width>;
  // a scope without a stored board starts with the template used last (else Standard), see the templates effect
  const startsFresh = useRef(
    (() => {
      try {
        return localStorage.getItem(storageKey(project.name, `board:${scope}`)) === null;
      } catch {
        return true;
      }
    })(),
  );
  const [board, dispatch] = useReducer(boardReducer, null, () => loadBoard(project.name, scope, known, makeBoard(scope, defaults, widths), widths));
  useEffect(() => saveBoard(project.name, board), [project.name, board]);
  // effects run after paint: flush on leaving so a quick reload cannot lose the last change (as in the frame)
  const latestBoard = useRef(board);
  latestBoard.current = board;
  useEffect(() => {
    const flush = () => saveBoard(project.name, latestBoard.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [project.name]);

  const [menu, setMenu] = useState<"widgets" | "add" | null>(null);
  const [dialog, setDialog] = useState<{ initial: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // own widgets: descriptions kept in the project, offered under "Eigene"
  const [own, setOwn] = useState<CatalogEntry[]>([]);
  const refreshOwn = () => getOwnWidgets(scope).then(setOwn).catch(() => {});
  useEffect(() => {
    refreshOwn();
  }, [scope]);
  const everything = [...catalog, ...own]; // what a tile or the save dialog can look up
  const [keepError, setKeepError] = useState<string | null>(null);
  useEffect(() => setKeepError(null), [board.draft]);
  /** Keeps the draft as an own widget; the error text if it does not work. */
  const keepDraft = async (): Promise<{ error: string } | { key: string }> => {
    if (!board.draft) return { error: "Es gibt keinen offenen Entwurf" };
    try {
      const entry = await keepOwnWidget(board.draft.definition);
      dispatch({ type: "keep-draft", key: entry.key, id: newId(entry.key) });
      refreshOwn();
      return { key: entry.key };
    } catch (e) {
      return { error: e instanceof OwnWidgetRefused ? `Nicht behalten: ${e.errors.join("; ")}` : "Das Widget konnte nicht gespeichert werden." };
    }
  };
  const keep = async () => {
    const r = await keepDraft();
    if ("error" in r) setKeepError(r.error);
  };
  const removeOwn = async (key: string) => {
    await deleteOwnWidget(key).catch(() => {});
    refreshOwn();
  };

  // templates: boards without runs, kept in the project
  const tScope = templateScope(scope);
  const standard = standardWidgets(catalog);
  const [templates, setTemplates] = useState<StoredTemplate[] | null>(null);
  const [current, setCurrent] = useState<string>(() => loadCurrent(project.name, scope) ?? BUILTIN);
  const [glow, setGlow] = useState(false);
  const refreshTemplates = () => getTemplates(tScope).then(setTemplates).catch(() => setTemplates([]));
  useEffect(() => {
    refreshTemplates();
  }, [tScope]);
  useEffect(() => saveCurrent(project.name, scope, current), [project.name, scope, current]);
  useEffect(() => {
    if (!glow) return;
    const t = setTimeout(() => setGlow(false), 1600);
    return () => clearTimeout(t);
  }, [glow]);
  const runIds: string[] = req.scope === "run" ? [req.run!] : (req.runs ?? []);
  const noteUsed = (name: string) => name !== BUILTIN && markTemplateUsed(tScope, name, runIds).then(refreshTemplates).catch(() => {});
  const templateWidgets = (name: string) => (name === BUILTIN ? standard : templates?.find((t) => t.name === name)?.widgets);
  const apply = (name: string) => {
    const widgets = templateWidgets(name);
    if (!widgets) return;
    dispatch({ type: "reset", board: { ...board, widgets: widgetsFromTemplate(widgets, known.concat(own.map((o) => o.key))) } });
    setCurrent(name);
    setGlow(true);
    noteUsed(name);
  };
  useEffect(() => {
    if (!startsFresh.current || templates === null) return;
    startsFresh.current = false;
    const wanted = setting<string>("ana.template");
    const t = wanted === "last" ? lastUsed(templates) : (templates.find((x) => x.name === wanted) ?? lastUsed(templates));
    if (t) {
      dispatch({ type: "reset", board: { ...board, widgets: widgetsFromTemplate(t.widgets, known.concat(own.map((o) => o.key))) } });
      setCurrent(t.name);
    }
  }, [templates]);
  const currentWidgets = templateWidgets(current) ?? standard;
  const dirty = isDirty(board, currentWidgets);
  const saveAs = async (name: string): Promise<string | null> => {
    try {
      const t = await saveTemplate(tScope, name, toTemplateWidgets(board.widgets));
      setCurrent(t.name);
      await noteUsed(t.name);
      await refreshTemplates();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Nicht gespeichert";
    }
  };
  const removeTemplate = async (name: string) => {
    await deleteTemplate(tScope, name).catch(() => {});
    if (current === name) setCurrent(BUILTIN);
    refreshTemplates();
  };
  const labelOf = (type: string) => everything.find((c) => c.key === type)?.label ?? "Widget gelöscht";
  const runLabel = (id: string) => footerRuns.find((r) => r.id === id)?.name ?? id;

  // --- the tools of the agent on this board (feature C) -----------------------------------------------------
  const mirror = useRef({ board, current, templates, everything, own, req, run, footerRuns, footerText, project, dirty: false });
  mirror.current = { board, current, templates, everything, own, req, run, footerRuns, footerText, project, dirty };
  const ops = useRef({ apply, saveAs, keepDraft, refreshTemplates, refreshOwn, setCurrent });
  ops.current = { apply, saveAs, keepDraft, refreshTemplates, refreshOwn, setCurrent };
  useEffect(() => {
    const m = () => mirror.current;
    const labelFor = (type: string) => m().everything.find((c) => c.key === type)?.label ?? type;
    /** A widget of the board by id, or by type when only one of that type is there. */
    const find = (ref: unknown) => {
      const r = String(ref);
      const byId = m().board.widgets.find((w) => w.id === r);
      if (byId) return byId;
      const byType = m().board.widgets.filter((w) => w.type === r);
      if (byType.length === 1) return byType[0];
      const have = m().board.widgets.map((w) => `${w.id} (${labelFor(w.type)})`).join(", ");
      throw new Error(byType.length > 1 ? `Mehrere Widgets vom Typ „${r}“, nimm die ID: ${have}` : `Kein Widget „${r}“ im Board (vorhanden: ${have || "keine"})`);
    };
    /** Changes the board and returns an outcome that goes back to the board before and forward to the one after. */
    const edit = async (summary: string, undoText: string, run: () => void | Promise<void>, glowId?: () => string | undefined, extra?: { undo?: () => Promise<void> | void; redo?: () => Promise<void> | void }): Promise<Outcome> => {
      const before: Board = m().board;
      const nameBefore = m().current;
      await run();
      await settled();
      const after: Board = m().board;
      const nameAfter = m().current;
      const id = glowId?.();
      if (id) glowElement(`[data-id="${id}"]`);
      // wait for the widgets to be drawn and tell the agent how they came out (and the user in the action line)
      await whenLoaded(() => m().board.widgets.map((w) => w.id));
      const widgets = reportFor(m().board.widgets, labelFor);
      const problems = problemSummary(widgets);
      return {
        summary: problems ? `${summary} · ${problems}` : summary,
        data: { widgets },
        undo: async () => {
          dispatch({ type: "reset", board: before });
          ops.current.setCurrent(nameBefore);
          await extra?.undo?.();
          return undoText;
        },
        redo: async () => {
          dispatch({ type: "reset", board: after });
          ops.current.setCurrent(nameAfter);
          await extra?.redo?.();
          return summary;
        },
      };
    };
    /** How a widget came out: `state` (loading, ok, error, unavailable, gone) and, if there is one, the `reason`. */
    const stateOf = (id: string, type: string) => {
      const { state, reason } = reportFor([{ id, type }])[0];
      return reason ? { state, reason } : { state };
    };
    const offs = [
      provide("add_widget", async (a) => {
        const def = m().everything.find((c) => c.key === a.type);
        if (!def) throw new Error(`Unbekanntes Widget „${a.type}“ (vorhanden: ${m().everything.map((c) => c.key).join(", ")})`);
        const id = newId(def.key);
        const width: Width = a.width === "full" || a.width === "half" ? a.width : def.width;
        return edit(`Widget hinzugefügt · ${def.label}`, `Widget entfernt · ${def.label}`, () => {
          dispatch({ type: "add", widget: def.key, id, width });
          if (a.settings && typeof a.settings === "object") dispatch({ type: "settings", id, patch: a.settings });
        }, () => id);
      }),
      provide("remove_widget", (a) => {
        const w = find(a.widget);
        return edit(`Widget entfernt · ${labelFor(w.type)}`, `Widget wieder da · ${labelFor(w.type)}`, () => dispatch({ type: "remove", id: w.id }));
      }),
      provide("configure_widget", (a) => {
        const w = find(a.widget);
        const keys = (m().everything.find((c) => c.key === w.type)?.settings ?? []).map((x) => x.key);
        const patch = (a.settings ?? {}) as Record<string, string | null>;
        const unknown = Object.keys(patch).filter((k) => !keys.includes(k));
        if (unknown.length) throw new Error(`„${labelFor(w.type)}“ kennt ${unknown.join(", ")} nicht (Einstellungen: ${keys.join(", ") || "keine"})`);
        const text = Object.entries(patch).map(([k, v]) => `${k} = ${v}`).join(", ");
        return edit(`Widget eingestellt · ${labelFor(w.type)} · ${text}`, `Einstellung zurückgesetzt · ${labelFor(w.type)}`, () => dispatch({ type: "settings", id: w.id, patch }), () => w.id);
      }),
      provide("move_widget", (a) => {
        const w = find(a.widget);
        const dir = a.direction === "up" ? -1 : 1;
        const steps = Math.max(1, Math.min(20, Number(a.steps) || 1));
        return edit(`Widget verschoben · ${labelFor(w.type)} ${dir < 0 ? "↑" : "↓"}`, `Widget zurückgeschoben · ${labelFor(w.type)}`, () => {
          for (let i = 0; i < steps; i++) dispatch({ type: "move", id: w.id, dir });
        }, () => w.id);
      }),
      provide("resize_widget", (a) => {
        const w = find(a.widget);
        const width: Width = a.width === "full" ? "full" : "half";
        return edit(`Widget-Breite · ${labelFor(w.type)} → ${width === "full" ? "volle" : "halbe"} Breite`, `Breite zurückgesetzt · ${labelFor(w.type)}`, () => dispatch({ type: "width", id: w.id, width }), () => w.id);
      }),
      provide("apply_template", (a) => {
        const name = String(a.name);
        const known = name.toLowerCase() === BUILTIN.toLowerCase() ? BUILTIN : m().templates?.find((t) => t.name.toLowerCase() === name.toLowerCase())?.name;
        if (!known) throw new Error(`Keine Vorlage „${name}“ (vorhanden: ${[BUILTIN, ...(m().templates ?? []).map((t) => t.name)].join(", ")})`);
        return edit(`Vorlage angewendet · ${known}`, "Board zurückgesetzt", () => ops.current.apply(known));
      }),
      provide("draft_widget", async (a) => {
        const def = a.definition as OwnDefinition;
        const check = await fetch("/api/own-widgets/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ definition: def }) }).then((r) => r.json()).catch(() => ({ errors: ["Prüfung nicht möglich"] }));
        if (check.errors?.length) throw new Error(`Die Beschreibung ist nicht gültig: ${check.errors.join("; ")}`);
        return edit(`Widget-Entwurf · ${def.name}`, "Entwurf verworfen", () => dispatch({ type: "set-draft", definition: def }));
      }),
      provide("keep_draft", async () => {
        const draft = m().board.draft;
        if (!draft) throw new Error("Es gibt keinen offenen Entwurf");
        let key = "";
        const out = await edit(`Eigenes Widget behalten · ${draft.definition.name}`, `Entwurf wieder offen · ${draft.definition.name}`, async () => {
          const r = await ops.current.keepDraft();
          if ("error" in r) throw new Error(r.error);
          key = r.key;
        }, undefined, {
          undo: async () => {
            await deleteOwnWidget(key).catch(() => {});
            ops.current.refreshOwn();
          },
        });
        return out;
      }),
      provide("save_template", async (a) => {
        const name = String(a.name || "").trim();
        const existing = m().templates?.find((t) => t.name.toLowerCase() === name.toLowerCase());
        const nameBefore = m().current;
        const err = await ops.current.saveAs(name);
        if (err) throw new Error(err);
        await settled();
        return {
          summary: `Vorlage gespeichert · ${m().current}`,
          undo: async () => {
            const saved = m().current;
            if (existing) await saveTemplate(templateScope(m().req.scope ?? "run"), existing.name, existing.widgets);
            else await deleteTemplate(templateScope(m().req.scope ?? "run"), saved);
            ops.current.setCurrent(nameBefore);
            ops.current.refreshTemplates();
            return `Vorlage zurückgenommen · ${saved}`;
          },
        };
      }),
      provide("save_deliverable", async (a) => {
        const title = String(a.title || "").trim();
        if (!title) throw new Error("Der Titel fehlt");
        const wanted = Array.isArray(a.widgets) && a.widgets.length ? a.widgets.map((x: unknown) => find(x)) : m().board.widgets;
        if (!wanted.length) throw new Error("Das Board hat keine Widgets zum Speichern");
        const out = await saveWidgets({ project: m().project, req: m().req, run: m().run, footerRuns: m().footerRuns, footerText: m().footerText, widgets: wanted, catalog: m().everything, title });
        setToast(`${out.files.length} ${out.files.length === 1 ? "Bild" : "Bilder"} gespeichert: ${out.path}`);
        return {
          summary: `Gespeichert · ${out.files.length} ${out.files.length === 1 ? "Bild" : "Bilder"} → ${out.path}/`,
          data: { path: out.path, files: out.files, skipped: out.skipped },
          undo: async () => {
            const r = await fetch("/api/deliverables/undo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: out.path, hashes: out.hashes }) }).then((x) => x.json());
            return r.kept?.length ? "Datei wurde inzwischen geändert, nicht gelöscht" : `Gespeichertes gelöscht · ${out.path}/`;
          },
        };
      }),
    ];
    const offView = provideView("board", () => ({
      scope: m().req.scope,
      runs: m().req.scope === "run" ? [m().req.run] : m().req.runs,
      template: m().current,
      template_changed: m().dirty,
      widgets: m().board.widgets.map((w) => ({ id: w.id, type: w.type, label: labelFor(w.type), width: w.width, settings: w.settings, ...stateOf(w.id, w.type) })),
      draft: m().board.draft ? m().board.draft!.definition.name : null,
      templates: ["Standard", ...(m().templates ?? []).map((t) => t.name)],
    }));
    return () => {
      offs.forEach((o) => o());
      offView();
    };
  }, [scope]);

  const present = known.filter((k) => board.widgets.some((w) => w.type === k));
  const toggleType = (key: string) => {
    if (present.includes(key)) board.widgets.filter((w) => w.type === key).forEach((w) => dispatch({ type: "remove", id: w.id }));
    else dispatch({ type: "add", widget: key, id: newId(key), width: addWidth(widths[key]) });
  };

  return (
    <div class="analysis" data-testid="board-page" data-scope={scope}>
      <div class="view-head">
        {controls}
        <TemplateBar
          scope={tScope}
          current={current}
          dirty={dirty}
          templates={templates ?? []}
          standard={standard}
          label={labelOf}
          runLabel={runLabel}
          appliedTo={runIds.map(runLabel).join(" ↔ ") || "–"}
          widgetCount={board.widgets.length}
          onApply={apply}
          onUpdate={() => saveAs(current)}
          onSave={saveAs}
          onDelete={removeTemplate}
        />
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
        {board.draft && (
          <DraftRow
            draft={board.draft}
            req={req}
            run={run}
            project={project}
            keepError={keepError}
            onWidth={(width) => dispatch({ type: "draft-width", width })}
            onDiscard={() => dispatch({ type: "discard-draft" })}
            onKeep={keep}
          />
        )}
        <div class={`board-grid${glow ? " glow" : ""}`} data-testid="board" data-glow={glow ? "true" : "false"}>
          {board.widgets.map((w, i) => (
            <WidgetTile
              key={w.id}
              widget={w}
              first={i === 0}
              last={i === board.widgets.length - 1}
              onMove={(dir) => dispatch({ type: "move", id: w.id, dir })}
              onWidth={(width) => dispatch({ type: "width", id: w.id, width })}
              def={everything.find((c) => c.key === w.type)}
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
              <div class="pop-head muted tiny">Katalog</div>
              {catalog.map((c) => (
                <button
                  key={c.key}
                  class="pop-choice"
                  data-testid="add-widget-item"
                  data-widget={c.key}
                  onClick={() => {
                    dispatch({ type: "add", widget: c.key, id: newId(c.key), width: addWidth(c.width) });
                    setMenu(null);
                  }}
                >
                  <span class="w-label">{c.label}</span>
                  <span class="muted small">{c.question}</span>
                </button>
              ))}
              <div class="pop-section" data-testid="add-widget-own-head">
                Eigene
              </div>
              {own.length === 0 && (
                <div class="pop-empty" data-testid="add-widget-own-empty">
                  Noch keine. Beschreib dem Agenten ein Widget, und behalte es.
                </div>
              )}
              {own.map((c) => (
                <div class="pop-row" key={c.key}>
                  <button
                    class="pop-choice"
                    data-testid="add-widget-own-item"
                    data-widget={c.key}
                    onClick={() => {
                      dispatch({ type: "add", widget: c.key, id: newId(c.key), width: addWidth(c.width) });
                      setMenu(null);
                    }}
                  >
                    <span class="w-label">
                      {c.label}
                      <span class="own-tag">eigen</span>
                    </span>
                    <span class="muted small">{c.question}</span>
                  </button>
                  <button class="pop-delete" title="Eigenes Widget löschen" aria-label={`${c.label} löschen`} data-testid="own-delete" onClick={() => removeOwn(c.key)}>
                    ×
                  </button>
                </div>
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
          catalog={everything}
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
