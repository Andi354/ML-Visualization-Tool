// The agent window and its capsule (feature A), floating above the content.
import type { RefObject } from "preact";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { AgentIcon, MicIcon } from "../frame/icons";
import { carryOut } from "./commands";
import { undoFor } from "./bus";
import { compactChat, decide, getAgent, markAction, getChat, getSetup, newChat, runMessage, setMode as putMode, stopChat, type AgentOverview, type AgentSetup, type Limits, type RunSnapshot } from "./api";
import { defaultRect, fit, moved, resized, type Bounds, type Rect } from "./geometry";
import {
  cacheState,
  capsuleView,
  chatMeta,
  compactState,
  contextUse,
  limitsLine,
  modeOf,
  needsColdHint,
  MODES,
  nextMode,
  type AgentMode,
  type Chat,
} from "./model";
import type { AgentWindowState } from "./state";
import "./agent.css";

const MIC_TIP = "Sprache kommt in einem späteren Update";

interface Props {
  agent: AgentWindowState;
  onChange: (patch: Partial<AgentWindowState>) => void;
  /** What the agent sees ("Lauf · …", "Analyse", "Läufe · Liste"). */
  context: string;
  /** The element the window floats in (the whole tool). */
  appRef: RefObject<HTMLElement>;
}

/** The area the window may use: right of the icon bar, below the tab strip, inside the tool. */
function measure(app: HTMLElement): Bounds {
  const a = app.getBoundingClientRect();
  const bar = app.querySelector(".icon-bar")?.getBoundingClientRect();
  const tabs = app.querySelector(".tab-strip")?.getBoundingClientRect();
  return {
    left: bar ? bar.right - a.left : 0,
    top: tabs ? tabs.bottom - a.top : 0,
    right: a.width,
    bottom: a.height,
  };
}

