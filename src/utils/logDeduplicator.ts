import logger from './logger';

/**
 * Classe utilitaire pour la déduplication des logs
 * Permet d'éviter les logs répétés dans un intervalle de temps défini
 */
export class LogDeduplicator {
  // Instance singleton
  private static instance: LogDeduplicator;
  
  /**
   * Last emission time per key. Keys embed the JSON metadata (timestamps, URLs,
   * stacks), so their space is unbounded: before this was pruned it grew for
   * the life of the process (~200 MB/day in production) until GC thrash froze
   * the API. An entry older than LOG_THROTTLE_MS can no longer suppress
   * anything, so pruning it changes no logging behaviour.
   */
  private lastLogTimestamp = new Map<string, number>();

  // Intervalle de temps en millisecondes pour la déduplication
  private readonly LOG_THROTTLE_MS = 1000;

  /** How often expired keys are swept. */
  private readonly PRUNE_INTERVAL_MS = 10_000;

  /** Hard ceiling between sweeps, in case a burst of unique keys lands at once. */
  private readonly MAX_KEYS = 50_000;

  /**
   * Constructeur privé pour empêcher l'instanciation directe
   */
  private constructor() {
    // unref: the sweep must never keep the process (or a test run) alive.
    setInterval(() => this.prune(), this.PRUNE_INTERVAL_MS).unref();
  }

  /** Drops every key whose throttle window has elapsed. */
  private prune(now: number = Date.now()): void {
    for (const [key, ts] of this.lastLogTimestamp) {
      if (now - ts > this.LOG_THROTTLE_MS) this.lastLogTimestamp.delete(key);
    }
  }

  /** Number of keys currently held (exposed for health checks and tests). */
  public size(): number {
    return this.lastLogTimestamp.size;
  }

  /**
   * Récupère l'instance singleton du déduplicateur de logs
   */
  public static getInstance(): LogDeduplicator {
    if (!LogDeduplicator.instance) {
      LogDeduplicator.instance = new LogDeduplicator();
    }
    return LogDeduplicator.instance;
  }

  /**
   * Log un message une seule fois dans un intervalle de temps défini
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   * @param level Le niveau de log (info, warn, error, debug)
   */
  public async logOnce(
    message: string, 
    metadata: Record<string, any> = {}, 
    level: 'info' | 'warn' | 'error' | 'debug' = 'info'
  ): Promise<void> {
    const now = Date.now();
    const key = `${level}:${message}:${JSON.stringify(metadata)}`;
    
    const last = this.lastLogTimestamp.get(key);
    if (last === undefined || now - last > this.LOG_THROTTLE_MS) {
      if (this.lastLogTimestamp.size >= this.MAX_KEYS) this.prune(now);
      // Still full after a sweep means a flood of keys all inside the window:
      // forgetting them costs at most a few duplicate lines, never memory.
      if (this.lastLogTimestamp.size >= this.MAX_KEYS) this.lastLogTimestamp.clear();
      this.lastLogTimestamp.set(key, now);
      await logger[level](message, metadata);
    }
  }

  /**
   * Log un message d'information une seule fois
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   */
  public async info(message: string, metadata: Record<string, any> = {}): Promise<void> {
    await this.logOnce(message, metadata, 'info');
  }

  /**
   * Log un message d'avertissement une seule fois
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   */
  public async warn(message: string, metadata: Record<string, any> = {}): Promise<void> {
    await this.logOnce(message, metadata, 'warn');
  }

  /**
   * Log un message d'erreur une seule fois
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   */
  public async error(message: string, metadata: Record<string, any> = {}): Promise<void> {
    await this.logOnce(message, metadata, 'error');
  }

  /**
   * Log un message de débogage une seule fois
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   */
  public async debug(message: string, metadata: Record<string, any> = {}): Promise<void> {
    await this.logOnce(message, metadata, 'debug');
  }

  /**
   * Réinitialise le stockage des timestamps
   * Utile pour les tests ou pour forcer le logging d'un message
   */
  public reset(): void {
    this.lastLogTimestamp.clear();
  }
}

// Export d'une instance par défaut pour faciliter l'utilisation
export const logDeduplicator = LogDeduplicator.getInstance(); 