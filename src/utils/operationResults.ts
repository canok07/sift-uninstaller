import type { LeftoverDeleteResult, LeftoverScanResult } from '../types';

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
