// How the project is shown (v0.3.2, O): name, two letters and colour of the project symbol. Display only; the storage keys of the
// browser state stay on `project.name` from project.yaml.
import { PROJECT_COLORS } from "./catalog";
import { setting, useSettings } from "./store";

export interface Look {
  name: string;
  short: string;
  color: string;
}

export const DEFAULT_COLOR = PROJECT_COLORS[0];

/** The look of the project: the settings win, empty ones fall back to project.yaml. */
export function look(project: { name: string; short: string }): Look {
  const name = setting<string>("project.name").trim() || project.name;
  const short = (setting<string>("project.short").trim() || project.short).slice(0, 2).toUpperCase();
  return { name, short, color: setting<string>("project.color") || DEFAULT_COLOR };
}

/** Same, and re-renders when a setting changes. */
export function useLook(project: { name: string; short: string }): Look {
  useSettings();
  return look(project);
}
