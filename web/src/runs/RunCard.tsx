import type { ProjectInfo, RunRow } from "../api";
import { Best, CellBar, Flags } from "./components";
import { relTime, shortName } from "./model";

/** Chips of the axes: the first three, then "+n" (v0.3.2, P). */
export function axisChips(axes: string[]): string[] {
  return axes.length > 3 ? [...axes.slice(0, 3), `+${axes.length - 3}`] : axes;
}

export interface CardProps {
  /** The newest run of the experiment. */
  run: RunRow;
  /** Its older runs, newest first. */
  older: RunRow[];
  project: ProjectInfo;
  current: string | null;
  selected: Set<string>;
  focus: string | null;
  olderOpen: boolean;
  onToggleSel: (id: string) => void;
  onToggleOlder: () => void;
  onOpen: (id: string) => void;
}

function OpenLink({ run, label, onOpen }: { run: RunRow; label: string; onOpen: (id: string) => void }) {
  return (
    <a
      class="run-name mono"
      href="#"
      data-testid="open"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen(run.id);
      }}
    >
      {label}
    </a>
  );
}

/** One experiment as a card (v0.3.2, P): its newest run, with the older runs folded below. */
export function RunCard(p: CardProps) {
  const r = p.run;
  const sel = p.selected.has(r.id);
  return (
    <div
      class={"rcard" + (sel ? " selected" : "") + (p.focus === r.id ? " focused" : "") + (r.running ? " is-running" : "")}
      data-testid="run-row"
      data-run={r.id}
      onClick={() => p.onOpen(r.id)}
    >
      <div class="rcard-head">
        <div class="rcard-title">
          <OpenLink run={r} label={shortName(r)} onOpen={p.onOpen} />
          <span class="when">
            {r.running ? "läuft · " : ""}
            {relTime(p.project.now, r.started)}
            <Flags run={r} current={p.current} />
            {r.migrated && <span class="flag">migriert</span>}
          </span>
        </div>
        <input
          type="checkbox"
          class="round-check"
          aria-label="zum Vergleich auswählen"
          data-testid="sel"
          checked={sel}
          onClick={(e) => e.stopPropagation()}
          onChange={() => p.onToggleSel(r.id)}
        />
      </div>
      {r.short ? (
        <span class="short-line" data-testid="short" title={r.short}>
          {r.short}
        </span>
      ) : (
        <span class="short-line none" data-testid="short-empty">
          Keine Kurzbeschreibung
        </span>
      )}
      <div class="axis-chips">
        {axisChips(r.axes).map((a) => (
          <span class="chip mono" key={a}>
            {a}
          </span>
        ))}
      </div>
      <div class="rcard-foot">
        <CellBar run={r} />
        <Best run={r} />
      </div>
      {p.older.length > 0 && (
        <>
          <button
            class="older-toggle"
            data-testid="older-toggle"
            aria-expanded={p.olderOpen}
            onClick={(e) => {
              e.stopPropagation();
              p.onToggleOlder();
            }}
          >
            {`+ ${p.older.length} · ${p.older.length === 1 ? "älterer Lauf" : "ältere Läufe"}`}
          </button>
          {p.olderOpen &&
            p.older.map((o) => (
              <div class={"older-row" + (p.focus === o.id ? " focused" : "")} key={o.id} data-testid="older-row" data-run={o.id} onClick={(e) => { e.stopPropagation(); p.onOpen(o.id); }}>
                <div class="older-line">
                  <OpenLink run={o} label={"↳ " + o.id.slice(0, 15)} onOpen={p.onOpen} />
                  <span class="when">
                    {relTime(p.project.now, o.started)}
                    <Flags run={o} current={p.current} />
                  </span>
                </div>
                {o.short && (
                  <span class="short-line" data-testid="short" title={o.short}>
                    {o.short}
                  </span>
                )}
                <div class="rcard-foot">
                  <CellBar run={o} />
                  <Best run={o} />
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
