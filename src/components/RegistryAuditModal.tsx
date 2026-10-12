import React, { useEffect, useRef, useState } from 'react';
import { ListChecks, Loader2, RotateCw, X } from 'lucide-react';
import type { RegistryAuditResult } from '../types';
import { makeErrorReport, reportRendererError } from '../utils/rendererErrors';

export function RegistryAuditReport({ result }: { result: RegistryAuditResult }) {
  return <div className="space-y-3">
    {result.error && <p role="alert" className="text-rose-600 dark:text-rose-400">{result.error}</p>}
    {result.partial && <p role="alert" className="text-amber-700 dark:text-amber-300">Kontrol eksik: erişilemeyen veya incelenmeyen öğeler var. Bu rapor tam doğrulama değildir.</p>}
    <p className="text-sm">{result.checkedCount} / {result.registryCount} kayıt incelendi · {result.findings.length} bulgu · {result.skippedSystemCount} sistem kaydının komutu değerlendirilmedi.</p>
    <p className="text-xs text-slate-500 dark:text-zinc-400">Kontrol zamanı: {new Date(result.scannedAt).toLocaleString('tr-TR')}</p>
    <div className="flex flex-wrap gap-2 text-xs">{result.sources.map(source => <span key={source.id} className="rounded border border-slate-200 dark:border-zinc-700 px-2 py-1">
      {source.id}: {source.status === 'error' ? 'Okunamadı' : source.status === 'missing' ? 'Kaynak yok' : `${source.count} kayıt`}
    </span>)}</div>
    {result.warnings.map((warning, index) => <p key={index} className="text-xs text-amber-700 dark:text-amber-300 break-words">{warning}</p>)}
    {result.success && result.findings.length === 0 && <p className="rounded-xl bg-slate-50 dark:bg-zinc-900 p-4 text-sm">İncelenen kayıtlarda bu kontroller kapsamında bulgu yok. Bu, tüm kayıt defterinin hatasız olduğunu kanıtlamaz.</p>}
    {result.findings.map(finding => <article key={finding.id} className="rounded-xl border border-slate-200 dark:border-zinc-700 p-4 space-y-2">
      <h3 className="text-sm font-semibold break-words">{finding.appName} <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">· {finding.hive}</span></h3>
      <p className="text-sm text-slate-700 dark:text-zinc-200">{finding.message}</p>
      <p className="break-all text-xs font-mono text-slate-500 dark:text-zinc-400">{finding.registryKey}</p>
    </article>)}
  </div>;
}

export function RegistryAuditModal({ onClose, onBusy, onComplete }: {
  onClose: () => void; onBusy: (busy: boolean) => void; onComplete: (result: RegistryAuditResult) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<RegistryAuditResult>();
  const [error, setError] = useState<string>();
  const panel = useRef<HTMLDivElement>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const close = useRef(onClose); close.current = onClose;
  const desktop = Boolean(window.api?.isElectron && window.api.inspectRegistry);
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !running.current) { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
      if (!controls?.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { mounted.current = false; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  const inspect = async () => {
    if (running.current || !desktop) return;
    running.current = true; setChecking(true); setError(undefined); setResult(undefined); onBusy(true);
    try {
      const report = await window.api!.inspectRegistry();
      if (mounted.current) { setResult(report); onComplete(report); }
    } catch (failure) {
      reportRendererError(makeErrorReport('error', failure, 'Kayıt defteri kontrolü alınamadı.'));
      if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      running.current = false; onBusy(false);
      if (mounted.current) setChecking(false);
    }
  };
  return <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="registry-audit-title"
      className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#16181C] shadow-2xl outline-none">
      <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-200 dark:border-zinc-800">
        <h2 id="registry-audit-title" className="font-semibold flex items-center gap-2"><ListChecks className="w-5 h-5 text-sky-500" /> Kayıt Defteri Kontrolü</h2>
        <button type="button" disabled={checking} onClick={onClose} aria-label="Kayıt defteri kontrolünü kapat" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5 overflow-y-auto space-y-4">
        <p className="text-sm text-slate-600 dark:text-zinc-300">Salt okunur kontrol: yalnızca HKLM, WOW6432Node ve mevcut kullanıcının HKCU program kaldırma kayıtları incelenir. Store kayıtları ve sistem bileşenlerinin kaldırma komutları kapsam dışıdır.</p>
        <p className="text-xs text-amber-700 dark:text-amber-300">Hiçbir kayıt silinmez, değiştirilmez veya kaldırıcı çalıştırılmaz. Benzer kayıtlar ve eksik dosyalar, gereksiz kayıt kanıtı değildir.</p>
        {!desktop && <p role="alert" className="text-sm">Gerçek kontrol yalnızca Windows masaüstü uygulamasında kullanılabilir. Tarayıcı demosu bilgisayarınızın kayıt defterini okuyamaz.</p>}
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        {checking && <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Kayıtlar okunuyor ve kaldırıcı dosyaları kontrol ediliyor…</p>}
        {result && <RegistryAuditReport result={result} />}
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
        <button type="button" disabled={checking} onClick={onClose} className="rounded-lg px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40">Kapat</button>
        <button type="button" disabled={checking || !desktop} onClick={() => void inspect()} className="flex items-center gap-2 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm disabled:opacity-40"><RotateCw className="w-4 h-4" /> {result ? 'Yeniden Kontrol Et' : 'Kontrolü Başlat'}</button>
      </div>
    </div>
  </div>;
}
