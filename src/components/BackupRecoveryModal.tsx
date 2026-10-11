import React, { useEffect, useRef, useState } from 'react';
import type { BackupEntry, BackupListResult } from '../types';
import { selectBackupEntries } from '../utils/backupSelection';
const labels: Record<BackupEntry['state'], string> = { prepared: 'Hazırlanmış / kesinti olası', 'backed-up': 'Yedek hazır / kesinti olası', completed: 'Temizlik tamamlandı', failed: 'Hata / kısmi işlem olası', restoring: 'Geri alma kesintiye uğramış olabilir', restored: 'Geri alındı' };
export function formatBackupSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Boyut doğrulanamadı';
  if (bytes < 1024) return Math.round(bytes).toLocaleString('tr-TR') + ' B';
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(2) + ' MB';
  return (bytes / 1024 ** 3).toFixed(2) + ' GB';
}

export function BackupRecoveryModal({ onClose, onResult, initialBackupIds = [] }: {
  onClose(): void; onResult(success: boolean, message: string, app: string, action: 'restore' | 'delete'): void;
  initialBackupIds?: string[];
}) {
  const [list, setList] = useState<BackupListResult>({ success: true, entries: [], warnings: [] });
  const [focusIds, setFocusIds] = useState(initialBackupIds);
  const visibleEntries = selectBackupEntries(list.entries, focusIds);
  const missingIds = focusIds.filter(id => !list.entries.some(entry => entry.id === id));
  const [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState<BackupEntry | null>(null);
  const [action, setAction] = useState<'restore' | 'delete'>('restore');
  const [message, setMessage] = useState(''), [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reload = async () => {
    setBusy(true);
    try {
      if (!window.api?.listBackups) throw new Error('Geri alma yalnızca masaüstü uygulamasında kullanılabilir.');
      setList(await window.api.listBackups());
    } catch (error) { setList({ success: false, entries: [], warnings: [], error: String(error) }); }
    finally { setBusy(false); setLoaded(true); }
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { if (confirmation) setConfirmation(null); else onClose(); }
      if (event.key === 'Tab') {
        const buttons: HTMLButtonElement[] = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [busy, confirmation, onClose]);
  const restore = async () => {
    if (!confirmation || !window.api) return;
    setBusy(true);
    try {
      const result = action === 'delete'
        ? await window.api.deleteBackup(confirmation.id, confirmation.deleteToken || '')
        : await window.api.restoreBackup(confirmation.id);
      const text = result.message || result.error || 'Geri alma başarısız.';
      setMessage(text); onResult(result.success, text, confirmation.appName, action);
    } catch (error) { setMessage(String(error)); onResult(false, String(error), confirmation.appName, action); }
    finally { setConfirmation(null); await reload(); }
  };
  return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="backup-title" className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-800 shadow-2xl p-5 gap-4">
      <div className="flex items-center justify-between gap-4"><h2 id="backup-title" className="font-bold">Temizlik Yedeklerini Geri Al</h2><button disabled={busy} onClick={onClose} className="border rounded-lg px-3 py-2 text-sm">Kapat</button></div>
      <p className="text-xs text-slate-500 dark:text-zinc-400">Yalnızca temizlenen veriyi özgün konuma geri getirir; programı yeniden kurmaz. Mevcut hedef veya yeniden kurulu program varsa geri alma engellenir. Yedekler otomatik silinmez. Kısmi geri almada oluşan veri de korunur; yeniden denemek yerine kayıtları inceleyin.</p>
      {focusIds.length > 0 && <div className="flex items-center justify-between gap-3 text-xs"><p>Yalnızca seçilen temizlik işleminin yedekleri gösteriliyor. Geri alma için ayrıca onay gerekir.</p><button disabled={busy || Boolean(confirmation)} onClick={() => setFocusIds([])} className="shrink-0 border rounded-lg px-3 py-2">Tüm Yedekleri Göster</button></div>}
      {loaded && list.success && missingIds.length > 0 && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">Bu işleme ait {missingIds.length} yedek mevcut listede bulunamadı. Silinmiş, okunamıyor veya son 200 kayıt dışında olabilir; başka bir programın yedeği yerine seçilmedi.</p>}
      {loaded && <p className="text-xs">Gösterilen yedeklerin bilinen toplam boyutu: {formatBackupSize(visibleEntries.reduce((sum, entry) => sum + (entry.sizeBytes || 0), 0))}. Boyutu okunamayan yedekler toplama dahil değildir.</p>}
      {list.error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{list.error}</p>}
      {list.warnings.map((warning, index) => <p key={index} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>)}
      {message && <p role="status" className="text-sm break-words">{message}</p>}
      {confirmation ? <div className="space-y-3 border rounded-xl p-4">
        <h3 className="font-semibold">{action === 'delete' ? 'Bu yedek kalıcı silinsin mi?' : 'Bu yedek geri alınsın mı?'}</h3><p className="text-sm">{confirmation.appName}</p><p className="text-xs break-all">{confirmation.originalPath}</p>
        <p className="text-xs text-amber-700 dark:text-amber-300">{action === 'delete' ? 'Bu işlem geri alınamaz: yalnızca seçilen yedek kopyası silinir. Özgün/geri alınmış veriye dokunulmaz. Bu yedekten tekrar geri alma yapılamaz.' : 'Registry geri alma Windows kayıtlarını değiştirir. Eski sürüm/kısmi yedeklerde uyumluluk garantisi yoktur. Hedef boş değilse üzerine yazılmaz.'}</p>
        <div className="flex gap-3"><button disabled={busy} onClick={() => setConfirmation(null)} className="border rounded-lg px-3 py-2 text-sm">Vazgeç</button><button disabled={busy} onClick={() => void restore()} className="bg-sky-600 text-white rounded-lg px-3 py-2 text-sm">{busy ? 'İşleniyor…' : action === 'delete' ? 'Onayla ve Yedeği Kalıcı Sil' : 'Onayla ve Geri Al'}</button></div>
      </div> : <div className="overflow-auto space-y-3 min-h-0">
        {loaded && list.success && !visibleEntries.length && <p className="text-sm text-slate-500">{focusIds.length ? 'Bu işlemin gösterilebilir yedeği yok.' : 'Henüz bu biçimde temizlik yedeği yok.'}</p>}
        {visibleEntries.map(entry => <article key={entry.id} className="border border-slate-200 dark:border-zinc-700 rounded-xl p-3 space-y-1">
          <div className="flex justify-between gap-3"><strong className="text-sm">{entry.appName}</strong><div className="flex gap-2"><button disabled={busy || !entry.available} onClick={() => { setAction('restore'); setConfirmation(entry); }} className="text-xs rounded-lg border px-3 py-2 disabled:opacity-40">Geri Al</button><button disabled={busy || !entry.deleteToken || !['completed', 'restored'].includes(entry.state)} onClick={() => { setAction('delete'); setConfirmation(entry); }} className="text-xs rounded-lg border border-rose-300 text-rose-700 dark:text-rose-300 px-3 py-2 disabled:opacity-40">Yedeği Sil</button></div></div>
          <p className="text-xs break-all">{entry.originalPath}</p><p className="text-xs text-slate-500 dark:text-zinc-400">{new Date(entry.createdAt).toLocaleString('tr-TR')} · {labels[entry.state]}</p>
          <p className="text-xs">{entry.sizeBytes === undefined ? 'Boyut doğrulanamadı' : formatBackupSize(entry.sizeBytes)} · Kesintili/hatalı yedekler otomatik veya bu ekrandan silinmez.</p>
          {entry.error && <p className="text-xs text-rose-600 dark:text-rose-400 break-words">{entry.error}</p>}
        </article>)}
      </div>}
      <button disabled={busy || Boolean(confirmation)} onClick={() => void reload()} className="self-start border rounded-lg px-3 py-2 text-sm">{busy ? 'Bekleyin…' : 'Yedekleri Yenile'}</button>
    </div>
  </div>;
}
