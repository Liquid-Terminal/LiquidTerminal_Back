import logger from './logger';

/**
 * Classe utilitaire pour la déduplication des logs
 * Permet d'éviter les logs répétés dans un intervalle de temps défini
 */
export class LogDeduplicator {
  // Instance singleton
  private static instance: LogDeduplicator;
  
  // Stockage des timestamps des derniers logs
  private lastLogTimestamp: Record<string, number> = {};
  
  // Intervalle de temps en millisecondes pour la déduplication
  private readonly LOG_THROTTLE_MS = 1000;

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
   * Log un message une seule fois dans un intervalle de temps défini
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   * @param level Le niveau de log (info, warn, error, debug)
   */
  public logOnce(
    message: string, 
    metadata: Record<string, any> = {}, 
    level: 'info' | 'warn' | 'error' | 'debug' = 'info'
  ): void {
    const now = Date.now();
    const key = `${level}:${message}:${JSON.stringify(metadata)}`;
    
    if (!this.lastLogTimestamp[key] || now - this.lastLogTimestamp[key] > this.LOG_THROTTLE_MS) {
      logger[level](message, metadata);
      this.lastLogTimestamp[key] = now;
    }
  }

  /**
   * Log un message d'information une seule fois
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   */
  public info(message: string, metadata: Record<string, any> = {}): void {
    this.logOnce(message, metadata, 'info');
  }

  /**
   * Log un message d'avertissement une seule fois
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   */
  public warn(message: string, metadata: Record<string, any> = {}): void {
    this.logOnce(message, metadata, 'warn');
  }

  /**
   * Log un message d'erreur une seule fois
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   */
  public error(message: string, metadata: Record<string, any> = {}): void {
    this.logOnce(message, metadata, 'error');
  }

  /**
   * Log un message de débogage une seule fois
   * @param message Le message à logger
   * @param metadata Les métadonnées associées au message
   */
  public debug(message: string, metadata: Record<string, any> = {}): void {
    this.logOnce(message, metadata, 'debug');
  }

  /**
   * Réinitialise le stockage des timestamps
   * Utile pour les tests ou pour forcer le logging d'un message
   */
  public reset(): void {
    this.lastLogTimestamp = {};
  }
}

// Export d'une instance par défaut pour faciliter l'utilisation
export const logDeduplicator = LogDeduplicator.getInstance(); 