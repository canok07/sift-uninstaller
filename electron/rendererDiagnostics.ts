import type { RendererErrorReport } from '../src/types';

export function trustedRenderer(event: any, window: any, expectedURL: string): boolean {
  return Boolean(window && !window.isDestroyed() && event?.sender === window.webContents
    && event.senderFrame && event.senderFrame === window.webContents.mainFrame
    && expectedURL && event.senderFrame.url.split('#')[0] === expectedURL);
}

// Fixed event kinds, bounded output, no renderer-provided log paths or arbitrary levels.
export function validateRendererReport(input: unknown): RendererErrorReport | null {
  if (!input || typeof input !== 'object') return null;
  const report = input as RendererErrorReport;
  if (!['error', 'unhandledrejection', 'react'].includes(report.kind) || typeof report.message !== 'string'
    || report.message.length > 4000 || (report.stack !== undefined && (typeof report.stack !== 'string' || report.stack.length > 8000))) return null;
  const clean = (value: string) => value.replace(/[\r\n\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ')
    .replace(/([a-z]+:\/\/[^\s?#]+)[?#][^\s)]+/gi, '$1');
  return { kind: report.kind, message: clean(report.message), ...(report.stack ? { stack: clean(report.stack) } : {}) };
}

export function createReportLimiter(now: () => number = Date.now) {
  let start = now(), count = 0;
  return () => {
    if (now() - start >= 60000) { start = now(); count = 0; }
    return ++count <= 20;
  };
}
