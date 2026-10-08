import type { RendererErrorReport } from '../types';

export function makeErrorReport(kind: RendererErrorReport['kind'], error: unknown, fallback = 'Bilinmeyen arayüz hatası'): RendererErrorReport {
  // Do not serialize arbitrary rejection objects (they can contain user data).
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;
  return { kind, message: message.slice(0, 4000), ...(error instanceof Error && error.stack ? { stack: error.stack.slice(0, 8000) } : {}) };
}

export function reportRendererError(report: RendererErrorReport): void {
  try {
    const bridge = window.api;
    if (bridge?.reportRendererError) void bridge.reportRendererError(report).catch(() => {});
  } catch { /* A missing/broken bridge cannot recursively trigger another report. */ }
}

export function installErrorHandlers(target: Window, report = reportRendererError): () => void {
  const onError = (event: ErrorEvent) => report(makeErrorReport('error', event.error, event.message || 'Arayüz kaynağı yüklenemedi.'));
  const onRejection = (event: PromiseRejectionEvent) => report(makeErrorReport('unhandledrejection', event.reason));
  target.addEventListener('error', onError, true);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError, true);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
