import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { checkCleanupPath, checkCleanupRegistry, treeFingerprint } from './cleanupSafety';
import { uuid } from './ipcSafety';
import type { BackupEntry, InstalledProgram, LeftoverItem } from '../src/types';

export type BackupRecord = BackupEntry & { version: 1; program: InstalledProgram; digest?: string };
export function noLinks(file: string) {
  for (let current = path.resolve(file); ; current = path.dirname(current)) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Yedek yolunda bağlantı bulundu.'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (path.dirname(current) === current) break;
  }
}

export function validateRegBackup(bytes: Buffer, key: string) {
  const full = key.replace(/^HKCU\\/i, 'HKEY_CURRENT_USER\\').replace(/^HKLM\\/i, 'HKEY_LOCAL_MACHINE\\').toUpperCase();
  const text = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8').replace(/^\uFEFF/, '');
  if (!text.startsWith('Windows Registry Editor Version 5.00') || bytes.length > 16 * 1024 * 1024) throw new Error('Registry yedeği geçersiz veya çok büyük.');
  let sections = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('[')) continue;
    const match = /^\[([^\]]+)\]$/.exec(line);
    if (!match || (match[1].toUpperCase() !== full && !match[1].toUpperCase().startsWith(full + '\\')) || !checkCleanupRegistry(match[1]).safe) throw new Error('Registry yedeği hedef dışı anahtar içeriyor.');
    sections++;
  }
  if (!sections) throw new Error('Registry yedeğinde hedef anahtar bulunamadı.');
  return createHash('sha256').update(bytes).digest('hex');
}

export class CleanupBackups {
  constructor(readonly root: string) {}
  directory(id: string) {
    if (!uuid(id)) throw new Error('Geçersiz yedek kimliği.');
    const result = path.join(this.root, id);
    noLinks(result);
    return result;
  }
  payload(record: BackupRecord) { return path.join(this.directory(record.id), record.type === 'registry_key' ? 'backup.reg' : 'payload'); }
  save(record: BackupRecord) {
    const directory = this.directory(record.id);
    fs.mkdirSync(directory, { recursive: true });
    const tmp = path.join(directory, 'manifest-' + randomUUID() + '.tmp');
    // Do not follow a substituted manifest link.
    noLinks(path.join(directory, 'manifest.json')); noLinks(tmp);
    const fd = fs.openSync(tmp, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(record, null, 2)); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    try { fs.renameSync(tmp, path.join(directory, 'manifest.json')); }
    finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  }
  prepare(item: LeftoverItem, program: InstalledProgram): BackupRecord {
    const record: BackupRecord = { version: 1, id: randomUUID(), type: item.type, originalPath: item.path,
      appName: program.displayName, createdAt: new Date().toISOString(), state: 'prepared', program: {
        id: program.id, displayName: program.displayName, publisher: program.publisher, category: program.category,
        registryHive: program.registryHive, registryKey: program.registryKey, packageName: program.packageName, packageFullName: program.packageFullName
      } };
    this.save(record);
    return record;
  }
  read(id: string): BackupRecord {
    const file = path.join(this.directory(id), 'manifest.json');
    noLinks(file);
    if (fs.statSync(file).size > 32768) throw new Error('Yedek kaydı çok büyük.');
    const record = JSON.parse(fs.readFileSync(file, 'utf8')) as BackupRecord;
    if (record.version !== 1 || record.id !== id || !['folder', 'file', 'registry_key'].includes(record.type)
      || !['prepared', 'backed-up', 'completed', 'failed', 'restoring', 'restored'].includes(record.state)
      || typeof record.originalPath !== 'string' || record.originalPath.length > 4096 || typeof record.appName !== 'string'
      || record.appName.length > 512 || !record.program || record.program.displayName !== record.appName
      || typeof record.createdAt !== 'string' || typeof record.program.id !== 'string' || record.program.id.length > 200
      || (record.error !== undefined && (typeof record.error !== 'string' || record.error.length > 2000))
      || !Number.isFinite(Date.parse(record.createdAt)) || (record.digest && !/^[a-f0-9]{64}$/.test(record.digest))) throw new Error('Yedek kaydı geçersiz.');
    return record;
  }
  list(): { entries: BackupEntry[]; warnings: string[] } {
    noLinks(this.root);
    if (!fs.existsSync(this.root)) return { entries: [], warnings: [] };
    const entries: BackupEntry[] = [], warnings: string[] = [];
    const names = fs.readdirSync(this.root);
    if (names.some(name => !uuid(name))) warnings.push('Önceki sürüm biçimindeki yedekler otomatik geri alınamaz; yedek klasöründe korunuyor.');
    if (names.filter(uuid).length > 200) warnings.push('Yalnızca son 200 yedek gösteriliyor. Diğer yedekler diskte korunuyor.');
    for (const id of names.filter(uuid).sort((a, b) => fs.lstatSync(path.join(this.root, b)).mtimeMs - fs.lstatSync(path.join(this.root, a)).mtimeMs).slice(0, 200)) {
      try {
        const record = this.read(id);
        const { program: _program, digest: _digest, version: _version, ...entry } = record;
        entries.push({ ...entry, available: Boolean(record.digest) && fs.existsSync(this.payload(record)) && record.state !== 'restored' });
      } catch { warnings.push(id + ': yedek kaydı okunamadı; dosyalar korunuyor.'); }
    }
    return { entries: entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), warnings };
  }
  verify(record: BackupRecord) {
    if (!record.digest) throw new Error('Yedeğin tamamlandığı doğrulanamıyor; otomatik geri alma engellendi.');
    const payload = this.payload(record);
    noLinks(payload);
    const stat = fs.lstatSync(payload);
    if (record.type === 'folder' ? !stat.isDirectory() : !stat.isFile()) throw new Error('Yedek öğesinin türü değişmiş.');
    if (record.type === 'registry_key' && stat.size > 16 * 1024 * 1024) throw new Error('Registry yedeği çok büyük.');
    const digest = record.type === 'registry_key' ? validateRegBackup(fs.readFileSync(payload), record.originalPath) : treeFingerprint(payload, true);
    if (record.digest && digest !== record.digest) throw new Error('Yedek içeriği değişmiş; geri alma engellendi.');
    return digest;
  }
  restoreFiles(record: BackupRecord, roots: string[], windowsDirectory?: string) {
    const safety = checkCleanupPath(record.originalPath, roots, windowsDirectory);
    if (!safety.safe) throw new Error(safety.reason);
    this.verify(record);
    noLinks(record.originalPath);
    if (!fs.existsSync(path.dirname(record.originalPath))) throw new Error('Özgün üst klasör bulunamadı; otomatik oluşturulmadı.');
    // Exclusive creation: never merge into or overwrite an existing target.
    const copy = (from: string, to: string) => {
      noLinks(from); noLinks(to);
      const stat = fs.lstatSync(from);
      if (stat.isDirectory()) {
        fs.mkdirSync(to); // EEXIST preserves any new/reinstalled data.
        for (const name of fs.readdirSync(from)) copy(path.join(from, name), path.join(to, name));
      } else if (stat.isFile()) fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
      else throw new Error('Desteklenmeyen yedek öğesi.');
    };
    copy(this.payload(record), record.originalPath);
    // Keep the payload even after success; interrupted/partial copies are not erased.
  }
}
