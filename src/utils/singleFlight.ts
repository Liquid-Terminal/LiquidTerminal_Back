/**
 * Collapses concurrent calls for the same key into one execution: while a
 * `compute` for a key is running, later callers get its promise instead of
 * starting their own. Nothing is kept once it settles — this deduplicates
 * work in flight, it is not a cache.
 */
export class SingleFlight {
  private readonly inflight = new Map<string, Promise<unknown>>();

  run<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const pending = this.inflight.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
    const promise = compute().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }
}
