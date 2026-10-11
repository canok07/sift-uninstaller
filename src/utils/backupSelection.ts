import type { BackupEntry, LeftoverDeleteResult } from '../types';

export function cleanupBackupIds(results: LeftoverDeleteResult['results']): string[] {
  return [...new Set(results.map(result => result.backupId).filter((id): id is string =>
    typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))];
}

export function selectBackupEntries(entries: BackupEntry[], ids: readonly string[]): BackupEntry[] {
  return ids.length ? entries.filter(entry => ids.includes(entry.id)) : entries;
}
