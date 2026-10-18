// The state of voice input: idle, preparing, recording, recognising, review (v0.3.0, B).
import { useEffect, useRef, useState } from "preact/hooks";
import { setting } from "../settings/store";
import { isTerm, MAX_SECONDS, pick, textOf, type Recognised, type Segment } from "./model";
import { MicError, record, type Recorder } from "./recorder";

export type VoiceState = "idle" | "preparing" | "recording" | "recognising" | "review";

export interface VoiceStatus {
  engine: "whisper" | "browser";
  ready: boolean;
  loading?: boolean;
  reason?: string;
}

export interface Review {
  segments: Segment[];
  heard: string;
  engine: "whisper" | "browser";
}

async function status(): Promise<VoiceStatus> {
  const r = await fetch("/api/voice/status");
  return r.json();
}

async function recognise(blob: Blob, browserText: string, engine: "whisper" | "browser"): Promise<Recognised> {
  if (engine === "whisper") {
    const r = await fetch("/api/voice", { method: "POST", headers: { "content-type": blob.type || "audio/webm" }, body: blob });
    if (r.ok) return r.json();
    if (r.status !== 503) throw new Error((await r.json().catch(() => null))?.detail ?? `Fehler ${r.status}`);
    // the model is not ready after all: what the browser heard counts
  }
  const r = await fetch("/api/voice/normalise", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: browserText }) });
  return r.json();
}

export function useVoice(opts: { onSend: (text: string, heard: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [review, setReview] = useState<Review | null>(null);
  const [message, setMessage] = useState<string | null>(null); // a toast: "Nichts verstanden", the reason a mic does not work
  const [loadingModel, setLoadingModel] = useState(false);
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<Recorder | null>(null);
  const keep = useRef<Segment[] | null>(null); // "+ weitersprechen": the text so far
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => {
      const r = rec.current;
      if (!r) return;
      setLevel(r.level());
      setSeconds(r.seconds());
      if (r.seconds() >= MAX_SECONDS) void stop();
    }, 100);
    return () => clearInterval(t);
  }, [state]);

  const say = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage((m) => (m === text ? null : m)), 4000);
  };

  async function start() {
    if (state !== "idle" && state !== "review") return;
    setState("preparing");
    setMessage(null);
    try {
      const st = await status();
      if (st.engine === "whisper" && !st.ready) {
        setLoadingModel(true);
        say("Erkennung wird geladen …");
        setState(review ? "review" : "idle");
        const poll = setInterval(async () => {
          const s = await status().catch(() => null);
          if (s?.ready || s?.engine === "browser") {
            clearInterval(poll);
            setLoadingModel(false);
          }
        }, 2000);
        return;
      }
      rec.current = await record({ browserSpeech: st.engine === "browser", lang: setting<string>("agent.voiceLang") });
      (rec.current as Recorder & { engine?: string }).engine = st.engine;
      setSeconds(0);
      setState("recording");
    } catch (e) {
      say(e instanceof MicError ? e.message : "Das Mikrofon lässt sich nicht öffnen.");
      setState(review ? "review" : "idle");
    }
  }

  async function stop() {
    const r = rec.current as (Recorder & { engine?: "whisper" | "browser" }) | null;
    if (!r || state !== "recording") return;
    rec.current = null;
    setState("recognising");
    try {
      const { blob, browserText } = await r.stop();
      const out = await recognise(blob, browserText, r.engine ?? "whisper");
      if (!out.text.trim()) {
        say("Nichts verstanden");
        setState(review ? "review" : "idle");
        return;
      }
      const before = keep.current;
      keep.current = null;
      const segments = before ? [...before, { text: " " }, ...out.segments] : out.segments;
      const heard = (review && before ? review.heard + " " : "") + out.heard;
      if (!setting<boolean>("agent.voiceReview")) {
        setState("idle");
        optsRef.current.onSend(textOf(segments), heard);
        return;
      }
      setReview({ segments, heard, engine: out.engine });
      setState("review");
    } catch (e) {
      say(`Die Erkennung ist fehlgeschlagen (${(e as Error).message}).`);
      setState(review ? "review" : "idle");
    }
  }

  function cancel() {
    if (state === "recording") {
      rec.current?.cancel();
      rec.current = null;
      setState(review ? "review" : "idle");
    } else if (state === "review") {
      discard();
    }
  }

  function discard() {
    setReview(null);
    keep.current = null;
    setState("idle");
  }

  return {
    state, review, message, level, seconds, loadingModel,
    toggle: () => (state === "recording" ? stop() : start()),
    cancel, discard,
    more: () => {
      keep.current = review?.segments ?? null;
      void start();
    },
    choose: (index: number, value: string) => setReview((r) => (r ? { ...r, segments: pick(r.segments, index, value) } : r)),
    send: () => {
      if (!review) return;
      const text = textOf(review.segments);
      const heard = review.heard;
      discard();
      optsRef.current.onSend(text, heard);
    },
    text: () => (review ? textOf(review.segments) : ""),
    terms: review ? review.segments.filter(isTerm).length : 0,
  };
}
export type Voice = ReturnType<typeof useVoice>;
