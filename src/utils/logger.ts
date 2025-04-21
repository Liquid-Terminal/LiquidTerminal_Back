import winston from 'winston';
import path from 'path';
// @ts-ignore
import DailyRotateFile from 'winston-daily-rotate-file';

// Interface pour le suivi des logs dupliqués
interface LogEntry {
  message: string;
  level: string;
  timestamp: number;
  count: number;
  metadata: Record<string, any>;
}

// Classe pour gérer la déduplication des logs
class LogDeduplicator {
  private static instance: LogDeduplicator;
  private logMap: Map<string, LogEntry> = new Map();
  private readonly deduplicationWindow: number = 60000; // 1 minute en millisecondes
  private readonly maxLogs: number = 1000; // Nombre maximum de logs à conserver
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Nettoyer périodiquement les anciens logs
    this.cleanupInterval = setInterval(() => this.cleanup(), this.deduplicationWindow);
  }

  public static getInstance(): LogDeduplicator {
    if (!LogDeduplicator.instance) {
      LogDeduplicator.instance = new LogDeduplicator();
    }
    return LogDeduplicator.instance;
  }

  public cleanup(): void {
    // Nettoyer l'intervalle si nécessaire
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Nettoyer les logs expirés
    const now = Date.now();
    for (const [key, log] of this.logMap.entries()) {
      if (now - log.timestamp > this.deduplicationWindow) {
        this.logMap.delete(key);
      }
    }

    // Si la map est toujours trop grande, la vider
    if (this.logMap.size > this.maxLogs) {
      this.logMap.clear();
    }
  }

  public processLog(level: string, message: string, metadata: Record<string, any> = {}): LogEntry | null {
    const key = `${level}:${message}:${JSON.stringify(metadata)}`;
    const now = Date.now();
    
    // Vérifier si ce log existe déjà dans la fenêtre de déduplication
    if (this.logMap.has(key)) {
      const existingLog = this.logMap.get(key)!;
      
      // Si le log est dans la fenêtre de déduplication, incrémenter le compteur
      if (now - existingLog.timestamp < this.deduplicationWindow) {
        existingLog.count++;
        return null; // Ne pas logger à nouveau
      }
    }
    
    // Créer une nouvelle entrée de log
    const newLog: LogEntry = {
      message,
      level,
      timestamp: now,
      count: 1,
      metadata
    };
    
    // Ajouter le log à la map
    this.logMap.set(key, newLog);
    
    // Nettoyer si nécessaire
    if (this.logMap.size > this.maxLogs) {
      this.cleanup();
    }
    
    return newLog;
  }
}

// Format personnalisé pour inclure le compteur de déduplication
const deduplicationFormat = winston.format((info) => {
  const deduplicator = LogDeduplicator.getInstance();
  const level = typeof info.level === 'string' ? info.level : 'info';
  const message = typeof info.message === 'string' ? info.message : String(info.message);
  const processedLog = deduplicator.processLog(level, message, info);
  
  if (processedLog) {
    // Premier log ou log après la fenêtre de déduplication
    if (processedLog.count > 1) {
      info.message = `${message} (occurred ${processedLog.count} times)`;
    }
    return info;
  }
  
  // Log dupliqué, ne pas l'afficher
  return false;
});

// Format pour les métriques de performance
const performanceFormat = winston.format((info) => {
  if (info.duration) {
    info.message = `${info.message} (${info.duration}ms)`;
  }
  return info;
});

// Définir les formats de log
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  deduplicationFormat(),
  performanceFormat(),
  winston.format.json()
);

// Format plus lisible pour le développement
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ` ${JSON.stringify(meta)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Créer le logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'liquidterminal-api' },
  transports: [
    // Écrire les logs d'erreur dans un fichier avec rotation quotidienne
    new DailyRotateFile({ 
      filename: path.join(__dirname, '../../logs/error-%DATE%.log'), 
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '10m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    // Écrire tous les logs dans un fichier avec rotation quotidienne
    new DailyRotateFile({ 
      filename: path.join(__dirname, '../../logs/combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '14d',
      zippedArchive: true
    }),
  ],
});

// Si nous ne sommes pas en production, afficher les logs dans la console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Fonction utilitaire pour mesurer le temps d'exécution
export const measureExecutionTime = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  const start = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - start;
    logger.info(`Operation completed: ${operationName}`, { duration, operationName });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`Operation failed: ${operationName}`, { 
      duration, 
      operationName, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
};

// Créer un stream pour Morgan (middleware de logging HTTP)
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Exporter l'instance du LogDeduplicator
export const logDeduplicator = LogDeduplicator.getInstance();

export { logger }; 