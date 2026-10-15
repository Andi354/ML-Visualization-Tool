/** Placeholder of the Analyse area; features E and G replace it. */
export function AnalysisView({
  compare,
  request,
}: {
  compare: string[];
  request: { run: string; combo: Record<string, string> } | null;
}) {
  return (
    <div class="placeholder" data-testid="analysis-view">
      Analyse
      {compare.length > 0 && (
        <div class="mono small" data-testid="compare-runs">
          {compare.join(" ↔ ")}
        </div>
      )}
      {request && (
        <div class="mono small" data-testid="analysis-request">
          {request.run} {JSON.stringify(request.combo)}
        </div>
      )}
    </div>
  );
}
