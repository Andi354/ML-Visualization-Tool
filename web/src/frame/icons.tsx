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
