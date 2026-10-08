import type { InstalledProgramsResult, LeftoverDeleteResult, LeftoverScanResult } from '../types';

export function describeInventory(result: InstalledProgramsResult) {
  const failures = result.sources?.filter(source => source.status === 'error') || [];
  if (!result.success) return { status: 'error' as const, text: result.error || 'Program kaynakları okunamadı.' };
  if (result.partial || failures.length || result.warnings?.length) return { status: 'warning' as const,
    text: `${result.programs.length} program listelendi. ${failures.length ? 'Eksik tarama: ' + failures.map(source => source.id + ': ' + source.error).join(' | ') : result.partial ? 'Tarama eksik kaldı.' : 'Bazı ad/simge bilgileri okunamadı.'}` };
  return { status: 'success' as const, text: `${result.programs.length} program listelendi; tüm tarama kaynakları kontrol edildi.` };
}

export function describeCleanup(result: LeftoverDeleteResult) {
  const deletedIds = result.results.filter((item) => item.success).map((item) => item.id);
  const failed = result.results.filter((item) => !item.success);
  return {
    deletedIds,
    failedCount: Math.max(failed.length, result.failedCount),
    error: failed.length || result.failedCount || !result.success
      ? `${deletedIds.length} öğe silindi, ${Math.max(failed.length, result.failedCount)} öğe silinemedi. ${result.error || failed.map((item) => `${item.path}: ${item.error || 'Silinemedi'}`).join(' | ')}`
      : null,
    summary: `${deletedIds.length} öğe silindi, ${Math.max(failed.length, result.failedCount)} hata.`
  };
}

export function describeScan(result: LeftoverScanResult) {
  if (!result.success || result.warnings?.length) {
    return { type: 'error' as const,
      text: `Tarama tamamlanamadı: ${result.error || result.warnings?.join(' | ') || 'Bilinmeyen hata'}` };
  }
  return { type: 'info' as const, text: result.items.length
    ? `${result.items.length} kalıntı adayı bulundu.`
    : 'Seçilen alanlarda kalıntı bulunamadı.' };
}
