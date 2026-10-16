import { useEffect, useState } from "preact/hooks";
import { getCatalog, NotFound, postWidget, type CatalogEntry, type ProjectInfo, type RunInfo, type SettingDef, type WidgetRequest, type WidgetResult } from "../api";
import { isOwn, type BoardWidget, type Width } from "./board";
import { renderWidget, type Ctx } from "./renderers";

export function useCatalog(scope = ""): CatalogEntry[] {
  const [cat, setCat] = useState<CatalogEntry[]>([]);
  useEffect(() => {
    getCatalog(scope).then(setCat).catch(() => {});
  }, [scope]);
  return cat;
}

interface Props {
  widget: BoardWidget;
  def: CatalogEntry | undefined;
  /** The run of the board (or run A); some widgets need it for their own requests. */
  run: RunInfo;
  project: ProjectInfo;
  /** What the board is about: scope, run(s), combination as filter, scope parameters. */
  req: WidgetRequest;
  onSettings: (patch: Record<string, string | null>) => void;
  onRemove: () => void;
  /** One position earlier (-1) or later (+1) in the board; `first` and `last` disable the arrows. */
  onMove?: (dir: -1 | 1) => void;
  first?: boolean;
  last?: boolean;
  onWidth?: (width: Width) => void;
  onSave?: (result: WidgetResult) => void;
  /** Click on a run in a project widget (toggles it for the map) and the current selection. */
  selection?: { runs: string[] | null; toggle: (id: string, current: string[]) => void };
}

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 4v5h7V4M8 20v-6h8v6" />
  </svg>
);

