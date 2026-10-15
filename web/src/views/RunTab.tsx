import { useEffect, useState } from "preact/hooks";
import { getRun, NotFound, type ProjectInfo, type RunInfo } from "../api";
import { ExperimentView } from "../experiment/ExperimentView";

interface Props {
  runId: string;
  project: ProjectInfo;
  onBack: () => void;
  onClose: () => void;
  onAnalyse: (combo: Record<string, string>) => void;
}

type Load = { state: "loading" } | { state: "missing" } | { state: "ok"; run: RunInfo };

/** Content of one run tab: the experiment view of the run, or a note when the run is gone. */
export function RunTab({ runId, project, onBack, onClose, onAnalyse }: Props) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let alive = true;
    getRun(runId)
      .then((run) => alive && setLoad({ state: "ok", run }))
      .catch((e) => alive && setLoad(e instanceof NotFound ? { state: "missing" } : { state: "loading" }));
    return () => {
      alive = false;
    };
  }, [runId]);

  if (load.state === "missing" || gone)
    return (
      <div class="notice" data-testid="run-missing">
        <span>Lauf nicht mehr vorhanden</span>
        <button class="btn" onClick={onClose}>
          Tab schließen
        </button>
      </div>
    );
  if (load.state === "loading")
    return (
      <div class="placeholder">
        <div class="loading-row" />
        <div class="loading-row" />
      </div>
    );
  return (
    <div class="pane-fill" data-testid="run-body">
      <ExperimentView run={load.run} project={project} onBack={onBack} onMissing={() => setGone(true)} onAnalyse={onAnalyse} />
    </div>
  );
}
