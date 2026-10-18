import { useState } from "preact/hooks";
import { MicIcon } from "../frame/icons";
import { clock, isTerm, options } from "./model";
import type { Voice } from "./useVoice";

/** The microphone button of the window and of the capsule: a stop button while it records. */
export function MicButton({ voice, round, disabled }: { voice: Voice; round?: boolean; disabled?: boolean }) {
  const rec = voice.state === "recording";
  return (
    <button
      class={"agent-mic" + (round ? " round" : "") + (rec ? " rec" : "")}
      disabled={disabled || voice.state === "recognising" || voice.state === "preparing"}
      title={rec ? "Aufnahme beenden (Ctrl+M)" : voice.loadingModel ? "Erkennung wird geladen …" : "Sprechen (Ctrl+M)"}
      aria-label={rec ? "Aufnahme beenden" : "Sprechen"}
      aria-pressed={rec}
      data-testid="agent-mic"
      onClick={() => void voice.toggle()}
    >
      {rec ? <span class="mic-stop" aria-hidden="true" /> : <MicIcon size={round ? 14 : 15} />}
    </button>
  );
}

/** Replaces the input while recording or recognising: red row with level meter and time. */
export function RecordingRow({ voice }: { voice: Voice }) {
  const bars = 12;
  return (
    <div class={"voice-row " + voice.state} data-testid="voice-row" role="status">
      {voice.state === "recording" ? (
        <>
          <span class="voice-dot" aria-hidden="true" />
          <strong>Hört zu</strong>
          <span class="voice-meter" aria-hidden="true">
            {Array.from({ length: bars }, (_, i) => (
              <i key={i} class={i / bars < voice.level ? "on" : ""} />
            ))}
          </span>
          <span class="mono" data-testid="voice-time">{clock(voice.seconds)}</span>
          <button class="voice-cancel" data-testid="voice-cancel" title="Abbrechen (Esc)" onClick={() => voice.cancel()}>Abbrechen</button>
        </>
      ) : voice.state === "preparing" ? (
        <span data-testid="voice-preparing">Mikrofon wird geöffnet …</span>
      ) : (
        <span data-testid="voice-recognising">Erkenne … mit Projektbegriffen</span>
      )}
    </div>
  );
}

/** The review box above the input: marked terms, alternatives, send / edit / discard / keep talking. */
export function ReviewBox({ voice, onEdit }: { voice: Voice; onEdit: (text: string) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const r = voice.review;
  if (!r) return null;
  return (
    <div class="voice-review" data-testid="voice-review">
      <div class="voice-review-head">
        <MicIcon size={11} />
        <span>
          Gesprochen · <span data-testid="voice-terms">{voice.terms} {voice.terms === 1 ? "Projektbegriff" : "Projektbegriffe"} erkannt</span>
          {voice.terms > 0 && ", zum Ändern anklicken"}
          {r.engine === "browser" && <span> · Erkennung im Browser</span>}
        </span>
      </div>
      <div class="voice-text" data-testid="voice-text">
        {r.segments.map((s, i) =>
          isTerm(s) ? (
            <span class="voice-chip-wrap" key={i}>
              <button class={"voice-chip" + (s.changed ? " changed" : "")} data-testid="voice-chip" data-kind={s.kind} title={s.kind} onClick={() => setOpen(open === i ? null : i)}>
                {s.term}
              </button>
              {open === i && (
                <span class="voice-pop" data-testid="voice-alts">
                  {options(s).map((o) => (
                    <button key={o.value} class={o.value === s.term ? "cur" : ""} data-testid="voice-alt" onClick={() => { voice.choose(i, o.value); setOpen(null); }}>
                      <span class="mono">{o.value}</span>
                      {o.label && <span class="muted"> {o.label}</span>}
                    </button>
                  ))}
                </span>
              )}
            </span>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </div>
      <div class="voice-review-actions">
        <button class="voice-primary" data-testid="voice-send" onClick={voice.send}>Senden <kbd class="vkbd">Enter</kbd></button>
        <button data-testid="voice-edit" onClick={() => { const t = voice.text(); voice.discard(); onEdit(t); }}>Als Text bearbeiten</button>
        <button class="voice-discard" data-testid="voice-discard" onClick={voice.discard}>Verwerfen</button>
        <button class="voice-more" data-testid="voice-more" onClick={voice.more}>+ weitersprechen</button>
      </div>
    </div>
  );
}
