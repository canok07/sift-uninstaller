export const defaultSettings = { restorePoint: true, scanRegistry: true, scanAppData: true, silent: false };
export type AppSettings = typeof defaultSettings;
export function readSettings(storage?: Pick<Storage, 'getItem'>): AppSettings {
  try {
    const saved = JSON.parse(storage?.getItem('sift_settings') || 'null');
    if (!saved || saved.version !== 1) return { ...defaultSettings };
    return Object.fromEntries(Object.entries(defaultSettings).map(([key, fallback]) =>
      [key, typeof saved[key] === 'boolean' ? saved[key] : fallback])) as AppSettings;
  } catch { return { ...defaultSettings }; }
}
export function saveSettings(storage: Pick<Storage, 'setItem'>, settings: AppSettings): void {
  try { storage.setItem('sift_settings', JSON.stringify({ version: 1, ...settings })); } catch { /* Storage denial must not block uninstall safety. */ }
}
