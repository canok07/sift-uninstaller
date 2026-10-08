import React from 'react';
import type { InventorySource } from '../types';

export function InventoryStatus({ sources, warnings }: { sources: InventorySource[]; warnings: string[] }) {
  const failed = sources.filter(source => source.status === 'error');
  if (!sources.length && !warnings.length) return null;
  return <aside aria-label="Tarama kaynakları" className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-xs text-slate-700 dark:text-zinc-300">
    {failed.length > 0 && <p role="alert" className="text-amber-700 dark:text-amber-400 font-semibold mb-2">Tarama eksik kaldı. Aşağıdaki kaynaklar okunamadı; görünen liste tüm kurulu uygulamaları içermeyebilir.</p>}
    <ul className="flex flex-wrap gap-x-5 gap-y-2">
      {sources.map(source => <li key={source.id}><strong>{source.id === 'APPX' ? 'Store / AppX' : source.id}</strong>: {source.status === 'ok' ? `${source.count} kayıt` : source.status === 'missing' ? 'Kaynak bulunamadı (0 kayıt)' : 'Okunamadı'}{source.error && <span className="block text-amber-700 dark:text-amber-400 break-words">{source.error}</span>}</li>)}
    </ul>
    {warnings.length > 0 && <details className="mt-2"><summary className="cursor-pointer">{warnings.length} ad/simge bilgisi uyarısı — kayıtlar teknik adla gösterilebilir</summary><ul className="mt-2 space-y-1 break-words">{warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
  </aside>;
}
