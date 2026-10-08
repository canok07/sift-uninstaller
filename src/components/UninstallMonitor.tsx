import React, { useEffect, useRef, useState } from 'react';
import type { UninstallActivity } from '../types';

type Active = Extract<UninstallActivity, { active: true }>;
export function UninstallMonitor({ activity, onStopWait }: { activity: UninstallActivity; onStopWait(activity: Active): void }) {
  if (!activity.active) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - activity.startedAt) / 60000));
  return <aside aria-label="Kaldırıcı takibi" className="border-b border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-4 py-3 text-xs flex items-center justify-between gap-4">
    <div className="space-y-1 min-w-0">
      <p className="font-semibold break-words">{activity.appName} — {activity.awaitingResult ? activity.phase === 'running' ? 'Kaldırıcı bekleniyor' : 'Kaldırma doğrulanıyor' : 'Bekleme bırakıldı; takip sürüyor'} ({minutes} dk)</p>
      <p>{activity.awaitingResult ? 'Bekleme sınırı 10 dakika. İptal etmek için öncelikle Windows kaldırma penceresini kullanın.'
        : activity.externalStillRunning ? 'Windows kaldırıcısı zorla durdurulmadı. Takip edilen işlem kapanana kadar yeni kaldırma, yenileme ve temizlik engellendi.'
        : 'Devam eden doğrulama sorgusunun bitmesi bekleniyor. Program listede kaldı; temizlik açılmadı.'}</p>
    </div>
    {activity.awaitingResult && <button type="button" onClick={() => onStopWait(activity)} className="shrink-0 rounded-lg border border-amber-300 dark:border-amber-800 px-3 py-2 font-semibold">Beklemeyi Bırak</button>}
  </aside>;
}

export function CancelWaitModal({ activity, onClose, onConfirm }: { activity: Active; onClose(): void; onConfirm(): Promise<{ success: boolean; error?: string }> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [pending, onClose]);
  const confirm = async () => {
    setPending(true);
    try {
      const result = await onConfirm();
      if (result.success) onClose(); else setError(result.error || 'Bekleme sonlandırılamadı.');
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setPending(false); }
  };
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="cancel-wait-title" className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-white p-6 space-y-4 border border-slate-200 dark:border-zinc-800">
      <h2 id="cancel-wait-title" className="font-semibold text-lg">Sift beklemesi bırakılsın mı?</h2>
      <p className="text-sm break-words">{activity.appName}</p>
      <p className="text-sm text-amber-700 dark:text-amber-300">Bu, Windows kaldırma işlemini durdurmaz veya geri almaz. Program listede kalır ve temizlik açılmaz. Takip edilen işlem bitene kadar yeni işlemler engellenir. Kaldırmayı iptal etmek için Windows kaldırıcısındaki İptal düğmesini kullanın.</p>
      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 break-words">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" disabled={pending} onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Beklemeye Devam Et</button>
        <button type="button" disabled={pending} onClick={() => void confirm()} className="rounded-lg bg-amber-600 text-white px-3 py-2 text-sm disabled:opacity-50">{pending ? 'Gönderiliyor…' : 'Sift Beklemesini Bırak'}</button>
      </div>
    </div>
  </div>;
}
