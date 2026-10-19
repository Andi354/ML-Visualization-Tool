const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 1.7,
  "stroke-linecap": "round" as const,
  "stroke-linejoin": "round" as const,
  "aria-hidden": true,
};

const rail = { width: 18, height: 18, viewBox: "0 0 18 18", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "aria-hidden": true };

export const RunsIcon = () => (
  <svg {...rail}>
    <path d="M3 4.5h12M3 9h12M3 13.5h8" />
  </svg>
);

export const AnalysisIcon = () => (
  <svg {...rail}>
    <rect x="2.5" y="3" width="5.5" height="12" rx="1" />
    <rect x="10" y="3" width="5.5" height="12" rx="1" />
  </svg>
);

/** The agent star; `single` is the big star alone (header and capsule of the window), else with its small one (rail). */
export const AgentIcon = ({ size = 18, color, single }: { size?: number; color?: string; single?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color ?? "currentColor"} stroke-width={single ? 1.6 : 1.5} aria-hidden="true">
    <path d="M9 2.5l1.4 3.6 3.6 1.4-3.6 1.4L9 12.5 7.6 8.9 4 7.5l3.6-1.4z" />
    {!single && <path d="M14 12l.6 1.4 1.4.6-1.4.6L14 16l-.6-1.4-1.4-.6 1.4-.6z" />}
  </svg>
);

export const MicIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
    <rect x="6.5" y="2" width="5" height="9" rx="2.5" />
    <path d="M4 8.5a5 5 0 0 0 10 0M9 13.5V16" />
  </svg>
);

export const BugIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
    <rect x="5.5" y="5" width="7" height="9" rx="3.5" />
    <path d="M7 5a2 2 0 0 1 4 0M9 7.5v6M5.5 9H3M12.5 9H15M5.7 6.2 4 4.5M12.3 6.2 14 4.5M5.7 12.3 4 14M12.3 12.3 14 14" />
  </svg>
);

export const PaperclipIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14.5 8.5 9 14a3.5 3.5 0 0 1-5-5l6-6a2.3 2.3 0 0 1 3.3 3.3l-6 6a1.1 1.1 0 0 1-1.6-1.6L10.5 5" />
  </svg>
);

export const GearIcon = () => (
  <svg {...rail} stroke-width={1.4}>
    <circle cx="9" cy="9" r="2.4" />
    <path d="M9 1.8v2M9 14.2v2M1.8 9h2M14.2 9h2M3.9 3.9l1.4 1.4M12.7 12.7l1.4 1.4M3.9 14.1l1.4-1.4M12.7 5.3l1.4-1.4" />
  </svg>
);

export const SearchIcon = () => (
  <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width={1.6} aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);

export const BellIcon = () => (
  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width={1.5} aria-hidden="true">
    <path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1 1.2H3z" />
    <path d="M6.6 14a1.5 1.5 0 0 0 2.8 0" />
  </svg>
);

export const PinIcon = () => (
  <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width={1.5} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9.5 1.8l4.7 4.7-1.6.6-2.3 2.3.3 3-1 1-3-3-3.6 3.6M6.2 4.7l1.6-.6" />
  </svg>
);
