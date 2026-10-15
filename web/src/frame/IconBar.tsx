import type { Area } from "../state/frame";
import { AnalysisIcon, RunsIcon } from "./icons";

export const AREAS: { id: Area; label: string; built: boolean; Icon: () => preact.JSX.Element }[] = [
  { id: "runs", label: "Läufe", built: true, Icon: RunsIcon },
  { id: "analysis", label: "Analyse", built: true, Icon: AnalysisIcon },
];

interface Props {
  short: string;
  projectName: string;
  area: Area;
  onSelect: (a: Area) => void;
}

export function IconBar({ short, projectName, area, onSelect }: Props) {
  return (
    <nav class="icon-bar" aria-label="Bereiche">
      <div class="project-badge" title={projectName} data-testid="project-badge">
        {short}
      </div>
      {AREAS.filter((a) => a.built).map(({ id, label, Icon }) => (
        <button
          key={id}
          class={"icon-btn" + (area === id ? " active" : "")}
          title={label}
          aria-label={label}
          aria-pressed={area === id}
          data-testid={`area-${id}`}
          onClick={() => onSelect(id)}
        >
          <Icon />
        </button>
      ))}
      {/* the bottom of the bar is reserved for the agent (later update) */}
      <div class="icon-bar-bottom" />
    </nav>
  );
}
