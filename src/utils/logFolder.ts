import type { ElectronAPI } from '../types';

export async function openLogFolderSafely(bridge?: Pick<ElectronAPI, 'openLogFolder'>): Promise<{ success: boolean; message: string }> {
  if (!bridge?.openLogFolder) return { success: false, message: 'Log klasörü yalnızca masaüstü uygulamasında açılabilir.' };
  try {
    const result = await bridge.openLogFolder();
    return { success: result.success, message: result.success ? 'Log dosyasının bulunduğu klasör açıldı.'
      : `Log klasörü açılamadı: ${result.error || 'Bilinmeyen hata'}` };
  } catch { return { success: false, message: 'Log klasörü açılamadı. Masaüstü bağlantısını kontrol edip yeniden deneyin.' }; }
}
