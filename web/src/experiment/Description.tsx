import type { Description } from "../api";
import { Markdown } from "../agent/Markdown";
import { foldLabel, gridColumns, problemText, sections } from "./description";

interface Props {
  description: Description;
  open: boolean;
  onToggle: () => void;
  onOpenRun: (run: string) => void;
  /** Notes hanging on the sections of the description (v0.3.0): count per section, and the actions. */
  noteCounts?: Record<string, number>;
  onAddNote?: (section: string) => void;
  onShowNotes?: (section: string) => void;
  /** The section whose first note was just shown (amber background). */
  highlight?: string | null;
}

/** Timestamp prefix of a run folder dropped: the chip shows the name of the run. */
const chipName = (name: string) => name.replace(/^\d{4}-\d{2}-\d{2}_\d{4,6}_/, "");

/** The description of a run (feature H): the folded line, the fields side by side, "Vergleichen mit" chips. */
export function DescriptionBlock({ description: d, open, onToggle, onOpenRun, noteCounts = {}, onAddNote, onShowNotes, highlight }: Props) {
  const secs = sections(d);
  const problem = problemText(d);
  return (
    <div class="desc-block" data-testid="description">
      <button class="desc-line" data-testid="description-toggle" aria-expanded={open} onClick={onToggle}>
        <span class="desc-label">Beschreibung</span>
        <span class="desc-short" data-testid="description-short">
          {d.short}
        </span>
        <span class="desc-fold">{foldLabel(open)}</span>
      </button>
      {open && (
        <>
          {problem && (
            <div class="desc-warn" data-testid="description-problems">
              <b>Beschreibung unvollständig:</b>
              <span>{d.problems.join(" · ")}</span>
            </div>
          )}
          {secs.length > 0 && (
            <div class="desc-grid" style={{ gridTemplateColumns: gridColumns(secs) }} data-testid="description-fields">
              {secs.map((s) => (
                <div key={s.key} data-field={s.key} class={highlight === s.key ? "desc-hl" : ""}>
                  <div class="desc-field-label">
                    {s.label}
                    {noteCounts[s.key] > 0 && (
                      <button class="desc-note-count note-mark" data-testid="section-notes" onClick={() => onShowNotes?.(s.key)}>
                        ✎ {noteCounts[s.key]}
                      </button>
                    )}
                    {onAddNote && (
                      <button class="desc-note-add plus" data-testid="section-add-note" onClick={() => onAddNote(s.key)}>
                        + Notiz
                      </button>
                    )}
                  </div>
                  <Markdown text={s.kind === "text" ? s.paragraphs.join("\n\n") : s.items.map((t) => `- ${t}`).join("\n")} />
                </div>
              ))}
            </div>
          )}
          {d.compare_to.length > 0 && (
            <div class="desc-compare">
              <span class="desc-field-label">Vergleichen mit</span>
              {d.compare_to.map((c) =>
                c.run ? (
                  <button
                    key={c.name}
                    class="desc-chip mono"
                    data-testid="description-chip"
                    data-run={c.run}
                    title={c.run + " · als Tab öffnen"}
                    onClick={() => onOpenRun(c.run!)}
                  >
                    {chipName(c.name)}
                  </button>
                ) : (
                  <span key={c.name} class="desc-chip mono unknown" data-testid="description-chip" title={c.name + " · nicht gefunden"}>
                    {chipName(c.name)}
                  </span>
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The own line above the overview graphs; a click folds or unfolds them (same state as the toolbar button). */
export function OverviewLine({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button class="ov-line" data-testid="overview-line" aria-expanded={open} onClick={onToggle}>
      <span class="desc-label">Überblick</span>
      <span class="ov-hint">{open ? "" : "Verteilung je Achse, Klick auf einen Wert filtert"}</span>
      <span class="desc-fold">{foldLabel(open)}</span>
    </button>
  );
}
