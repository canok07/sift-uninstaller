export const HISTORY_KEY = 'sift_operation_history';
export const HISTORY_LIMIT = 100;
export type HistoryStatus = 'success' | 'error' | 'warning' | 'cancelled';
export interface HistoryEntry {
  id: string;
  timestamp: string;
  operation: string;
  appName?: string;
  status: HistoryStatus;
  message: string;
  demo: boolean;
}
export type HistoryInput = Omit<HistoryEntry, 'id' | 'timestamp'>;
type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>;

function validEntry(value: any): value is HistoryEntry {
  return value && typeof value.id === 'string' && value.id.length <= 100 &&
    typeof value.timestamp === 'string' && Number.isFinite(Date.parse(value.timestamp)) &&
    typeof value.operation === 'string' && value.operation.length <= 100 &&
    (value.appName === undefined || (typeof value.appName === 'string' && value.appName.length <= 300)) &&
    ['success', 'error', 'warning', 'cancelled'].includes(value.status) &&
    typeof value.message === 'string' && value.message.length <= 8000 && typeof value.demo === 'boolean';
}
export function readHistory(storage?: Pick<HistoryStorage, 'getItem'>): { entries: HistoryEntry[]; issue?: string } {
  try {
    if (!storage) throw new Error('Storage unavailable');
    const text = storage.getItem(HISTORY_KEY);
    if (text === null) return { entries: [] };
    if (text.length > 1000000) throw new Error('History too large');
    const saved = JSON.parse(text);
    if (saved?.version !== 1 || !Array.isArray(saved.entries) || !saved.entries.every(validEntry)) {
      throw new Error('Invalid history');
    }
    return { entries: saved.entries.slice(0, HISTORY_LIMIT).map((entry: HistoryEntry) => ({
      id: entry.id, timestamp: entry.timestamp, operation: entry.operation, appName: entry.appName,
      status: entry.status, message: entry.message, demo: entry.demo
    })) };
  } catch {
    return { entries: [], issue: 'İşlem geçmişi okunamadı. Yerel depolama kapalı veya kayıt bozuk olabilir.' };
  }
}
export function appendHistory(entries: HistoryEntry[], input: HistoryInput,
  storage?: Pick<HistoryStorage, 'setItem'>): { entries: HistoryEntry[]; issue?: string } {
  const entry: HistoryEntry = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(), operation: input.operation.slice(0, 100),
    appName: input.appName?.slice(0, 300), status: input.status,
    message: input.message.length > 8000 ? input.message.slice(0, 7970) + '\n[Ayrıntı kısaltıldı.]' : input.message,
    demo: input.demo
  };
  const next = [entry, ...entries].slice(0, HISTORY_LIMIT);
  try {
    if (!storage) throw new Error('Storage unavailable');
    storage.setItem(HISTORY_KEY, JSON.stringify({ version: 1, entries: next }));
    return { entries: next };
  } catch {
    return { entries: next, issue: 'Geçmiş kaydedilemedi; yeni kayıtlar yalnızca bu oturumda tutuluyor.' };
  }
}
