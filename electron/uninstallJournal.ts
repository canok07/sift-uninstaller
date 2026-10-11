import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { noLinks } from './cleanupBackups';
import { getProgramId } from './programIdentity';
import { uuid } from './ipcSafety';
import type { InstalledProgram, UninstallActivity } from '../src/types';

type Record = { version: 1; id: string; startedAt: number; complete: boolean; program: InstalledProgram; pid?: number; processToken?: string };
type Probe = (pid: number) => Promise<string | null>;
export class UninstallJournal {
  private record?: Record;
  private recovered = false;
  private uncertain?: string;
  private notice?: string;
  private polling?: Promise<UninstallActivity>;
  constructor(readonly file: string, private probe: Probe, private presence: (program: InstalledProgram) => Promise<boolean>) {}
  private write(record: Record) {
    noLinks(this.file); fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.' + randomUUID() + '.tmp';
    const fd = fs.openSync(tmp, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(record)); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    try { fs.renameSync(tmp, this.file); }
    finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  }
  load() {
    if (!fs.existsSync(this.file)) return;
    try {
      noLinks(this.file);
      const stat = fs.statSync(this.file);
      if (!stat.isFile() || stat.size > 16384) throw new Error('Takip kaydı geçersiz.');
      const r = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Record;
      if (r.version !== 1 || !uuid(r.id) || typeof r.complete !== 'boolean' || !Number.isSafeInteger(r.startedAt) || r.startedAt <= 0 || r.startedAt > Date.now() + 60000 ||
        !r.program || typeof r.program.displayName !== 'string' || !r.program.displayName || r.program.displayName.length > 512 || typeof r.program.registryHive !== 'string' ||
        !['desktop', 'store', 'system'].includes(r.program.category || '') ||
        (r.program.registryKey !== undefined && (typeof r.program.registryKey !== 'string' || r.program.registryKey.length > 4096)) ||
        (r.program.packageFullName !== undefined && (typeof r.program.packageFullName !== 'string' || r.program.packageFullName.length > 512)) ||
        (r.program.category === 'store' && (typeof r.program.packageName !== 'string' || !/^[\w.-]{1,200}$/.test(r.program.packageName))) ||
        getProgramId(r.program) !== r.program.id || (r.pid !== undefined && (!Number.isInteger(r.pid) || r.pid <= 0 || r.pid > 2147483647)) ||
        (r.processToken !== undefined && (typeof r.processToken !== 'string' || !/^\d{16,19}:[^\x00-\x1f]{1,200}$/.test(r.processToken)))) throw new Error('Takip kaydı doğrulanamadı.');
      // No saved commands can ever be replayed.
      delete r.program.uninstallString; delete r.program.quietUninstallString;
      if (!r.complete) { this.record = r; this.recovered = true; }
    } catch {
      this.record = { version: 1, id: randomUUID(), startedAt: Date.now(), complete: false, program: { id: '', displayName: 'Önceki kaldırma', registryHive: 'HKCU' } };
      this.recovered = true; this.uncertain = 'Takip kaydı okunamadı. Windows işlemlerini kontrol edip açık onayla takibi kapatın.';
    }
  }
  begin(program: InstalledProgram): string {
    if (this.recovered) throw new Error('Önceki kaldırma takibi çözülmeden yeni işlem başlatılamaz.');
    if (getProgramId(program) !== program.id) throw new Error('Takip için geçerli program kimliği gerekli.');
    const record: Record = { version: 1, id: randomUUID(), startedAt: Date.now(), complete: false,
      program: { id: program.id, displayName: program.displayName, registryHive: program.registryHive, registryKey: program.registryKey,
        category: program.category, packageName: program.packageName, packageFullName: program.packageFullName } };
    this.write(record); this.record = record; this.notice = undefined;
    return record.id;
  }
  async attach(id: string, pid?: number) {
    if (!this.record || this.record.id !== id || this.record.complete || !pid) return;
    this.record.pid = pid; this.write(this.record);
    const token = await this.probe(pid);
    if (this.record?.id !== id || this.record.complete) return;
    if (token) { this.record.processToken = token; this.write(this.record); }
  }
  finish(id: string) {
    if (this.record?.id !== id) return;
    this.write({ ...this.record, complete: true });
    this.record.complete = true; this.recovered = false; this.uncertain = undefined;
  }
  get activity(): UninstallActivity {
    const r = this.record;
    return this.recovered && r ? { active: true, operationId: r.id, appId: r.program.id, appName: r.program.displayName,
      startedAt: r.startedAt, deadlineAt: r.startedAt + 600000, phase: 'recovering', awaitingResult: false,
      externalStillRunning: !this.uncertain, recoveryUncertain: Boolean(this.uncertain), recoveryError: this.uncertain }
      : { active: false, ...(this.notice ? { recoveryNotice: this.notice } : {}) };
  }
  poll(): Promise<UninstallActivity> {
    if (!this.recovered || !this.record || this.uncertain) return Promise.resolve(this.activity);
    if (this.polling) return this.polling;
    this.polling = this.check().finally(() => { this.polling = undefined; });
    return this.polling;
  }
  private async check(): Promise<UninstallActivity> {
    const r = this.record!;
    try {
      if (!r.pid || !r.processToken) throw new Error('Kaydedilen süreç kimliği eksik; çalışıp çalışmadığı güvenle doğrulanamıyor.');
      const token = await this.probe(r.pid);
      if (token === r.processToken) return this.activity;
      // A reused PID belongs to someone else. Never attach to or kill it.
      const installed = await this.presence(r.program);
      this.finish(r.id);
      this.notice = installed ? 'Önceki kaldırıcı artık çalışmıyor; program hâlâ kurulu. Listeyi yenileyin. Temizlik açılmadı.'
        : 'Önceki kaldırıcı artık çalışmıyor; kayıtlı program bulunamadı. Listeyi yenileyin. Temizlik otomatik açılmadı.';
    } catch (error) { this.uncertain = String(error).slice(0, 1000); }
    return this.activity;
  }
  acknowledge(id: string) {
    if (!this.recovered || !this.uncertain || this.record?.id !== id || this.polling) return { success: false, error: 'Bu takip açık onayla kapatılamıyor; süreç durumunu bekleyin.' };
    // Preserve the interrupted/corrupt bytes separately before replacing the record.
    noLinks(this.file);
    if (fs.existsSync(this.file)) {
      if (!fs.lstatSync(this.file).isFile()) throw new Error('Takip yolu bir dosya değil; otomatik taşınmadı.');
      fs.renameSync(this.file, this.file + '.review-' + randomUUID());
    }
    const r = this.record;
    // A corrupt placeholder has no valid identity; preserve only its review archive.
    if (!r.program.id) { this.record = undefined; this.recovered = false; this.uncertain = undefined; }
    else this.finish(id);
    this.notice = 'Önceki takip kullanıcı onayıyla kapatıldı. Windows işlemi durdurulmadı; temizlik izni verilmedi.';
    return { success: true };
  }
}
