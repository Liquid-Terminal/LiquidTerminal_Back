import logger from './logger';

/**
 * Point d'entrée de logging de l'application.
 *
 * La déduplication vit dans `logger.ts` (fenêtre de 60s par `niveau:message`,
 * map bornée). Cette classe en tenait une seconde, redondante : une map jamais
 * purgée dont la clé embarquait `JSON.stringify(metadata)` — une entrée par
 * URL / adresse / durée distincte, et une sérialisation complète à chaque
 * appel. Ce qu'elle filtrait (même message + mêmes métadonnées en moins d'1s)
 * l'était déjà par la fenêtre de `logger.ts`.
 */
export class LogDeduplicator {
  // Instance singleton
  private static instance: LogDeduplicator;

  /**
   * Constructeur privé pour empêcher l'instanciation directe
   */
  private constructor() {}

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
   * Log un message ; les répétitions sont absorbées par le logger
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   * @param level Le niveau de log (info, warn, error, debug)
   */
  public async logOnce(
    message: string,
    metadata: Record<string, any> = {},
    level: 'info' | 'warn' | 'error' | 'debug' = 'info'
  ): Promise<void> {
    await logger[level](message, metadata);
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
   * Conservé pour compatibilité : plus d'état local à réinitialiser (la
   * fenêtre de déduplication vit dans `logger.ts`).
   */
  public reset(): void {}
}

// Export d'une instance par défaut pour faciliter l'utilisation
export const logDeduplicator = LogDeduplicator.getInstance();