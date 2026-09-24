import { redisService } from './redis.service';

/**
 * In-process parsed copy of a JSON value a poller rewrites in Redis, so that
 * readers stop GETting and JSON.parse-ing a multi-MB blob on every request.
 *
 * The copy is dropped as soon as the poller announces an update on `channel`
 * (it publishes right after its SET), and after `maxAgeMs` regardless, so a
 * pub/sub message lost during a reconnect cannot pin stale data. Concurrent
 * misses share one GET + parse. The value is shared: callers must not mutate it.
 */
export class RedisJsonSnapshot<T> {
  private value: { data: T; loadedAt: number } | null = null;
  private loading: Promise<T | null> | null = null;
  private generation = 0;

  constructor(
    private readonly key: string,
    channel: string,
    private readonly maxAgeMs: number
  ) {
    void redisService.subscribe(channel, () => this.invalidate());
  }

  /** The parsed value, or null when the key is missing (never cached). */
  public async get(): Promise<T | null> {
    const value = this.value;
    if (value && Date.now() - value.loadedAt < this.maxAgeMs) {
      return value.data;
    }
    return this.load();
  }

  public invalidate(): void {
    this.generation += 1;
    this.value = null;
    this.loading = null;
  }

  private load(): Promise<T | null> {
    if (this.loading) {
      return this.loading;
    }
    const generation = this.generation;
    const loading = (async (): Promise<T | null> => {
      const raw = await redisService.get(this.key);
      if (!raw) {
        return null;
      }
      const data = JSON.parse(raw) as T;
      // An update announced while we were reading may postdate this value.
      if (generation === this.generation) {
        this.value = { data, loadedAt: Date.now() };
      }
      return data;
    })().finally(() => {
      if (this.loading === loading) {
        this.loading = null;
      }
    });
    this.loading = loading;
    return loading;
  }
}
