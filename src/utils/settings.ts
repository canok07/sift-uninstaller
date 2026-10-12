export const defaultSettings = { restorePoint: true, scanRegistry: true, scanAppData: true, silent: false };
export type AppSettings = typeof defaultSettings;
export function readSettingsState(storage?: Pick<Storage, 'getItem'>): { settings: AppSettings; issue?: string } {
  try {
    if (!storage) throw new Error('Storage unavailable');
    const raw = storage.getItem('sift_settings');
    if (raw === null) return { settings: { ...defaultSettings } };
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || Object.keys(defaultSettings).some(key => typeof saved[key] !== 'boolean')) {
      return { settings: { ...defaultSettings }, issue: 'Kayıtlı ayarlar okunamadı; güvenli varsayılan ayarlar kullanılıyor.' };
    }
    return { settings: Object.fromEntries(Object.keys(defaultSettings).map(key => [key, saved[key]])) as AppSettings };
  } catch { return { settings: { ...defaultSettings }, issue: 'Kayıtlı ayarlar okunamadı; güvenli varsayılan ayarlar kullanılıyor.' }; }
}
export function readSettings(storage?: Pick<Storage, 'getItem'>): AppSettings {
  return readSettingsState(storage).settings;
}
export function saveSettings(storage: Pick<Storage, 'setItem'> | undefined, settings: AppSettings): boolean {
  try { if (!storage) return false; storage.setItem('sift_settings', JSON.stringify({ version: 1, ...settings })); return true; } catch { return false; }
}
