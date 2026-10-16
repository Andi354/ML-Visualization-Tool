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

export const RunsIcon = () => (
  <svg {...base}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

export const AnalysisIcon = () => (
  <svg {...base}>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base} width={12} height={12} stroke-width={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const AgentIcon = ({ size = 18, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color ?? "currentColor"} stroke-width="1.5" aria-hidden="true">
    <path d="M9 2.5l1.4 3.6 3.6 1.4-3.6 1.4L9 12.5 7.6 8.9 4 7.5l3.6-1.4z" />
    <path d="M14 12l.6 1.4 1.4.6-1.4.6L14 16l-.6-1.4-1.4-.6 1.4-.6z" />
  </svg>
);

export const MicIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
    <rect x="6.5" y="2" width="5" height="9" rx="2.5" />
    <path d="M4 8.5a5 5 0 0 0 10 0M9 13.5V16" />
  </svg>
);
