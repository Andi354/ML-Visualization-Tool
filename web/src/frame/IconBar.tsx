import type { Area } from "../state/frame";
import { AgentIcon, AnalysisIcon, RunsIcon } from "./icons";

export const AREAS: { id: Area; label: string; built: boolean; Icon: () => preact.JSX.Element }[] = [
  { id: "runs", label: "Läufe", built: true, Icon: RunsIcon },
  { id: "analysis", label: "Analyse", built: true, Icon: AnalysisIcon },
];

interface Props {
  short: string;
  projectName: string;
  area: Area;
  onSelect: (a: Area) => void;
  /** The agent window is open or minimised (the icon is lit). */
  agentActive: boolean;
  onAgent: () => void;
}

export function IconBar({ short, projectName, area, onSelect, agentActive, onAgent }: Props) {
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
      <div class="icon-bar-bottom" />
      <button
        class={"icon-btn" + (agentActive ? " active" : "")}
        title="Agent"
        aria-label="Agent"
        aria-pressed={agentActive}
        data-testid="agent-icon"
        onClick={onAgent}
      >
        <AgentIcon />
      </button>
    </nav>
  );
}
