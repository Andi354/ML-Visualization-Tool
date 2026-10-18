import { fillPattern } from "../settings/model";
import { setting } from "../settings/store";
// Model of the images in the save dialog: one image = one file; an image holds one widget or, after
// "Zu einem Bild", several (a group). Pure functions, no UI.

export type Layout = "stack" | "side";

export interface Image {
  /** Single images use the widget id as their id; groups get `g<n>`. */
  id: string;
  /** Widget ids in display order. */
  members: string[];
  layout: Layout;
  name: string;
  nameEdited: boolean;
  /** Title of the image; null = the default (key statement of a single widget, "A und B" of a group). */
  title: string | null;
  /** Show the grey texts (subtitle, note) of every graphic. */
  hints: boolean;
  footer: boolean;
}

export const single = (widgetId: string): Image => ({
  id: widgetId,
  members: [widgetId],
  layout: "stack",
  name: "",
  nameEdited: false,
  title: null,
  hints: true,
  footer: setting<boolean>("exp.footer"),
});

export const singles = (widgetIds: string[]): Image[] => widgetIds.map(single);

let groupCounter = 0;
export const newGroupId = () => `g${++groupCounter}`;

/** Merge the images with the given ids, in list order, into one group placed where the first was.
 *  Hints are off for a combined image (default). Returns the new list and the group's id. */
export function combine(images: Image[], ids: string[], groupId = newGroupId()): { images: Image[]; id: string } {
  const chosen = images.filter((i) => ids.includes(i.id));
  if (chosen.length < 2) return { images, id: chosen[0]?.id ?? "" };
  const at = images.findIndex((i) => i.id === chosen[0].id);
  const group: Image = {
    id: groupId,
    members: chosen.flatMap((i) => i.members),
    layout: "stack",
    name: "",
    nameEdited: false,
    title: null,
    hints: false,
    footer: true,
  };
  const rest = images.filter((i) => !ids.includes(i.id));
  const before = images.slice(0, at).filter((i) => !ids.includes(i.id)).length;
  return { images: [...rest.slice(0, before), group, ...rest.slice(before)], id: groupId };
}

/** "Trennen": every member becomes a single image at the group's place. */
export function split(images: Image[], id: string): Image[] {
  return images.flatMap((i) => (i.id === id && i.members.length > 1 ? i.members.map(single) : [i]));
}

/** "lösen": the member becomes its own image right after the group. A group left with one member is a
 *  single image again. */
export function detach(images: Image[], id: string, widgetId: string): Image[] {
  const out: Image[] = [];
  for (const i of images) {
    if (i.id !== id || i.members.length < 2 || !i.members.includes(widgetId)) {
      out.push(i);
      continue;
    }
    const left = i.members.filter((m) => m !== widgetId);
    out.push(left.length === 1 ? single(left[0]) : { ...i, members: left });
    out.push(single(widgetId));
  }
  return out;
}

/** Move a member up (-1) or down (+1) inside its group. */
export function reorder(images: Image[], id: string, widgetId: string, dir: -1 | 1): Image[] {
  return images.map((i) => {
    if (i.id !== id) return i;
    const at = i.members.indexOf(widgetId);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= i.members.length) return i;
    const members = [...i.members];
    [members[at], members[to]] = [members[to], members[at]];
    return { ...i, members };
  });
}

export const setLayout = (images: Image[], id: string, layout: Layout): Image[] => images.map((i) => (i.id === id ? { ...i, layout } : i));

export const patchImage = (images: Image[], id: string, patch: Partial<Image>): Image[] => images.map((i) => (i.id === id ? { ...i, ...patch } : i));

/** Default file name: `NN_<type>.png`, a group `NN_<type>+<type>.png`. */
/** File name of an image by the pattern of the setting `exp.name` (`{nr}`, `{widget}`). */
export const defaultName = (position: number, types: string[]): string =>
  fillPattern(setting<string>("exp.name") || "{nr}_{widget}.png", { nr: String(position + 1).padStart(2, "0"), widget: types.join("+") });

/** Target folder by the pattern of the setting `exp.folder` (`{deliverables}`, `{datum}`, `{titel}`, `{issue}`). */
export const targetFolder = (deliverables: string, datum: string, titel: string, issue = ""): string =>
  fillPattern(setting<string>("exp.folder") || "{deliverables}/{datum} {titel}/", { deliverables, datum, titel, issue })
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");

/** Default title of a group from its widget names: "A und B", "A, B und C". */
export function groupTitle(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} und ${labels[labels.length - 1]}`;
}

/** Keep the images in sync with the board: drop members whose widget is gone, add new widgets as singles. */
export function sync(images: Image[], widgetIds: string[]): Image[] {
  const alive = new Set(widgetIds);
  const kept: Image[] = [];
  for (const i of images) {
    const members = i.members.filter((m) => alive.has(m));
    if (!members.length) continue;
    kept.push(members.length === i.members.length ? i : members.length === 1 ? single(members[0]) : { ...i, members });
  }
  const used = new Set(kept.flatMap((i) => i.members));
  return [...kept, ...widgetIds.filter((w) => !used.has(w)).map(single)];
}

/** After splitting or detaching: an image is selected when all its widgets were selected before. */
export function reselect(before: Image[], selected: string[], after: Image[]): string[] {
  const chosen = new Set(before.filter((i) => selected.includes(i.id)).flatMap((i) => i.members));
  return after.filter((i) => i.members.every((m) => chosen.has(m))).map((i) => i.id);
}
