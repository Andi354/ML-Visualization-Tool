// The agent window and its capsule (feature A), floating above the content.
import type { RefObject } from "preact";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { AgentIcon, MicIcon } from "../frame/icons";
import { getAgent, getChat, newChat, sendMessage, setMode as putMode, type AgentOverview } from "./api";
import { defaultRect, fit, moved, resized, type Bounds, type Rect } from "./geometry";
import {
  cacheState,
  capsuleText,
  chatMeta,
  contextUse,
  modeOf,
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
    return o;
  }, []);

  useEffect(() => {
    if (!opened || overview) return;
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
  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const target = chat ?? (await newChat());
    const updated = await sendMessage(target.id, text);
    setChat(updated);
    onChange({ chat: updated.id });
    refresh().catch(() => {});
  };

  const mode: AgentMode = overview?.mode ?? "mixed";
  const pickMode = (m: AgentMode) => {
    setModesOpen(false);
    setOverview((o) => (o ? { ...o, mode: m } : o));
    putMode(m).catch(() => {});
  };

  const info = chat ?? { tokens: 0, last_turn_at: null, cache_ttl_s: 3600 };
  const use = contextUse(info.tokens);
  const cache = cacheState(info, nowMs());
  const m = modeOf(mode);

  if (agent.mode === "min") {
    return (
      <div class="agent-capsule" data-testid="agent-capsule">
        <AgentIcon size={14} color="var(--accent)" />
        <button class="agent-capsule-text" onClick={() => onChange({ mode: "open" })} data-testid="agent-capsule-open-text">
          {capsuleText(chat, false)}
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
          if (msg.k === "action")
            return (
              <div key={i} class="agent-action" data-testid="agent-action">
                <span class="agent-action-icon">✓</span>
                <span class="agent-action-text">{msg.t}</span>
              </div>
            );
          return (
            <div key={i} class="agent-info" data-testid="agent-info">
              {msg.t}
            </div>
          );
        })}
        <div ref={messagesEnd} />
      </div>

      <div class="agent-composer">
        <div class="agent-input-row">
          <input
            value={draft}
            placeholder="Frag oder sag dem Agenten, was er tun soll …"
            data-testid="agent-input"
            onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.isComposing) {
                e.preventDefault();
                send().catch(() => {});
              } else if (e.key === "Tab" && e.shiftKey) {
                e.preventDefault(); // Shift+Tab cycles the mode instead of moving the focus
                pickMode(nextMode(mode));
              }
            }}
          />
          <button class="agent-mic" disabled title={MIC_TIP} aria-label="Sprechen (später)" data-testid="agent-mic">
            <MicIcon />
          </button>
          <button class="agent-send" title="Senden (Enter)" aria-label="Senden (Enter)" onClick={() => send().catch(() => {})} data-testid="agent-send">
            ↑
          </button>
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
