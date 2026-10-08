import React from 'react';
import { makeErrorReport, reportRendererError } from '../utils/rendererErrors';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  declare props: { children: React.ReactNode };
  constructor(props: { children: React.ReactNode }) { super(props); }
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { reportRendererError(makeErrorReport('react', error)); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-screen bg-slate-100 dark:bg-zinc-950 text-slate-900 dark:text-white flex items-center justify-center p-6">
      <section role="alert" className="max-w-lg space-y-4">
        <h1 className="text-xl font-semibold">Arayüzde bir hata oluştu</h1>
        <p>Masaüstü modunda hata günlük dosyasına gönderilmeye çalışılır. Açık bir Windows kaldırıcısı varsa önce onun tamamlanmasını bekleyin; arayüzü yenilemek kaldırıcıyı durdurmaz.</p>
        <div className="flex gap-3">
          <button className="rounded-lg bg-sky-600 text-white px-4 py-2" onClick={() => window.location.reload()}>Arayüzü yeniden aç</button>
          {window.api && <button className="rounded-lg border px-4 py-2" onClick={() => void window.api?.openLogFolder().catch(() => {})}>Logları Aç</button>}
        </div>
      </section>
    </main>;
  }
}