function Setting({ def, value, options, onChange }: { def: SettingDef; value: string | null; options: unknown; onChange: (v: string) => void }) {
  if (def.type === "seg") {
    return (
      <div class="setting">
        <span class="small muted">{def.label}</span>
        <div class="seg" role="group" aria-label={def.label}>
          {def.options!.map((o) => (
            <button key={o.value} class={(value ?? def.default) === o.value ? "on" : ""} aria-pressed={(value ?? def.default) === o.value} data-testid={`set-${def.key}-${o.value}`} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const raw = (options as unknown[] | undefined) ?? [];
  const opts = raw.map((o) => (typeof o === "string" ? { value: o, label: o } : (o as { value: string; label: string })));
  if (!opts.length) return null;
  return (
    <label class="setting">
      <span class="small muted">{def.label}</span>
      <select class="select" data-testid={`set-${def.key}`} value={value ?? def.default ?? opts[0].value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** "Breite Halb | Ganz" in the settings of a tile and in the header of a draft. */
export function WidthControl({ value, onChange }: { value: Width; onChange: (w: Width) => void }) {
  return (
    <div class="setting">
      <span class="small muted">Breite</span>
      <div class="seg" role="group" aria-label="Breite">
        {(["half", "full"] as const).map((w) => (
          <button key={w} class={value === w ? "on" : ""} aria-pressed={value === w} data-testid={`set-width-${w}`} onClick={() => onChange(w)}>
            {w === "half" ? "Halb" : "Ganz"}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface FigureProps {
  type: string;
  result: WidgetResult;
  ctx: Ctx;
  /** Key statement; the data's own title when not overridden. */
  title?: string;
  hideTitle?: boolean;
  /** Show the grey texts: subtitle and note line. */
  hints?: boolean;
  /** Footer text (run folder, epoch, commit), or null for none. */
  footer?: string | null;
}

/** Title, subtitle, graphic, note and footer of a widget: the tile body and the exported image. */
export function WidgetFigure({ type, result, ctx, title, hideTitle = false, hints = true, footer = null }: FigureProps) {
  return (
    <figure class="w-figure" data-testid="widget-figure">
      {!hideTitle && (
        <figcaption class="w-title" data-testid="widget-title">
          {title ?? result.title}
        </figcaption>
      )}
      {hints && result.subtitle && <div class="w-sub small muted">{result.subtitle}</div>}
      {renderWidget(type, result, ctx)}
      {hints && result.note && <div class="w-note small muted">{result.note}</div>}
      {footer && <div class="w-foot tiny mono muted" data-testid="widget-footer">{footer}</div>}
    </figure>
  );
}

/** One tile of a board: header (name, question, Einstellen, ×, save), settings, and the figure. */
export function WidgetTile({ widget, def, run, project, req, onSettings, onRemove, onSave, selection, onMove, first, last, onWidth }: Props) {
  const [result, setResult] = useState<WidgetResult | null>(null);
  const [error, setError] = useState(false);
  const [gone, setGone] = useState(false); // an own widget that was deleted: the tile says so
  const [showSettings, setShowSettings] = useState(false);
  const key = JSON.stringify([widget.type, req, widget.settings]);
  useEffect(() => {
    const ctl = new AbortController();
    setError(false);
    setGone(false);
    postWidget(widget.type, { ...req, settings: widget.settings }, ctl.signal)
      .then(setResult)
      .catch((e) => {
        if (e?.name === "AbortError") return;
        if (e instanceof NotFound) setGone(isOwn(widget.type));
        else setError(true);
      });
    return () => ctl.abort();
  }, [key]);

  const visible = (def?.settings ?? []).filter((s) => s.key !== "window"); // the window is set by clicking the strip
  const canSave = !!onSave && !!result && !result.unavailable && result.exportable;
  return (
    <section class={"w-tile" + (widget.width === "full" ? " full" : "")} data-testid="widget-tile" data-id={widget.id} data-widget={widget.type} data-width={widget.width}>
      <header class="w-head">
        <div class="w-name">
          <span class="w-label">
            {def?.label ?? (isOwn(widget.type) ? "Eigenes Widget" : widget.type)}
            {isOwn(widget.type) && <span class="own-tag">eigen</span>}
          </span>
          <span class="muted small w-question">{def?.question}</span>
        </div>
        {onMove && (
          <>
            <button class="move-btn" title="Nach vorn schieben" aria-label="Nach vorn" data-testid="tile-up" disabled={first} onClick={() => onMove(-1)}>
              ↑
            </button>
            <button class="move-btn" title="Nach hinten schieben" aria-label="Nach hinten" data-testid="tile-down" disabled={last} onClick={() => onMove(1)}>
              ↓
            </button>
          </>
        )}
        {(visible.length > 0 || onWidth) && (
          <button class={"btn" + (showSettings ? " on" : "")} aria-expanded={showSettings} data-testid="tile-settings" onClick={() => setShowSettings(!showSettings)}>
            Einstellen
          </button>
        )}
        <button class="icon-small" aria-label="Widget entfernen" title="Widget entfernen" data-testid="tile-remove" onClick={onRemove}>
          ×
        </button>
        {onSave && (
          <button class="save-btn" aria-label="Als Deliverable speichern" title="Als Deliverable speichern" data-testid="tile-save" disabled={!canSave} onClick={() => result && onSave(result)}>
            <SaveIcon />
          </button>
        )}
      </header>
      {showSettings && (
        <div class="w-settings" data-testid="tile-settings-row">
          {visible.map((s) => (
            <Setting key={s.key} def={s} value={widget.settings[s.key] ?? null} options={result?.options?.[s.key]} onChange={(v) => onSettings({ [s.key]: v })} />
          ))}
          {onWidth && <WidthControl value={widget.width} onChange={onWidth} />}
        </div>
      )}
      <div class="w-body">
        {error && <div class="notice">Das Widget konnte nicht geladen werden.</div>}
        {gone && (
          <div class="w-unavailable" data-testid="widget-gone">
            Widget gelöscht
          </div>
        )}
        {!result && !error && !gone && <div class="loading-row" />}
        {result?.unavailable && (
          <div class="w-unavailable" data-testid="widget-unavailable">
            {result.unavailable}
          </div>
        )}
        {result && !result.unavailable && (
          <WidgetFigure type={widget.type} result={result} ctx={{ project, run, combo: req.combo ?? {}, settings: widget.settings, onSettings, scope: req.scope, selection }} />
        )}
      </div>
    </section>
  );
}
