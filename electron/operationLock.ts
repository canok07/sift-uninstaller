export class OperationLock {
  private operation: string | null = null;
  get active(): string | null { return this.operation; }

  acquire(operation: string): (() => void) | null {
    if (this.operation !== null) return null;
    this.operation = operation;
    let released = false;
    return () => {
      if (!released) { released = true; this.operation = null; }
    };
  }
}