export function AgentLayer({ agent, onChange, context, appRef }: Props) {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [overview, setOverview] = useState<AgentOverview | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [live, setLive] = useState<Rect | null>(null); // the rect while the user drags
  const [chatsOpen, setChatsOpen] = useState(false);
  const [modesOpen, setModesOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [setup, setSetup] = useState<AgentSetup | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [busyChat, setBusyChat] = useState<string | null>(null);
  /** The message held back because a cold chat would be read in full again (nothing was sent). */
  const [hint, setHint] = useState<{ text: string } | null>(null);
  const fetchedAt = useRef(Date.now());
  const messagesEnd = useRef<HTMLDivElement>(null);
  const opened = agent.mode !== "closed";

  // --- bounds follow the tool --------------------------------------------------------------
  useLayoutEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const update = () => setBounds(measure(app));
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(app);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [appRef]);

  // --- data: loaded when the agent is first needed -------------------------------------------
  const refresh = useCallback(async () => {
    const o = await getAgent();
    fetchedAt.current = Date.now();
    setOverview(o);
    setLimits(o.limits);
    return o;
  }, []);

  useEffect(() => {
    if (!opened || overview) return;
    getSetup().then(setSetup).catch(() => {});
    refresh()
      .then(async (o) => {
        const id = agent.chat && o.chats.some((c) => c.id === agent.chat) ? agent.chat : (o.chats[0]?.id ?? null);
        if (id) setChat(await getChat(id));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const nowMs = () => (overview ? Date.parse(overview.now) + (Date.now() - fetchedAt.current) : Date.now());

  useEffect(() => {
    messagesEnd.current?.scrollIntoView?.({ block: "end" });
  }, [chat?.messages.length, agent.mode]);

  // --- Esc closes the window; the chats are kept -------------------------------------------------
  useEffect(() => {
    if (!opened) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector('[role="dialog"]')) return;
      setChatsOpen(false);
      setModesOpen(false);
      onChange({ mode: "closed" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [opened, onChange]);

  // --- popovers close on a click elsewhere --------------------------------------------------------
  useEffect(() => {
    if (!chatsOpen && !modesOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-popover]")) {
        setChatsOpen(false);
        setModesOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [chatsOpen, modesOpen]);

  if (!bounds || agent.mode === "closed") return null;

  const rect = live ?? fit(agent.rect ?? defaultRect(bounds), bounds);

  // --- dragging and resizing ----------------------------------------------------------------------
  const startDrag = (kind: "move" | "size") => (e: PointerEvent) => {
    if (e.button !== 0 || (e.target as Element).closest?.("button, input")) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const start = rect;
    let last = start;
    const onMove = (ev: PointerEvent) => {
      last = (kind === "move" ? moved : resized)(start, ev.clientX - sx, ev.clientY - sy, bounds);
      setLive(last);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      setLive(null);
      onChange({ rect: last });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  // --- chats ---------------------------------------------------------------------------------------
  const open = async (id: string) => {
    setChatsOpen(false);
    setChat(await getChat(id));
    onChange({ chat: id });
  };
  const addChat = async () => {
    setChatsOpen(false);
    if (chat && chat.messages.length === 0) return; // the current one is already an empty chat
    const c = await newChat();
    setChat(c);
    onChange({ chat: c.id });
    refresh().catch(() => {});
  };
  const ready = setup?.ready ?? true; // until the check is back, the window is not blocked
  const busy = !!chat && busyChat === chat.id;

  const onSnapshot = (snap: RunSnapshot) => {
    if (snap.command) {
      carryOut(snap.command); // the agent asks the open tool to do something
      return;
    }
    if (!snap.chat) return;
    setChat((c) => (c && c.id !== snap.chat.id ? c : snap.chat)); // not if the user has opened another chat meanwhile
    if (snap.limits) setLimits(snap.limits);
  };
  /** Sends `text` to `target` (or the current chat, or a new one) and shows the answer as it comes in. */
  const start = async (text: string, opts: { resend?: boolean; target?: Chat } = {}) => {
    const target = opts.target ?? chat ?? (await newChat());
    setChat(target);
    onChange({ chat: target.id });
    setBusyChat(target.id);
    try {
      await runMessage(target.id, { text, context, resend: opts.resend }, onSnapshot);
    } catch {
      /* the chat on disk shows what arrived */
    }
    setBusyChat(null);
    const next = queued.current;
    queued.current = null;
    if (next) start(next, { target }).catch(() => {});
    getChat(target.id).then((c) => setChat((cur) => (cur && cur.id !== c.id ? cur : c))).catch(() => {});
    refresh().catch(() => {});
  };
  const cards = (chat?.messages ?? []).filter((m) => (m.k === "confirm" || m.k === "choice") && m.cid);
  /** A message typed while a card is open rejects the card; the message is sent as soon as the agent has gone on. */
  const queued = useRef<string | null>(null);
  const send = () => {
    const text = draft.trim();
    if (!text || !ready) return;
    if (busy) {
      if (!cards.length) return;
      queued.current = text;
      setDraft("");
      cards.forEach((c) => decide(c.cid!, { approve: false }).catch(() => {}));
      return;
    }
    if (chat && needsColdHint(chat, nowMs())) {
      setHint({ text }); // check before any call: nothing is sent
      return;
    }
    setDraft("");
    start(text).catch(() => {});
  };
  const sendAnyway = () => {
    if (!hint) return;
    const { text } = hint;
    setHint(null);
    setDraft("");
    start(text).catch(() => {});
  };
  const sendInNewChat = async () => {
    if (!hint) return;
    const { text } = hint;
    setHint(null);
    setDraft("");
    start(text, { target: await newChat() }).catch(() => {});
  };
  const resend = () => {
    const last = [...(chat?.messages ?? [])].reverse().find((m) => m.k === "user");
    if (last) start(last.t, { resend: true }).catch(() => {});
  };
  const compact = async () => {
    if (!chat) return;
    setChatsOpen(false);
    setBusyChat(chat.id);
    await compactChat(chat.id, onSnapshot).catch(() => {});
    setBusyChat(null);
    refresh().catch(() => {});
  };
  const answer = (c: { cid?: string }, body: { approve?: boolean; choice?: string }) => c.cid && decide(c.cid, body).catch(() => {});
  /** Rückgängig / Wiederholen of an action line: the view does it, the line shows the new state. */
  const flip = async (cid: string, to: "done" | "reverted") => {
    const entry = undoFor(cid);
    if (!entry || !chat) return;
    const text = (await (to === "reverted" ? entry.undo() : entry.redo?.())) ?? "";
    const updated = await markAction(chat.id, cid, to, to === "reverted" ? `↶ ${text}` : text).catch(() => null);
    if (updated) setChat(updated);
  };
  const copySession = () => {
    if (chat?.session_id) navigator.clipboard?.writeText(chat.session_id).catch(() => {});
    setChatsOpen(false);
  };

  const mode: AgentMode = overview?.mode ?? "mixed";
  const pickMode = (m: AgentMode) => {
    setModesOpen(false);
    setOverview((o) => (o ? { ...o, mode: m } : o));
    putMode(m).catch(() => {});
  };

  const info = chat ?? { tokens: 0, last_turn_at: null, cache_ttl_s: 3600 };
  const use = contextUse(info.tokens, chat?.context_window || undefined);
  const cache = cacheState(info, nowMs());
  const m = modeOf(mode);

  if (agent.mode === "min") {
    const cap = capsuleView(chat, busy, ready);
    return (
      <div class={"agent-capsule " + cap.state} data-testid="agent-capsule" data-state={cap.state}>
        <AgentIcon size={14} color="var(--accent)" />
        <button class="agent-capsule-text" onClick={() => onChange({ mode: "open" })} data-testid="agent-capsule-open-text">
          {cap.text}
        </button>
        <button class="agent-mic round" disabled title={MIC_TIP} aria-label="Sprechen (später)" data-testid="agent-mic">
          <MicIcon size={14} />
        </button>
        <button class="agent-capsule-open" title="Öffnen" aria-label="Öffnen" onClick={() => onChange({ mode: "open" })} data-testid="agent-capsule-open">
          ⤢
        </button>
      </div>
    );
  }

  return (
    <section
      class="agent-window"
      aria-label="Agent"
      data-testid="agent-window"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <header class="agent-header" data-testid="agent-header" onPointerDown={startDrag("move")}>
        <AgentIcon size={14} color="var(--accent)" />
        <button class="agent-title" title="Chats" onClick={() => {
            if (!chatsOpen) refresh().catch(() => {}); // the list is read again when it opens
            setChatsOpen(!chatsOpen);
          }}
          data-popover
          data-testid="agent-chats-button"
        >
          {chat?.title ?? "Neuer Chat"}
          <span class="agent-caret">▾</span>
        </button>
        <span class="agent-ctx-meter" title={use.tip} data-testid="agent-context-meter">
          <span class="agent-ctx-bar">
            <span class={"agent-ctx-fill " + use.level} style={{ width: `${Math.min(100, use.pct)}%` }} />
          </span>
          {use.pct} %
        </span>
        <span class={"agent-cache " + cache.kind} title={cache.tip} data-testid="agent-cache">
          {cache.label}
        </span>
        <span class="agent-spacer" />
        <button class="agent-hdr-btn" title="Neuer Chat" aria-label="Neuer Chat" onClick={addChat} data-testid="agent-new">
          +
        </button>
        <button class="agent-hdr-btn" title="Minimieren" aria-label="Minimieren" onClick={() => onChange({ mode: "min" })} data-testid="agent-min">
          –
        </button>
        <button class="agent-hdr-btn" title="Schließen (Esc)" aria-label="Schließen" onClick={() => onChange({ mode: "closed" })} data-testid="agent-close">
          ×
        </button>
      </header>

      {chatsOpen && (
        <div class="agent-popover agent-chat-list" data-popover data-testid="agent-chat-list">
          <div class="agent-popover-head">Chats in diesem Projekt</div>
          {(overview?.chats ?? []).map((c) => (
            <button
              key={c.id}
              class={"agent-chat-row" + (c.id === chat?.id ? " current" : "")}
              onClick={() => open(c.id)}
              data-testid="agent-chat-row"
            >
              <span class="agent-chat-title">{c.title}</span>
              <span class="agent-chat-meta">{chatMeta(c, overview!.now, nowMs())}</span>
            </button>
          ))}
          {!overview?.chats.length && <div class="agent-popover-head">Noch keine Chats</div>}
          {chat && (
            <div class="agent-chat-menu" data-testid="agent-chat-menu">
              <button class="agent-menu-item" disabled={!compactState(chat, nowMs()).enabled || busy} title={compactState(chat, nowMs()).tip} onClick={compact} data-testid="agent-compact">
                Diesen Chat komprimieren (/compact)
              </button>
              <button class="agent-menu-item" disabled={!chat.session_id} onClick={copySession} data-testid="agent-copy-session">
                Session-ID kopieren
              </button>
              {limitsLine(limits) && (
                <div class="agent-popover-head" data-testid="agent-limits">
                  {limitsLine(limits)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div class="agent-sees">
        sieht
        <span class="agent-ctx-chip mono" data-testid="agent-context">
          {context}
        </span>
      </div>

      <div class="agent-messages" data-testid="agent-messages">
        {(chat?.messages ?? []).map((msg, i) => {
          if (msg.k === "user")
            return (
              <div key={i} class="agent-msg user" data-testid="agent-msg-user">
                {msg.t}
              </div>
            );
          if (msg.k === "agent")
            return (
              <div key={i} class="agent-msg agent" data-testid="agent-msg-agent">
                {msg.t}
              </div>
            );
          if (msg.k === "confirm")
            return (
              <div key={i} class="agent-card" data-testid="agent-confirm">
                <div class="agent-card-head">
                  <span class="agent-card-label">Bestätigen</span>
                  <span>{msg.t}</span>
                </div>
                {msg.details?.length ? (
                  <div class="agent-card-detail mono" data-testid="agent-confirm-detail">
                    {msg.details.map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                ) : null}
                <div class="agent-hint-buttons">
                  <button class="agent-btn primary" onClick={() => answer(msg, { approve: true })} data-testid="agent-confirm-ok">
                    {msg.save ? "Speichern" : "Ausführen"}
                  </button>
                  <button class="agent-btn quiet" onClick={() => answer(msg, { approve: false })} data-testid="agent-confirm-no">
                    Ablehnen
                  </button>
                  <span class="agent-grow" />
                  {i === (chat?.messages.length ?? 0) - 1 && <span class="agent-card-key">Enter = ausführen</span>}
                </div>
              </div>
            );
          if (msg.k === "choice")
            return (
              <div key={i} class="agent-choice" data-testid="agent-choice">
                <div class="agent-choice-q">{msg.t}</div>
                {(msg.runs ?? []).map((r) => (
                  <button key={r.id} class="agent-run-card" onClick={() => answer(msg, { choice: r.id })} data-testid="agent-run-card" data-run={r.id}>
                    <span class="mono agent-run-name">{r.name}</span>
                    <span class="agent-run-sub">{[r.started?.slice(0, 10), r.state, r.axes.length ? r.axes.join(", ") : null].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            );
          if (msg.k === "action") {
            const reverted = msg.state === "reverted";
            const state = msg.rejected ? "rejected" : reverted ? "reverted" : "done";
            const entry = msg.undo_id ? undoFor(msg.undo_id) : undefined;
            return (
              <div key={i} class={"agent-action " + state} data-testid="agent-action" data-state={state}>
                <span class="agent-action-icon">{state === "rejected" ? "✕" : reverted ? "↶" : "✓"}</span>
                <span class="agent-action-text">{msg.t}</span>
                {state === "done" && msg.auto && <span class="agent-action-how">direkt</span>}
                {entry && state === "done" && (
                  <button class="agent-action-btn" onClick={() => flip(msg.undo_id!, "reverted")} data-testid="agent-undo">
                    Rückgängig
                  </button>
                )}
                {entry?.redo && reverted && (
                  <button class="agent-action-btn" onClick={() => flip(msg.undo_id!, "done")} data-testid="agent-redo">
                    Wiederholen
                  </button>
                )}
              </div>
            );
          }
          return (
            <div key={i} class={"agent-info" + (msg.error ? " error" : "")} data-testid={msg.error ? "agent-error" : "agent-info"}>
              {msg.t}
              {msg.error && i === (chat?.messages.length ?? 0) - 1 && !busy && (
                <button class="agent-resend" onClick={resend} data-testid="agent-resend">
                  Erneut senden
                </button>
              )}
            </div>
          );
        })}
        {busy && (
          <div class="agent-working" data-testid="agent-working">
            arbeitet …
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      <div class="agent-composer">
        {setup && !setup.ready && (
          <div class="agent-notice warn" data-testid="agent-setup-problem">
            <div>
              <b>Agent nicht eingerichtet.</b> {setup.problem}
            </div>
            <div class="agent-notice-step">{setup.step}</div>
            <div class="agent-hint-buttons">
              <button class="agent-btn" onClick={() => getSetup().then(setSetup).catch(() => {})} data-testid="agent-recheck">
                Erneut prüfen
              </button>
            </div>
          </div>
        )}
        {setup?.ready && setup.api_key && (
          <div class="agent-notice warn small" data-testid="agent-api-key">
            Der Agent läuft über API-Key, nicht über das Abo.
          </div>
        )}
        {hint && chat && (
          <div class="agent-notice warn" data-testid="agent-cold-hint">
            <div>
              <b>Cache abgelaufen.</b> Diese Nachricht liest den ganzen Chat neu ein (~{Math.round(chat.tokens / 1000)}k Tokens). Noch nichts gesendet.
            </div>
            <div class="agent-hint-buttons">
              <button class="agent-btn primary" onClick={sendAnyway} data-testid="agent-send-anyway">
                Trotzdem senden
              </button>
              <button class="agent-btn" onClick={() => sendInNewChat()} data-testid="agent-send-new">
                In neuem Chat senden
              </button>
              <button class="agent-btn quiet" onClick={() => setHint(null)} data-testid="agent-hint-cancel">
                Abbrechen
              </button>
            </div>
          </div>
        )}
        <div class="agent-input-row">
          <input
            value={draft}
            disabled={!ready}
            placeholder="Frag oder sag dem Agenten, was er tun soll …"
            data-testid="agent-input"
            onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.isComposing) {
                e.preventDefault();
                const last = chat?.messages[chat.messages.length - 1];
                if (!draft.trim() && last?.k === "confirm") answer(last, { approve: true }); // Enter on an open card executes it
                else send();
              } else if (e.key === "Tab" && e.shiftKey) {
                e.preventDefault(); // Shift+Tab cycles the mode instead of moving the focus
                pickMode(nextMode(mode));
              }
            }}
          />
          <button class="agent-mic" disabled title={MIC_TIP} aria-label="Sprechen (später)" data-testid="agent-mic">
            <MicIcon />
          </button>
          {busy ? (
            <button class="agent-send stop" title="Stopp" aria-label="Stopp" onClick={() => chat && stopChat(chat.id).catch(() => {})} data-testid="agent-stop">
              ■
            </button>
          ) : (
            <button class="agent-send" title="Senden (Enter)" aria-label="Senden (Enter)" disabled={!ready} onClick={send} data-testid="agent-send">
              ↑
            </button>
          )}
        </div>
        <div class="agent-mode-row">
          <button class={"agent-mode-btn " + mode} title="Modus wechseln (Shift+Tab)" onClick={() => setModesOpen(!modesOpen)} data-popover data-testid="agent-mode">
            {m.icon} {m.label} ▾
          </button>
          <span>{m.hint}</span>
          {modesOpen && (
            <div class="agent-popover agent-mode-menu" data-popover data-testid="agent-mode-menu">
              <div class="agent-popover-head">Wie soll der Agent handeln?</div>
              {MODES.map((d) => (
                <button key={d.key} class={"agent-mode-option" + (d.key === mode ? " current" : "")} onClick={() => pickMode(d.key)} data-testid={`agent-mode-${d.key}`}>
                  <span class="agent-mode-name">
                    {d.icon}&nbsp; {d.label}
                  </span>
                  <span class="agent-mode-desc">{d.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div class="agent-grip" title="Größe ändern" data-testid="agent-resize" onPointerDown={startDrag("size")} />
    </section>
  );
}
