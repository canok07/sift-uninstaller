import type { UninstallResult } from '../src/types';

export async function verifyUninstall(
  isInstalled: () => Promise<boolean>,
  exitCode = 0,
  attempts = 12,
  pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 1500))
): Promise<UninstallResult> {
  const rebootRequired = exitCode === 3010;
  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (!(await isInstalled())) {
        return { success: true, verified: true, exitCode, rebootRequired,
          message: rebootRequired ? 'Kaldırma doğrulandı; Windows yeniden başlatılmalı.' : 'Programın kaldırıldığı doğrulandı.' };
      }
      if (attempt + 1 < attempts) await pause();
    }
    return {
      success: rebootRequired, verified: false, exitCode, rebootRequired,
      ...(rebootRequired
        ? { message: 'Kaldırıcı yeniden başlatma istiyor. Program doğrulanana kadar listede tutuldu; kalıntı temizliği başlatılmadı.' }
        : { error: 'Kaldırıcının çıkmasına rağmen program hâlâ kayıtlı. İşlem iptal edilmiş veya başka pencerede devam ediyor olabilir. Uygulamalar düğmesiyle listeyi yenileyin.' })
    };
  } catch (error) {
    return { success: false, verified: false, exitCode, rebootRequired,
      error: `Kaldırma doğrulanamadı: ${error instanceof Error ? error.message : String(error)}` };
  }
}
