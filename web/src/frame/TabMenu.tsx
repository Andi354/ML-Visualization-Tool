import { useEffect, useRef } from "preact/hooks";
import { SETTINGS_TAB, tabOrder, type FrameAction, type FrameState } from "../state/frame";

interface Props {
  /** The tab the menu belongs to: run folder name, SETTINGS_TAB, or null for the fixed "Läufe" tab. */
  item: string | null;
  x: number;
  y: number;
  frame: FrameState;
  dispatch: (a: FrameAction) => void;
  onClose: () => void;
  /** Some tabs were closed: the toast offers "Rückgängig" with the state before. */
  onClosed: (n: number, before: FrameState) => void;
}

/** What each close command would close (pinned tabs never): used for the entries and for greying them out. */
export function closeSets(frame: FrameState, item: string | null) {
  const order = tabOrder(frame);
  const closable = (t: string) => !frame.pinned.includes(t);
  const at = item === null ? -1 : order.indexOf(item);
  return {
    others: order.filter((t) => t !== item && closable(t)),
    right: item === null ? [] : order.filter((t, i) => i > at && closable(t)),
    all: order.filter(closable),
  };
}

/** Right-click menu of a tab (v0.3.2, N). */
export function TabMenu({ item, x, y, frame, dispatch, onClose, onClosed }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: Event) => !box.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", away);
    document.addEventListener("contextmenu", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("contextmenu", away);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const sets = closeSets(frame, item);
  const close = (items: string[], force = false) => {
    onClose();
    const n = items.filter((t) => force || !frame.pinned.includes(t)).length;
    dispatch({ type: "close-tabs", items, force });
    if (n) onClosed(n, frame);
  };
  const isRun = item !== null && item !== SETTINGS_TAB;
  const pinned = item !== null && frame.pinned.includes(item);
  const canCopy = typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;
  const entry = (label: string, testid: string, run: () => void, enabled = true) => (
    <button role="menuitem" class="tab-menu-item" data-testid={testid} disabled={!enabled} onClick={run}>
      {label}
    </button>
  );
  return (
    <div
      class="tab-menu"
      role="menu"
      data-testid="tab-menu"
      ref={box}
      style={{ left: `${Math.min(x, window.innerWidth - 220)}px`, top: `${y}px` }}
    >
      {item === null ? (
        entry("Alle anderen schließen", "menu-close-all", () => close(sets.all), sets.all.length > 0)
      ) : (
        <>
          {entry("Schließen", "menu-close", () => close([item], true))}
          {entry("Andere schließen", "menu-close-others", () => close(sets.others), sets.others.length > 0)}
          {entry("Rechts schließen", "menu-close-right", () => close(sets.right), sets.right.length > 0)}
          {entry("Alle schließen", "menu-close-all", () => close(sets.all), sets.all.length > 0)}
          <div class="tab-menu-sep" />
          {entry(pinned ? "Lösen" : "Anheften", "menu-pin", () => { onClose(); dispatch({ type: pinned ? "unpin-tab" : "pin-tab", item }); })}
          {isRun && (
            <>
              <div class="tab-menu-sep" />
              {entry("Laufnamen kopieren", "menu-copy", () => { onClose(); void navigator.clipboard.writeText(item); }, canCopy)}
              {entry("In Läufe zeigen", "menu-reveal", () => { onClose(); dispatch({ type: "show-in-runs", run: item }); })}
            </>
          )}
        </>
      )}
    </div>
  );
}
