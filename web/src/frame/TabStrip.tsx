import { useEffect, useRef, useState } from "preact/hooks";
import { SETTINGS_TAB, type Area } from "../state/frame";
import { SearchIcon } from "./icons";

export const AREA_LABEL: Record<Area, string> = { runs: "Läufe", analysis: "Analyse" };

/** Label of a run tab: the run folder name without the timestamp. */
export function tabLabel(folder: string): string {
  const ts = "(?:\\d{4}-\\d{2}-\\d{2}[_T]\\d{4,6}|\\d{8}[-_T]?\\d{6})";
  const stripped = folder.replace(new RegExp(`^${ts}_`), "");
  return stripped !== folder ? stripped : folder.replace(new RegExp(`_${ts}$`), "");
}

interface Props {
  area: Area;
  tabs: string[];
  active: string | null;
  onFocusPinned: () => void;
  onFocus: (run: string) => void;
  onClose: (run: string) => void;
  settings: boolean;
  onFocusSettings: () => void;
  onCloseSettings: () => void;
  projectName: string;
  onPalette: () => void;
}

/** Room the tabs have left of the centred search box (half the strip minus half the box and a gap). */
const SEARCH_HALF = 170 + 12;

export function TabStrip({ area, tabs, active, onFocusPinned, onFocus, onClose, settings, onFocusSettings, onCloseSettings, projectName, onPalette }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // Too many tabs for the left half: the search box gets its own row on top and the tabs wrap below it.
  const [wrapped, setWrapped] = useState(false);
  useEffect(() => {
    const el = strip.current;
    const tabsEl = list.current;
    if (!el || !tabsEl) return;
    const check = () => {
      const natural = [...tabsEl.children].reduce((n, c) => n + (c as HTMLElement).offsetWidth, 0);
      setWrapped(natural > el.clientWidth / 2 - SEARCH_HALF);
    };
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    ro.observe(tabsEl);
    return () => ro.disconnect();
  }, [tabs.length, settings, area]);
  return (
    <div class={"tab-strip" + (wrapped ? " wrapped" : "")} role="tablist" data-testid="tab-strip" ref={strip}>
      <div class="tab-list" ref={list}>
      <button
        role="tab"
        class={"tab pinned" + (active === null ? " active" : "")}
        aria-selected={active === null}
        data-testid="tab-pinned"
        onClick={onFocusPinned}
      >
        {AREA_LABEL[area]}
      </button>
      {settings && (
        <div
          role="tab"
          tabIndex={0}
          class={"tab run" + (active === SETTINGS_TAB ? " active" : "")}
          aria-selected={active === SETTINGS_TAB}
          data-testid="tab-settings"
          onClick={onFocusSettings}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onFocusSettings()}
          onMouseUp={(e) => e.button === 1 && onCloseSettings()}
        >
          <span class="tab-label">Einstellungen</span>
          <button class="tab-close" aria-label="Einstellungen schließen" data-testid="settings-close" onClick={(e) => { e.stopPropagation(); onCloseSettings(); }}>
            ×
          </button>
        </div>
      )}
      {tabs.map((run) => (
        <div
          key={run}
          role="tab"
          tabIndex={0}
          class={"tab run" + (active === run ? " active" : "")}
          aria-selected={active === run}
          title={run}
          data-testid="tab-run"
          data-run={run}
          onClick={() => onFocus(run)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onFocus(run)}
          onMouseDown={(e) => e.button === 1 && e.preventDefault()}
          onMouseUp={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              onClose(run);
            }
          }}
        >
          <span class="tab-label mono">{tabLabel(run)}</span>
          <button
            class="tab-close"
            aria-label={`${tabLabel(run)} schließen`}
            data-testid="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(run);
            }}
          >
            ×
          </button>
        </div>
      ))}
      </div>
      <button class="palette-box" data-testid="palette-box" aria-label="Befehlspalette öffnen" onClick={onPalette}>
        <SearchIcon />
        {projectName}
      </button>
    </div>
  );
}
