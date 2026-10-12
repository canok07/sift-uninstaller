// Storage is optional: blocked or full storage must not break the renderer.
export function readTheme(storage?: Pick<Storage, 'getItem'>, systemDark = false): boolean {
  try {
    const saved = storage?.getItem('sift_theme');
    return saved === 'dark' ? true : saved === 'light' ? false : systemDark;
  } catch { return systemDark; }
}

export function saveTheme(storage: Pick<Storage, 'setItem'> | undefined, dark: boolean): boolean {
  try { if (!storage) return false; storage.setItem('sift_theme', dark ? 'dark' : 'light'); return true; } catch { return false; }
}

export function browserStorage(): Storage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}
