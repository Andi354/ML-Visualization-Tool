import { useEffect, useState } from "preact/hooks";
import { current, useSettings } from "../settings/store";
import { useAgentState } from "./agentStatus";
import { clock, describe, detailLine, name, percent, statusLine, type RunProgress } from "./model";
import { clearNotes, closeToast, markRead, summarise, useProgress, type Note } from "./store";

interface Props {
  projectName: string;
  onOpenRun: (run: string) => void;
  onAnalyse: (run: string) => void;
}

const AGENT_TEXT = { ready: "Agent bereit", busy: "Agent arbeitet …", off: "Agent nicht verfügbar" } as const;

export function StatusBar({ projectName, onOpenRun, onAnalyse }: Props) {
  const { runs, notes, toasts, started, unread } = useProgress();
  const settings = useSettings();
  const agent = useAgentState();
  const [popover, setPopover] = useState<"runs" | "notes" | null>(null);
  const line = statusLine(runs);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.("[data-popover-area]")) setPopover(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    const open = (e: Event) => onOpenRun((e as CustomEvent<string>).detail);
    window.addEventListener("mlviz:open-run", open);
    return () => window.removeEventListener("mlviz:open-run", open);
  }, [onOpenRun]);

  const act = (n: Note, what: "open" | "analyse" | "errors") => {
    markRead(n.id);
    closeToast(n.id);
    if (what === "analyse") onAnalyse(n.run);
    else onOpenRun(n.run);
    setPopover(null);
  };

  return (
    <>
      <div class="toasts" aria-live="polite">
        {toasts.map(({ id, note }) => (
          <NoteCard key={id} note={note} testid="toast" onAct={act} onClose={() => closeToast(id)} />
        ))}
      </div>
      <footer class="status-bar" data-testid="status-bar">
        <div class="sb-left" data-popover-area>
          <button class="sb-btn" data-testid="sb-runs" aria-expanded={popover === "runs"} onClick={() => setPopover(popover === "runs" ? null : "runs")}>
            {line.active > 0 && <span class="spinner" aria-hidden="true" />}
            <span data-testid="sb-runs-text">{started ? `neu gestartet: ${started}` : line.text}</span>
            {line.stalled > 0 && <span class="sb-warn" data-testid="sb-stalled">⚠ {line.stalled} hängt</span>}
          </button>
          {popover === "runs" && (
            <div class="sb-pop" data-testid="runs-popover">
              <div class="sb-pop-head">Laufende Läufe</div>
              {runs.length === 0 && <div class="sb-empty">Keine Läufe aktiv</div>}
              {runs.map((r) => (
                <RunRow key={r.id} run={r} onOpen={() => { onOpenRun(r.id); setPopover(null); }} />
              ))}
            </div>
          )}
        </div>
        <div class="sb-right">
          <span class={"sb-item agent-" + agent} data-testid="sb-agent">{AGENT_TEXT[agent]}</span>
          <span class="sb-item mono" data-testid="sb-project">{projectName} · v{settings?.version ?? current()?.version ?? ""}</span>
          <div class="sb-bellbox" data-popover-area>
            <button class="sb-btn" data-testid="sb-bell" aria-label={`Hinweise${unread ? `, ${unread} ungelesen` : ""}`} aria-expanded={popover === "notes"} onClick={() => setPopover(popover === "notes" ? null : "notes")}>
              <span aria-hidden="true">🔔</span>
              {unread > 0 && <span class="sb-badge" data-testid="sb-unread">{unread}</span>}
            </button>
            {popover === "notes" && (
              <div class="sb-pop right" data-testid="notes-popover">
                <div class="sb-pop-head">
                  Hinweise
                  <span class="sb-pop-actions">
                    <button class="link" data-testid="notes-read" onClick={() => markRead()}>Alle gelesen</button>
                    <button class="link" data-testid="notes-clear" onClick={() => clearNotes()}>Leeren</button>
                  </span>
                </div>
                {notes.length === 0 && <div class="sb-empty">Keine Hinweise</div>}
                {notes.map((n) => (
                  <NoteCard key={n.id} note={n} testid="note" onAct={act} />
                ))}
              </div>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}

function RunRow({ run, onOpen }: { run: RunProgress; onOpen: () => void }) {
  const p = percent(run);
  return (
    <div class={"sb-run" + (run.state === "stalled" ? " stalled" : "")} data-testid="sb-run">
      <div class="sb-run-top">
        <span class="mono">{name(run)}</span>
        {run.issue && <span class="sb-issue">{run.issue}</span>}
        <span class="sb-pct">{p === null ? "" : `${p} %`}</span>
        <button class="link" data-testid="sb-run-open" onClick={onOpen}>Öffnen</button>
      </div>
      <div class="sb-bar"><span style={{ width: `${p ?? 0}%` }} /></div>
      <div class="sb-run-detail">{detailLine(run)}</div>
    </div>
  );
}

function NoteCard({ note, testid, onAct, onClose }: { note: Note; testid: string; onAct: (n: Note, what: "open" | "analyse" | "errors") => void; onClose?: () => void }) {
  const d = describe(note);
  return (
    <div class={"note-card " + note.kind + (note.read ? "" : " unread")} data-testid={testid} data-kind={note.kind}>
      <div class="note-top">
        {!note.read && <span class="note-dot" aria-label="ungelesen" />}
        <strong>{d.title}</strong>
        <span class="note-time">{clock(note.at)}</span>
        {onClose && <button class="note-x" aria-label="Schließen" data-testid="toast-close" onClick={onClose}>×</button>}
      </div>
      <div class="note-text">{d.text}</div>
      {note.summarising && <div class="note-summary" data-testid="summary-running">Der Agent fasst zusammen …</div>}
      {note.summary && <div class="note-summary" data-testid="summary">{note.summary}</div>}
      {note.summaryError && <div class="note-summary err">{note.summaryError}</div>}
      <div class="note-actions">
        {note.kind === "errors" ? (
          <button class="link" data-testid="act-errors" onClick={() => onAct(note, "errors")}>Fehler zeigen</button>
        ) : (
          <button class="link" data-testid="act-open" onClick={() => onAct(note, "open")}>Öffnen</button>
        )}
        {note.kind === "finished" && (
          <>
            <button class="link" data-testid="act-analyse" onClick={() => onAct(note, "analyse")}>Analysieren</button>
            {!note.summary && <button class="link" data-testid="act-summarise" disabled={note.summarising} onClick={() => void summarise(note.id)}>✦ Zusammenfassen</button>}
          </>
        )}
      </div>
    </div>
  );
}
