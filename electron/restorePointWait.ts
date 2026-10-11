import type { RestorePointResult } from '../src/types';
import { RESTORE_POINT_WAIT_MS } from '../src/operationLimits';

/** Stop waiting without killing PowerShell/System Restore or retrying a pending job. */
export class RestorePointWait {
  private pending: Promise<RestorePointResult> | null = null;
  constructor(private readonly waitMs = RESTORE_POINT_WAIT_MS) {}

  async run(work: () => Promise<RestorePointResult>): Promise<RestorePointResult> {
    if (this.pending) return {
      success: false, supported: true, backgroundPending: true,
      error: 'Önceki geri yükleme isteği hâlâ sonuçlanmadı. Yeni istek başlatılmadı; geri yükleme noktası hazır kabul edilemez.'
    };
    const task = Promise.resolve().then(work).catch((error: unknown): RestorePointResult => ({
      success: false, supported: false, error: error instanceof Error ? error.message : String(error)
    }));
    this.pending = task;
    // Both outcomes are consumed even if the UI deadline has already elapsed.
    void task.then(() => { if (this.pending === task) this.pending = null; });
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve({
        success: false, supported: true, timedOut: true, backgroundPending: true,
        error: `${Math.ceil(this.waitMs / 1000)} saniye içinde geri yükleme sonucu alınamadı. Windows işlemi zorla durdurulmadı; arka planda sürebilir. Geri yükleme noktası hazır kabul edilemez.`
      }), this.waitMs);
      void task.then(result => { clearTimeout(timer); resolve(result); });
    });
  }
}
