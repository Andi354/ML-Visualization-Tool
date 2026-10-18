// "Ansicht zurücksetzen": forgets what the browser stored for this tool (tabs, columns, window, folds).
export function clearViewState() {
  try {
    const gone: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("mlviz:v1:")) gone.push(k);
    }
    gone.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable: nothing to forget */
  }
}
