import { randomUUID } from 'node:crypto';
import type { UninstallActivity, UninstallResult } from '../src/types';

export const UNINSTALL_TIMEOUT_MS = 10 * 60 * 1000;
type Child = { pid?: number; once(event: string, callback: (...args: any[]) => void): unknown };
type Identity = { appId: string; appName: string };
type Clock = { now(): number; setTimer(callback: () => void, ms: number): any; clearTimer(timer: any): void };
const clock: Clock = { now: Date.now, setTimer: setTimeout, clearTimer: clearTimeout };
type Task = Identity & {
  operationId: string; startedAt: number; deadlineAt: number; phase: 'running' | 'verifying';
  childPending: boolean; workerPending: boolean; settled: boolean;
  stopReason?: 'cancelled' | 'timedOut'; timer?: any; reply(result: UninstallResult): void;
};

// Cancellation is logical, never a process kill. Keep the gate until the owned
// launcher/PowerShell and any in-flight verification have actually finished.
export class UninstallTask {
  private task?: Task;
  constructor(private timing: Clock = clock, private timeoutMs = UNINSTALL_TIMEOUT_MS,
    private onDrained: (activity: UninstallActivity) => void = () => {}) {}

  get activity(): UninstallActivity {
    const task = this.task;
    return task ? { active: true, operationId: task.operationId, appId: task.appId, appName: task.appName,
      startedAt: task.startedAt, deadlineAt: task.deadlineAt, phase: task.phase,
      awaitingResult: !task.settled, externalStillRunning: task.childPending, stopReason: task.stopReason } : { active: false };
  }

  cancel(operationId: string): { success: boolean; error?: string } {
    if (!this.task || this.task.operationId !== operationId || this.task.settled) {
      return { success: false, error: 'Bu bekleme işlemi artık geçerli değil.' };
    }
    this.stop(this.task, 'cancelled');
    return { success: true };
  }

  private settle(task: Task, result: UninstallResult) {
    if (task.settled) return;
    task.settled = true;
    this.timing.clearTimer(task.timer);
    task.reply({ ...result, operationId: task.operationId });
  }

  private stop(task: Task, reason: 'cancelled' | 'timedOut') {
    if (this.task !== task || task.settled) return;
    task.stopReason = reason;
    this.settle(task, { success: false, verified: false, [reason]: true,
      externalStillRunning: task.childPending, backgroundPending: task.childPending || task.workerPending,
      message: (reason === 'timedOut' ? '10 dakikalık bekleme sınırı aşıldı.' : 'Sift beklemesi iptal edildi.') +
        ' Windows kaldırıcısı zorla durdurulmadı. Program listede tutuldu; temizlik izni verilmedi.' });
  }

  private drain(task: Task) {
    if (task.childPending || task.workerPending || this.task !== task) return;
    const activity = this.activity;
    this.task = undefined;
    if (task.stopReason) this.onDrained(activity);
  }

  run(identity: Identity, launch: () => Child,
    verify: (exitCode: number, stopped: () => boolean) => Promise<UninstallResult>): Promise<UninstallResult> {
    if (this.task) return Promise.resolve({ success: false, verified: false, error: 'Önceki kaldırıcı veya doğrulama hâlâ takip ediliyor.' });
    let reply!: (result: UninstallResult) => void;
    const result = new Promise<UninstallResult>(resolve => { reply = resolve; });
    const task: Task = { ...identity, operationId: randomUUID(), startedAt: this.timing.now(),
      deadlineAt: this.timing.now() + this.timeoutMs, phase: 'running', childPending: false,
      workerPending: true, settled: false, reply };
    this.task = task;
    task.timer = this.timing.setTimer(() => this.stop(task, 'timedOut'), this.timeoutMs);
    task.timer?.unref?.();
    void (async () => {
      try {
        const child = launch();
        task.childPending = true;
        const exit = await new Promise<{ code: number | null; error?: string }>(resolve => {
          child.once('error', (error: Error) => {
            // A spawn failure without a PID cannot have a running child. An
            // error on an existing child is not proof that it has stopped.
            task.childPending = Boolean(child.pid);
            resolve({ code: null, error: error.message });
            this.drain(task);
          });
          child.once('close', (code: number | null) => {
            task.childPending = false;
            resolve({ code });
            this.drain(task);
          });
        });
        if (task.stopReason) return;
        if (exit.error || (exit.code !== 0 && exit.code !== 3010)) {
          this.settle(task, { success: false, verified: false, exitCode: exit.code,
            error: exit.error || `Kaldırıcı hatayla sonlandı (çıkış kodu: ${exit.code ?? 'bilinmiyor'}).` });
          return;
        }
        task.phase = 'verifying';
        const verified = await verify(exit.code, () => Boolean(task.stopReason));
        if (!task.stopReason) this.settle(task, verified);
      } catch (error) {
        if (!task.stopReason) this.settle(task, { success: false, verified: false,
          error: error instanceof Error ? error.message : String(error) });
      } finally {
        task.workerPending = false;
        this.drain(task);
      }
    })();
    return result;
  }
}
