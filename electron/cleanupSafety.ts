import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export interface SafetyResult { safe: boolean; reason?: string }

export function isSafeName(value: string): boolean {
  return value.length >= 3 && value === value.trim() &&
    !/[\\/:*?"<>|\x00-\x1f]/.test(value) && !/[. ]$/.test(value) &&
    value !== '.' && value !== '..' &&
    !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(value) &&
    !['microsoft', 'windows', 'packages', 'temp', 'cache', 'programs', 'software'].includes(value.toLowerCase());
}

// Bounded tree identity, recorded at scan time and rechecked synchronously just
// before moving. Node path operations are not an atomic OS handle transaction.
export function treeFingerprint(target: string, contents = false): string {
  const hash = createHash('sha256');
  let entries = 0, bytes = 0;
  const walk = (file: string, relative: string, depth: number) => {
    if (++entries > 10000 || depth > 32) throw new Error('Hedef güvenli inceleme sınırını aşıyor.');
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw new Error('Bağlantı veya desteklenmeyen hedef korunuyor.');
    hash.update(JSON.stringify([relative, stat.isDirectory() ? 'dir' : 'file', ...(contents ? [] : [stat.dev, stat.ino, stat.birthtimeMs, stat.mtimeMs, stat.size])]));
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) walk(path.join(file, name), path.join(relative, name), depth + 1);
    } else if (contents) {
      if ((bytes += stat.size) > 512 * 1024 * 1024) throw new Error('Yedek doğrulama boyut sınırını aşıyor.');
      const fd = fs.openSync(file, 'r');
      try {
        const buffer = Buffer.alloc(65536);
        let count: number;
        while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count));
      } finally { fs.closeSync(fd); }
    }
  };
  walk(target, '', 0);
  return hash.digest('hex');
}

export function parentFingerprint(target: string): string {
  const stat = fs.lstatSync(path.dirname(target));
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Hedefin üst klasörü güvenli değil.');
  return JSON.stringify([fs.realpathSync(path.dirname(target)), stat.dev, stat.ino, stat.birthtimeMs]);
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
