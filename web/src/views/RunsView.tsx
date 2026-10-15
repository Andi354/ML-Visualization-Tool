import { useEffect, useState } from "preact/hooks";
import { getRuns, type RunInfo } from "../api";

interface Props {
  onOpen: (run: string) => void;
}

/** Placeholder of the Läufe area; feature C replaces it. */
export function RunsView({ onOpen }: Props) {
  const [runs, setRuns] = useState<RunInfo[] | null>(null);
  useEffect(() => {
    getRuns().then(setRuns).catch(() => setRuns([]));
  }, []);
  if (!runs)
    return (
      <div class="placeholder">
        <div class="loading-row" />
      </div>
    );
  return (
    <div class="placeholder" data-testid="runs-view">
      {runs.map((r) => (
        <div key={r.id}>
          <button class="mono" data-testid="open-run" onClick={() => onOpen(r.id)}>
            {r.id}
          </button>
        </div>
      ))}
    </div>
  );
}
