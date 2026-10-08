import React, { useEffect, useRef } from 'react';
import { Clock3, X } from 'lucide-react';
import type { HistoryEntry } from '../utils/operationHistory';

const labels = { success: 'Başarılı', error: 'Hata', warning: 'Uyarı', cancelled: 'İptal' };
export function OperationHistoryModal({ entries, issue, onClose }: {
  entries: HistoryEntry[]; issue?: string; onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const buttons = panel.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]');
        if (!buttons?.length) { event.preventDefault(); return; }
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="operation-history-title"
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#16181C] shadow-2xl outline-none">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-200 dark:border-zinc-800">
          <h2 id="operation-history-title" className="font-semibold flex items-center gap-2"><Clock3 className="w-5 h-5 text-sky-500" /> İşlem Geçmişi</h2>
          <button type="button" onClick={onClose} aria-label="İşlem geçmişini kapat" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3">
          <p className="text-xs text-slate-500 dark:text-zinc-400">Son 100 sonuç bu cihazda saklanır. Program adları ve yerel yollar içerebilir. Ayrıntılı dosya günlüğü için Ayarlar → Logları Aç.</p>
          {issue && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{issue}</p>}
          {entries.length === 0 && <p className="py-8 text-center text-slate-500 dark:text-zinc-400">Henüz kayıtlı işlem yok.</p>}
          {entries.map(entry => (
            <article key={entry.id} className="p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <h3 className="font-semibold">{entry.operation}{entry.appName ? ` · ${entry.appName}` : ''}</h3>
                <span className={entry.status === 'error' ? 'text-rose-600 dark:text-rose-400' : entry.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}>{labels[entry.status]}{entry.demo ? ' · Demo' : ''}</span>
              </div>
              <time dateTime={entry.timestamp} className="text-xs text-slate-500 dark:text-zinc-400">{new Date(entry.timestamp).toLocaleString('tr-TR')}</time>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-zinc-200">{entry.message}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
