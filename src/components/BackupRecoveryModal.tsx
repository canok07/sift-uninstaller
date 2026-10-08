import React, { useEffect, useRef, useState } from 'react';
import type { BackupEntry, BackupListResult } from '../types';
const labels: Record<BackupEntry['state'], string> = { prepared: 'Hazırlanmış / kesinti olası', 'backed-up': 'Yedek hazır / kesinti olası', completed: 'Temizlik tamamlandı', failed: 'Hata / kısmi işlem olası', restoring: 'Geri alma kesintiye uğramış olabilir', restored: 'Geri alındı' };

export function BackupRecoveryModal({ onClose, onResult }: { onClose(): void; onResult(success: boolean, message: string, app: string): void }) {
  const [list, setList] = useState<BackupListResult>({ success: true, entries: [], warnings: [] });
  const [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState<BackupEntry | null>(null);
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
      const result = await window.api.restoreBackup(confirmation.id);
      const text = result.message || result.error || 'Geri alma başarısız.';
      setMessage(text); onResult(result.success, text, confirmation.appName);
    } catch (error) { setMessage(String(error)); onResult(false, String(error), confirmation.appName); }
    finally { setConfirmation(null); await reload(); }
  };
  return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="backup-title" className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-800 shadow-2xl p-5 gap-4">
      <div className="flex items-center justify-between gap-4"><h2 id="backup-title" className="font-bold">Temizlik Yedeklerini Geri Al</h2><button disabled={busy} onClick={onClose} className="border rounded-lg px-3 py-2 text-sm">Kapat</button></div>
      <p className="text-xs text-slate-500 dark:text-zinc-400">Yalnızca temizlenen veriyi özgün konuma geri getirir; programı yeniden kurmaz. Mevcut hedef veya yeniden kurulu program varsa geri alma engellenir. Yedekler otomatik silinmez. Kısmi geri almada oluşan veri de korunur; yeniden denemek yerine kayıtları inceleyin.</p>
      {list.error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{list.error}</p>}
      {list.warnings.map((warning, index) => <p key={index} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>)}
      {message && <p role="status" className="text-sm break-words">{message}</p>}
      {confirmation ? <div className="space-y-3 border rounded-xl p-4">
        <h3 className="font-semibold">Bu yedek geri alınsın mı?</h3><p className="text-sm">{confirmation.appName}</p><p className="text-xs break-all">{confirmation.originalPath}</p>
        <p className="text-xs text-amber-700 dark:text-amber-300">Registry geri alma Windows kayıtlarını değiştirir. Eski sürüm/kısmi yedeklerde uyumluluk garantisi yoktur. Hedef boş değilse üzerine yazılmaz.</p>
        <div className="flex gap-3"><button disabled={busy} onClick={() => setConfirmation(null)} className="border rounded-lg px-3 py-2 text-sm">Vazgeç</button><button disabled={busy} onClick={() => void restore()} className="bg-sky-600 text-white rounded-lg px-3 py-2 text-sm">{busy ? 'Geri Alınıyor…' : 'Onayla ve Geri Al'}</button></div>
      </div> : <div className="overflow-auto space-y-3 min-h-0">
        {loaded && list.success && !list.entries.length && <p className="text-sm text-slate-500">Henüz bu biçimde temizlik yedeği yok.</p>}
        {list.entries.map(entry => <article key={entry.id} className="border border-slate-200 dark:border-zinc-700 rounded-xl p-3 space-y-1">
          <div className="flex justify-between gap-3"><strong className="text-sm">{entry.appName}</strong><button disabled={busy || !entry.available} onClick={() => setConfirmation(entry)} className="text-xs rounded-lg border px-3 py-2 disabled:opacity-40">Geri Al</button></div>
          <p className="text-xs break-all">{entry.originalPath}</p><p className="text-xs text-slate-500 dark:text-zinc-400">{new Date(entry.createdAt).toLocaleString('tr-TR')} · {labels[entry.state]}</p>
          {entry.error && <p className="text-xs text-rose-600 dark:text-rose-400 break-words">{entry.error}</p>}
        </article>)}
      </div>}
      <button disabled={busy || Boolean(confirmation)} onClick={() => void reload()} className="self-start border rounded-lg px-3 py-2 text-sm">{busy ? 'Bekleyin…' : 'Yedekleri Yenile'}</button>
    </div>
  </div>;
}
