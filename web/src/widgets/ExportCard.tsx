import type { ConfigInfo, ProjectInfo, RunInfo, WidgetResult } from "../api";
import { WidgetFigure } from "./WidgetTile";

export type Theme = "light" | "dark";

export interface Part {
  id: string;
  type: string;
  result: WidgetResult;
  configData?: ConfigInfo;
  title: string;
  hints: boolean;
  /** Members of a combined image have no title of their own: the image has one. */
  hideTitle?: boolean;
}

export interface CardProps {
  parts: Part[];
  /** Title of a combined image (several parts); a single part brings its own title. */
  title?: string;
  layout?: "stack" | "side";
  theme: Theme;
  footer: string | null;
  run: RunInfo;
  project: ProjectInfo;
  combo: Record<string, string>;
  scope: string;
  width?: number;
}

export const EXPORT_WIDTH = 1200;

/** Footer of an image: run folder, epoch, commit. */
export function footerFor(runs: RunInfo[]): string {
  return runs.map((r) => [r.id, r.epoch ? `Epoche ${r.epoch}` : null, r.commit].filter(Boolean).join(" · ")).join("   |   ");
}

/** The exported image of one or more widgets, rendered exactly as it is saved. */
export function ExportCard({ parts, title, layout = "stack", theme, footer, run, project, combo, scope, width = EXPORT_WIDTH }: CardProps) {
  return (
    <div class={`export-card theme-${theme}`} style={{ width: `${width}px` }} data-testid="export-card" data-theme={theme}>
      {parts.length > 1 && title && <h2 class="ex-title">{title}</h2>}
      <div class={`ex-parts ${layout}`}>
        {parts.map((p) => (
          <div class="ex-part" key={p.id} data-testid="export-part">
            <WidgetFigure
              type={p.type}
              result={p.result}
              title={p.title}
              hideTitle={p.hideTitle}
              hints={p.hints}
              exporting
              ctx={{ project, run, combo, settings: {}, onSettings: () => {}, configData: p.configData, scope }}
            />
          </div>
        ))}
      </div>
      {footer && (
        <div class="ex-foot tiny mono" data-testid="export-footer">
          {footer}
        </div>
      )}
    </div>
  );
}
