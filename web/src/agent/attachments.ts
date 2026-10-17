// Images for the agent (v0.2.3, feature L): what may be sent, checked in the browser before anything is uploaded.
// The tool checks again (first bytes, size, count); this only spares a useless upload and says why.

export const MAX_IMAGES = 4;
export const MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export interface Picked {
  name: string;
  type: string;
  size: number;
}

/** Which of the files may be added next to `have` images already waiting, and a line for each one that may not. */
export function checkImages(have: number, files: Picked[]): { accept: number[]; problems: string[] } {
  const accept: number[] = [];
  const problems: string[] = [];
  files.forEach((f, i) => {
    if (!IMAGE_TYPES.includes(f.type)) problems.push(`${f.name || "Datei"}: kein Bild (PNG, JPEG, WebP oder GIF)`);
    else if (f.size > MAX_BYTES) problems.push(`${f.name || "Bild"}: größer als ${MAX_BYTES / (1024 * 1024)} MB`);
    else if (have + accept.length >= MAX_IMAGES) problems.push(`${f.name || "Bild"}: höchstens ${MAX_IMAGES} Bilder je Nachricht`);
    else accept.push(i);
  });
  return { accept, problems };
}

/** The image files among what was pasted or dropped (a clipboard also holds text and other things). */
export const imagesOf = (items: FileList | File[] | null | undefined): File[] => Array.from(items ?? []).filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(f.name));

export const attachmentUrl = (file: string) => `/api/agent/attachments/${file}`;
