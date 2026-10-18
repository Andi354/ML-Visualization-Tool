// Recording in the browser: MediaRecorder for the clip, an analyser for the level meter, and (where the server cannot
// recognise) the browser's own speech recognition running at the same time.
export interface Recorder {
  /** 0..1 */
  level(): number;
  seconds(): number;
  stop(): Promise<{ blob: Blob; browserText: string }>;
  cancel(): void;
}

interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
type Speech = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<SpeechResult> }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

export class MicError extends Error {}

export function micProblem(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "Kein Zugriff auf das Mikrofon. Erlaube ihn in den Einstellungen des Browsers.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Kein Mikrofon gefunden.";
  return "Das Mikrofon lässt sich nicht öffnen.";
}

export async function record(opts: { browserSpeech: boolean; lang: string }): Promise<Recorder> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new MicError("Dieser Browser kann nicht aufnehmen.");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    throw new MicError(micProblem(e));
  }
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.frequencyBinCount);
  const started = Date.now();

  let speech: Speech | null = null;
  let browserText = "";
  if (opts.browserSpeech) {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Speech }).webkitSpeechRecognition;
    if (Ctor) {
      speech = new Ctor();
      speech.lang = opts.lang === "en" ? "en-US" : "de-DE";
      speech.continuous = true;
      speech.interimResults = false;
      speech.onresult = (e) => {
        browserText = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      };
      speech.start();
    }
  }
  rec.start();

  const release = () => {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => undefined);
  };
  return {
    level() {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      return Math.min(1, peak / 64);
    },
    seconds: () => (Date.now() - started) / 1000,
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          speech?.stop();
          release();
          // the browser recognition delivers its last result a moment after stop
          setTimeout(() => resolve({ blob: new Blob(chunks, { type: mime || "audio/webm" }), browserText }), speech ? 400 : 0);
        };
        rec.stop();
      }),
    cancel() {
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      speech?.stop();
      release();
    },
  };
}
