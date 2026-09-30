import fs from 'node:fs';
import path from 'node:path';

export interface SafetyResult { safe: boolean; reason?: string }

export function isSafeName(value: string): boolean {
  return value.length >= 3 && value === value.trim() &&
    !/[\\/:*?"<>|\x00-\x1f]/.test(value) && !/[. ]$/.test(value) &&
    value !== '.' && value !== '..' &&
    !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(value);
}

export function buildCleanupCandidates(root: string, terms: string[], publisher: string): string[] {
  return [...new Set(terms.filter(isSafeName).flatMap((term) => {
    // A publisher's shared root is never a program-specific cleanup target.
    if (term.toLowerCase() === publisher.toLowerCase()) return [];
    return [path.join(root, term), ...(isSafeName(publisher) ? [path.join(root, publisher, term)] : [])];
  }))];
}

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function checkCleanupPath(target: string, roots: string[], windowsDirectory?: string): SafetyResult {
  if (!path.isAbsolute(target) || target.split(/[\\/]/).includes('..')) {
    return { safe: false, reason: 'Mutlak ve izin verilen kapsamda bir yol gerekli.' };
  }
  const normalized = path.resolve(target);
  const root = roots.filter(Boolean).map((value) => path.resolve(value)).find((value) => inside(value, normalized));
  if (!root) return { safe: false, reason: 'Hedef izin verilen temizlik klasörlerinin dışında veya kök klasör.' };
  if (windowsDirectory) {
    const system = path.resolve(windowsDirectory);
    if (normalized.toLowerCase() === system.toLowerCase() || inside(system, normalized)) {
      return { safe: false, reason: 'Windows klasörü temizlenemez.' };
    }
  }

  // Reject links/junctions in both the target and its ancestors. Recheck before deletion.
  for (let current = normalized; ; current = path.dirname(current)) {
    try {
      if (fs.lstatSync(current).isSymbolicLink()) return { safe: false, reason: 'Bağlantı/junction içeren hedef engellendi.' };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
  }
  if (fs.existsSync(normalized)) {
    const realRoot = fs.realpathSync(root);
    if (!inside(realRoot, fs.realpathSync(normalized))) {
      return { safe: false, reason: 'Gerçek hedef izin verilen klasörün dışında.' };
    }
  }
  return { safe: true };
}

export function checkCleanupRegistry(key: string): SafetyResult {
  const normalized = key.toUpperCase().replace(/^HKEY_CURRENT_USER\\/, 'HKCU\\').replace(/^HKEY_LOCAL_MACHINE\\/, 'HKLM\\');
  const parts = normalized.split('\\');
  if (!['HKCU', 'HKLM'].includes(parts[0]) || parts[1] !== 'SOFTWARE' || parts.length < 3 ||
      parts.some((part) => !part || part === '.' || part === '..' || /[/:*?\x00-\x1f]/.test(part))) {
    return { safe: false, reason: 'Yalnızca doğrulanmış Software alt anahtarları temizlenebilir.' };
  }
  const vendor = parts[2] === 'WOW6432NODE' ? parts[3] : parts[2];
  if (!vendor || ['MICROSOFT', 'CLASSES', 'POLICIES', 'REGISTEREDAPPLICATIONS'].includes(vendor)) {
    return { safe: false, reason: 'Windows tarafından paylaşılan Registry alanı korunuyor.' };
  }
  return { safe: true };
}

export async function assertNoLinkedChildren(target: string): Promise<void> {
  let stat: fs.Stats;
  try { stat = await fs.promises.lstat(target); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error('Bağlantı/junction içeren klasör silinemez.');
  if (!stat.isDirectory()) return;
  for (const entry of await fs.promises.readdir(target, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Alt klasörde bağlantı/junction bulundu; hedef korunuyor.');
    if (entry.isDirectory()) await assertNoLinkedChildren(path.join(target, entry.name));
  }
}
