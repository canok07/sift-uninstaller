import type { InstalledProgram, RegistryAuditResult, RegistryFinding } from '../src/types';
import { parseUninstallCommand } from './uninstallCommand';

export const REGISTRY_AUDIT_LIMIT = 5000;
export const REGISTRY_FINDING_LIMIT = 500;
type FileState = 'file' | 'missing' | 'unreadable';

export function registryAuditFailure(error: string): RegistryAuditResult {
  return { success: false, scannedAt: new Date().toISOString(), registryCount: 0, checkedCount: 0,
    skippedSystemCount: 0, findings: [], sources: [], warnings: [], partial: true, error };
}

// Metadata only. Never run a Registry command, inspect executable bytes, delete
// a key, or derive cleanup authorization from a finding.
export async function inspectRegistryPrograms(programs: InstalledProgram[], env: NodeJS.ProcessEnv,
  inspectFile: (file: string) => Promise<FileState>, budgetMs = 20_000): Promise<RegistryAuditResult> {
  const registry = programs.filter(p => p.registryHive !== 'APPX' && p.category !== 'store');
  const result: RegistryAuditResult = { success: true, scannedAt: new Date().toISOString(), registryCount: registry.length,
    checkedCount: 0, skippedSystemCount: 0, findings: [], sources: [], warnings: [], partial: false };
  const deadline = Date.now() + budgetMs;
  const fileCache = new Map<string, Promise<FileState>>();
  const groups = new Map<string, InstalledProgram[]>();
  let truncated = false;
  const add = (p: InstalledProgram, code: RegistryFinding['code'], message: string, variant = '') => {
    if (result.findings.length >= REGISTRY_FINDING_LIMIT) { truncated = true; return; }
    result.findings.push({ id: p.id + ':' + code + ':' + variant, appName: p.displayName.slice(0, 256),
      registryKey: (p.registryKey || '').slice(0, 2048), hive: p.registryHive, code, message });
  };
  const fileState = (file: string): Promise<FileState> => {
    const key = file.toLowerCase();
    if (!fileCache.has(key)) fileCache.set(key, (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([Promise.resolve().then(() => inspectFile(file)).catch(() => 'unreadable' as const),
          new Promise<FileState>(resolve => { timer = setTimeout(() => resolve('unreadable'), Math.max(1, Math.min(1500, deadline - Date.now()))); })]);
      } finally { if (timer !== undefined) clearTimeout(timer); }
    })());
    return fileCache.get(key)!;
  };
  for (const p of registry.slice(0, REGISTRY_AUDIT_LIMIT)) {
    if (Date.now() >= deadline) { result.partial = true; result.warnings.push('Kontrol süre sınırına ulaştı; kalan kayıtlar incelenmedi.'); break; }
    result.checkedCount++;
    if (p.isSystemComponent || p.category === 'system') { result.skippedSystemCount++; continue; }
    const publisher = p.publisher?.trim().toLowerCase();
    // Exact name + known publisher + version only; do not strip architecture
    // or merge versions. Even these groups are review hints, not duplicates.
    if (publisher && publisher !== 'bilinmeyen yayıncı' && publisher !== 'unknown publisher') {
      const group = JSON.stringify([p.displayName.trim().toLowerCase(), publisher, p.displayVersion?.trim().toLowerCase() || '']);
      groups.set(group, [...(groups.get(group) || []), p]);
    }
    const commands = [['normal', p.uninstallString], ['sessiz', p.quietUninstallString]] as const;
    if (!commands.some(([, command]) => command?.trim())) {
      add(p, 'missing-command', 'Kaldırma komutu belirtilmemiş. Bu, kaydın gereksiz olduğunu kanıtlamaz.'); continue;
    }
    for (const [variant, command] of commands) {
      if (!command?.trim()) continue;
      let executable: string;
      try { executable = parseUninstallCommand(command, env).executable; }
      catch {
        add(p, 'unsupported-command', `${variant === 'sessiz' ? 'Sessiz' : 'Normal'} kaldırma komutu Sift’in güvenli çalıştırma desteği dışında veya hatalı. Windows üzerinden kontrol edin.`, variant);
        continue;
      }
      const state = await fileState(executable);
      if (state === 'missing') add(p, 'missing-executable', `${variant === 'sessiz' ? 'Sessiz' : 'Normal'} kaldırıcı dosyası bulunamadı. Eksik dosya, programın kaldırıldığını kanıtlamaz.`, variant);
      else if (state === 'unreadable') {
        result.partial = true;
        add(p, 'unreadable-executable', 'Kaldırıcı dosyasının durumu doğrulanamadı (erişim veya süre sınırı).', variant);
      }
    }
  }
  for (const entries of groups.values()) {
    const distinct = new Set(entries.map(p => p.registryKey?.toLowerCase()).filter(Boolean));
    if (distinct.size < 2) continue;
    for (const p of entries) add(p, 'similar-record', `Aynı ad, yayıncı ve sürümle ${distinct.size} farklı kurulum kaydı var. Farklı kullanıcı/mimari kurulumları olabilir; otomatik birleştirilmez veya silinmez.`);
  }
  if (registry.length > REGISTRY_AUDIT_LIMIT) { result.partial = true; result.warnings.push(`En fazla ${REGISTRY_AUDIT_LIMIT} kayıt incelenir; liste bu sınırı aşıyor.`); }
  if (truncated) { result.partial = true; result.warnings.push(`En fazla ${REGISTRY_FINDING_LIMIT} bulgu gösterilir; rapor kısaltıldı.`); }
  return result;
}
