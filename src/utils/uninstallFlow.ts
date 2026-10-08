import type { RestorePointResult, UninstallResult } from '../types';

export function hasVerifiedRemoval(result: UninstallResult): boolean {
  return Boolean(result.success && result.verified && !result.cancelled && !result.timedOut && !result.backgroundPending);
}

export function describeUninstall(result: UninstallResult) {
  if (result.cancelled || result.timedOut) return { status: result.cancelled ? 'cancelled' as const : 'warning' as const,
    text: result.message || 'Bekleme sonlandırıldı. Kaldırıcı zorla durdurulmadı; program listede tutuldu ve temizlik açılmadı.' };
  if (result.rebootRequired && result.success) return { status: 'warning' as const,
    text: result.message || 'Yeniden başlatma gerekli; temizlik engellendi.' };
  if (hasVerifiedRemoval(result)) return { status: 'success' as const, text: result.message || 'Programın kaldırıldığı doğrulandı.' };
  return { status: 'error' as const, text: result.error || result.message || 'Kaldırma doğrulanamadı.' };
}

export async function confirmRestoreFailure(
  create: () => Promise<RestorePointResult>,
  decide: (error: string) => Promise<boolean>
): Promise<{ proceed: boolean; warning?: string }> {
  let warning: string;
  try {
    const result = await create();
    if (result.success) return { proceed: true };
    warning = result.error || 'Geri yükleme noktası oluşturulamadı.';
  } catch (error) {
    warning = error instanceof Error ? error.message : String(error);
  }
  return { proceed: await decide(warning), warning };
}
