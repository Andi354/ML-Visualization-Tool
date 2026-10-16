// The draft of an own widget (feature E): what the agent proposed, first on the board until it is kept or
// discarded. Hatched row, the draft tile at its own width, dashed violet border (series 5).
import { useEffect, useState } from "preact/hooks";
import { postWidget, type ProjectInfo, type RunInfo, type WidgetRequest, type WidgetResult } from "../api";
import type { Draft, Width } from "../widgets/board";
import { WidgetFigure } from "../widgets/WidgetTile";

interface Props {
  draft: Draft;
  req: WidgetRequest;
  run: RunInfo;
  project: ProjectInfo;
  onWidth: (w: Width) => void;
  onDiscard: () => void;
  onKeep: () => void;
  /** Reasons the last "Behalten" was refused, if any. */
  keepError: string | null;
}

export function DraftRow({ draft, req, run, project, onWidth, onDiscard, onKeep, keepError }: Props) {
  const [result, setResult] = useState<WidgetResult | null>(null);
  const [showSpec, setShowSpec] = useState(false);
  const key = JSON.stringify([draft.definition, req]);
  useEffect(() => {
    const ctl = new AbortController();
    setResult(null);
    postWidget("own-draft", { ...req, definition: draft.definition, settings: {} } as WidgetRequest, ctl.signal)
      .then(setResult)
      .catch(() => {});
    return () => ctl.abort();
  }, [key]);
  const half = draft.width === "half";
  return (
    <div class="draft" data-testid="draft" data-width={draft.width}>
      <div class="draft-head">
        <span class="draft-badge">Entwurf · vom Agenten</span>
        <span class="draft-title" data-testid="draft-title">
          {draft.definition.title || draft.definition.name}
        </span>
        <span class="grow" />
        <span class="setting">
          Breite
          <span class="seg" role="group" aria-label="Breite">
            {(["half", "full"] as const).map((w) => (
              <button key={w} class={draft.width === w ? "on" : ""} aria-pressed={draft.width === w} data-testid={`draft-width-${w}`} onClick={() => onWidth(w)}>
                {w === "half" ? "Halb" : "Ganz"}
              </button>
            ))}
          </span>
        </span>
        <button class={"btn" + (showSpec ? " on" : "")} aria-pressed={showSpec} data-testid="draft-spec" onClick={() => setShowSpec(!showSpec)}>
          Beschreibung
        </button>
        <button class="btn" data-testid="draft-discard" onClick={onDiscard}>
          Verwerfen
        </button>
        <button class="btn-keep" data-testid="draft-keep" onClick={onKeep}>
          Behalten
        </button>
      </div>
      {keepError && (
        <div class="w-unavailable" role="alert" data-testid="draft-keep-error">
          {keepError}
        </div>
      )}
      <div class="draft-row">
        <div class={"draft-box " + draft.width} data-testid="draft-box">
          {showSpec ? (
            <pre class="draft-json mono" data-testid="draft-json">
              {JSON.stringify(draft.definition, null, 2)}
            </pre>
          ) : (
            <>
              {!result && <div class="loading-row" />}
              {result?.unavailable && (
                <div class="w-unavailable" data-testid="widget-unavailable">
                  {result.unavailable}
                </div>
              )}
              {result && !result.unavailable && (
                <WidgetFigure type="own-draft" result={result} ctx={{ project, run, combo: req.combo ?? {}, settings: {}, onSettings: () => {}, scope: req.scope }} />
              )}
            </>
          )}
        </div>
        {half && (
          <>
            <div class="draft-hint left">
              halbe Breite,
              <br />
              wie später im Board
            </div>
            <div class="draft-hint right">
              Platz für das
              <br />
              Nachbar-Widget
            </div>
          </>
        )}
      </div>
    </div>
  );
}
