import { useEffect, useState } from "preact/hooks";
import { getCatalog, NotFound, postWidget, type CatalogEntry, type ProjectInfo, type RunInfo, type SettingDef, type WidgetResult } from "../api";
import type { BoardWidget } from "./board";
import { renderWidget } from "./renderers";

export function useCatalog(): CatalogEntry[] {
  const [cat, setCat] = useState<CatalogEntry[]>([]);
  useEffect(() => {
    getCatalog().then(setCat).catch(() => {});
  }, []);
  return cat;
}

interface Props {
  widget: BoardWidget;
  def: CatalogEntry | undefined;
  run: RunInfo;
  project: ProjectInfo;
  combo: Record<string, string>;
  onSettings: (patch: Record<string, string | null>) => void;
  onRemove: () => void;
  onSave?: (result: WidgetResult) => void;
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

/** One tile of a board: header (name, question, Einstellen, ×, save), settings, and the figure. */
export function WidgetTile({ widget, def, run, project, combo, onSettings, onRemove, onSave }: Props) {
  const [result, setResult] = useState<WidgetResult | null>(null);
  const [error, setError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const key = JSON.stringify([widget.type, run.id, combo, widget.settings]);
  useEffect(() => {
    const ctl = new AbortController();
    setError(false);
    postWidget(widget.type, { run: run.id, combo, settings: widget.settings }, ctl.signal)
      .then(setResult)
      .catch((e) => {
        if (e?.name === "AbortError") return;
        if (!(e instanceof NotFound)) setError(true);
      });
    return () => ctl.abort();
  }, [key]);

  const visible = (def?.settings ?? []).filter((s) => s.key !== "window"); // the window is set by clicking the strip
  const canSave = !!onSave && !!result && !result.unavailable && result.exportable;
  return (
    <section class="w-tile" data-testid="widget-tile" data-widget={widget.type}>
      <header class="w-head">
        <div class="w-name">
          <span class="w-label">{def?.label ?? widget.type}</span>
          <span class="muted small w-question">{def?.question}</span>
        </div>
        {visible.length > 0 && (
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
        </div>
      )}
      <div class="w-body">
        {error && <div class="notice">Das Widget konnte nicht geladen werden.</div>}
        {!result && !error && <div class="loading-row" />}
        {result?.unavailable && (
          <div class="w-unavailable" data-testid="widget-unavailable">
            {result.unavailable}
          </div>
        )}
        {result && !result.unavailable && (
          <figure class="w-figure">
            {result.title && <figcaption class="w-title" data-testid="widget-title">{result.title}</figcaption>}
            {result.subtitle && <div class="w-sub small muted">{result.subtitle}</div>}
            {renderWidget(widget.type, result, { project, run, combo, settings: widget.settings, onSettings })}
            {result.note && <div class="w-note small muted">{result.note}</div>}
          </figure>
        )}
      </div>
    </section>
  );
}
