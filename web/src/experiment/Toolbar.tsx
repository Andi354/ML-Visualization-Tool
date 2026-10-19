import { setting, useSettings } from "../settings/store";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Metric } from "../api";
import { columnCount, type Chip, type Columns, type SdMode, visibleMetrics } from "./model";

interface Props {
  overview: boolean;
  onOverview: (v: boolean) => void;
  columns: Columns;
  onColumns: (c: Columns) => void;
  metrics: Metric[];
  primary: string | null;
  chips: Chip[];
  onChip: (c: Chip) => void;
  summary: string;
}

const SD: [SdMode, string][] = [
  ["under", "unter Wert"],
  ["column", "eigene Spalte"],
  ["off", "aus"],
];

export function Toolbar(p: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useSettings();
  const preset = setting<string>("runs.columns");
  const visible = visibleMetrics(p.columns, p.metrics, p.primary, preset);
  const count = columnCount(p.columns, p.metrics, p.primary, preset);
  const toggleMetric = (key: string) => {
    const next = visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key];
    p.onColumns({ ...p.columns, metrics: next });
  };
  const stats: ["n" | "min" | "max" | "status", string][] = [
    ["n", "n"],
    ["min", "min"],
    ["max", "max"],
    ["status", "Status"],
  ];
  return (
    <div class="exp-toolbar" data-testid="exp-toolbar">
      <button
        class={"toggle" + (p.overview ? " on" : "")}
        aria-pressed={p.overview}
        data-testid="toggle-overview"
        onClick={() => p.onOverview(!p.overview)}
      >
        Überblick
      </button>
      <div class="relative" ref={box}>
        <button class="btn-select" aria-expanded={open} data-testid="columns-button" onClick={() => setOpen(!open)}>
          Spalten <span class="count-badge mono">{`${count.visible}/${count.total}`}</span> <span class="muted">▾</span>
        </button>
        {open && (
          <div class="popover" data-testid="columns-menu">
            <div class="pop-group">
              <div class="small muted pop-title">
                Metriken
                {p.columns.metrics !== null && (
                  <button class="link" data-testid="columns-reset" title="Auf die Vorgabe der Einstellungen zurück" onClick={() => p.onColumns({ ...p.columns, metrics: null })}>
                    Vorgabe
                  </button>
                )}
              </div>
              {p.metrics.map((m) => (
                <label key={m.key} class="pop-item mono">
                  <input type="checkbox" data-testid="col-metric" data-metric={m.key} checked={visible.includes(m.key)} onChange={() => toggleMetric(m.key)} />
                  <span class="grow">{m.label}</span>
                  {m.key === p.primary && <span class="primary-tag sans" data-testid="col-primary">★ primär</span>}
                  <span class="muted tiny sans">{m.family}</span>
                </label>
              ))}
            </div>
            <div class="pop-group">
              <div class="small muted">Statistik</div>
              {stats.map(([k, label]) => (
                <label key={k} class="pop-item mono">
                  <input type="checkbox" data-testid="col-stat" data-stat={k} checked={p.columns[k]} onChange={() => p.onColumns({ ...p.columns, [k]: !p.columns[k] })} />
                  <span class="grow">{label}</span>
                </label>
              ))}
            </div>
            <div class="pop-group">
              <div class="small muted">± sd</div>
              <div class="seg wide" role="group" aria-label="Standardabweichung">
                {SD.map(([k, label]) => (
                  <button key={k} class={p.columns.sd === k ? "on" : ""} aria-pressed={p.columns.sd === k} data-testid={`sd-${k}`} onClick={() => p.onColumns({ ...p.columns, sd: k })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {p.chips.map((c) => (
        <button key={c.label} class="chip-btn mono" data-testid="chip" onClick={() => p.onChip(c)} aria-label={`${c.label} entfernen`}>
          {c.label} <span class="muted">×</span>
        </button>
      ))}
      <span class="grow" />
      <span class="muted-2" data-testid="summary">
        {p.summary}
      </span>
    </div>
  );
}
