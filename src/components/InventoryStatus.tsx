import React from 'react';
import type { InventorySource } from '../types';

export function InventoryStatus({ sources, warnings, listedCounts, stale = false, compact = false }: {
  sources: InventorySource[]; warnings: string[];
  listedCounts?: Record<InventorySource['id'], number>; stale?: boolean; compact?: boolean;
}) {
  const failed = sources.filter(source => source.status === 'error');
  if (!sources.length && !warnings.length) return null;
  return <aside aria-label="Tarama kaynakları" className={compact ? 'relative min-w-0 text-[11px] text-slate-700 dark:text-zinc-300' : 'shrink-0 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300'}>
    {failed.length > 0 && <p role="alert" className="text-amber-700 dark:text-amber-400 font-semibold mb-2">Tarama eksik kaldı. Aşağıdaki kaynaklar okunamadı; görünen liste tüm kurulu uygulamaları içermeyebilir.</p>}
    <details className="relative">
      <summary className={compact ? 'cursor-pointer font-medium rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-sky-500' : 'cursor-pointer font-medium'}>Tarama kaynakları{listedCounts && ` · Listede ${Object.values(listedCounts).reduce((sum, count) => sum + count, 0)} kayıt`}{stale && ' · Kaldırma sonrası liste güncellendi'}{warnings.length > 0 && ` · ${warnings.length} bilgi uyarısı`}</summary>
      <div className={compact ? 'absolute right-0 top-full z-30 mt-2 w-[min(34rem,calc(100vw-2rem))] max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs shadow-xl' : undefined}>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">Liste sayıları tüm sekmelerdeki mevcut kayıtları kapsar; arama sonucuyla aynı olmak zorunda değildir. Son tarama sayıları ayrı bir anlık görüntüdür{stale ? '; tam kaynak taraması kaldırma sonrası henüz yenilenmedi.' : '.'}</p>
    <ul className="flex flex-wrap gap-x-5 gap-y-2">
      {sources.map(source => <li key={source.id}><strong>{source.id === 'APPX' ? 'Store / AppX' : source.id}</strong>: {listedCounts && <span>Listede {listedCounts[source.id]} · </span>}{source.status === 'ok' ? `Son tarama: ${source.count} kayıt` : source.status === 'missing' ? 'Kaynak bulunamadı (0 kayıt)' : 'Okunamadı'}{source.error && <span className="block text-amber-700 dark:text-amber-400 break-words">{source.error}</span>}</li>)}
    </ul>
    {warnings.length > 0 && <details className="mt-2"><summary className="cursor-pointer">{warnings.length} ad/simge bilgisi uyarısı — kayıtlar teknik adla gösterilebilir</summary><ul className="mt-2 space-y-1 break-words">{warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
      </div>
    </details>
  </aside>;
}
