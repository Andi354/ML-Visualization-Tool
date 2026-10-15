/** Placeholder of the Analyse area; features E and G replace it. */
export function AnalysisView({ compare }: { compare: string[] }) {
  return (
    <div class="placeholder" data-testid="analysis-view">
      Analyse
      {compare.length > 0 && <div class="mono small" data-testid="compare-runs">{compare.join(" ↔ ")}</div>}
    </div>
  );
}
