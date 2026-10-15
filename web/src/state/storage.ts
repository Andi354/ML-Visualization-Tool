// Browser storage per project. Every access is guarded: storage can be blocked or hold junk.
export function loadJson<T>(key: string, validate: (v: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return validate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the state just does not survive a reload */
  }
}

export const storageKey = (project: string, name: string) => `mlviz:v1:${project}:${name}`;
