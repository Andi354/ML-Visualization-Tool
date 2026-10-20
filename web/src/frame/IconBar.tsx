import type { Area } from "../state/frame";
import { AgentIcon, AnalysisIcon, GearIcon, RunsIcon } from "./icons";

export const AREAS: { id: Area; label: string; built: boolean; Icon: () => preact.JSX.Element }[] = [
  { id: "runs", label: "Läufe", built: true, Icon: RunsIcon },
  { id: "analysis", label: "Analyse", built: true, Icon: AnalysisIcon },
];

interface Props {
  short: string;
  projectName: string;
  /** Colour of the project symbol (setting `project.color`). */
  color: string;
  /** The project symbol was clicked: the popover with name, letters and colour. */
  onProject: () => void;
  area: Area;
  onSelect: (a: Area) => void;
  /** The agent window is open or minimised (the icon is lit). */
  agentActive: boolean;
  onAgent: () => void;
  settingsActive: boolean;
  onSettings: () => void;
}

export function IconBar({ short, projectName, color, onProject, area, onSelect, agentActive, onAgent, settingsActive, onSettings }: Props) {
  return (
    <nav class="icon-bar" aria-label="Bereiche">
      <button class="project-badge" title={projectName} aria-label={`Projekt ${projectName}`} aria-haspopup="dialog" data-testid="project-badge" style={{ background: color }} onClick={onProject}>
        {short}
      </button>
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
        class={"icon-btn" + (settingsActive ? " active" : "")}
        title="Einstellungen (Strg+,)"
        aria-label="Einstellungen"
        aria-pressed={settingsActive}
        data-testid="settings-icon"
        onClick={onSettings}
      >
        <GearIcon />
      </button>
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
