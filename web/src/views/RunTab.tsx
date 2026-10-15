import { useEffect, useState } from "preact/hooks";
import { getRun, NotFound, type RunInfo } from "../api";
import { tabLabel } from "../frame/TabStrip";

interface Props {
  runId: string;
  onClose: () => void;
}

type Load = { state: "loading" } | { state: "missing" } | { state: "ok"; run: RunInfo };

/** Content of one run tab. The experiment view (feature D) replaces the placeholder body. */
export function RunTab({ runId, onClose }: Props) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    getRun(runId)
      .then((run) => alive && setLoad({ state: "ok", run }))
      .catch((e) => alive && setLoad(e instanceof NotFound ? { state: "missing" } : { state: "loading" }));
    return () => {
      alive = false;
    };
  }, [runId]);

  if (load.state === "missing")
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
    <div class="placeholder" data-testid="run-body">
      <span class="mono">{tabLabel(load.run.id)}</span>
    </div>
  );
}
