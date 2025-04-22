import pino from 'pino';
import path from 'path';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';

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
    this.cleanupInterval = setInterval(() => this.cleanup(), this.deduplicationWindow);
  }

  public static getInstance(): LogDeduplicator {
    if (!LogDeduplicator.instance) {
      LogDeduplicator.instance = new LogDeduplicator();
    }
    return LogDeduplicator.instance;
  }

  public cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const now = Date.now();
    for (const [key, log] of this.logMap.entries()) {
      if (now - log.timestamp > this.deduplicationWindow) {
        this.logMap.delete(key);
      }
    }

    if (this.logMap.size > this.maxLogs) {
      this.logMap.clear();
    }
  }

  public processLog(level: string, message: string, metadata: Record<string, any> = {}): LogEntry | null {
    const key = `${level}:${message}:${JSON.stringify(metadata)}`;
    const now = Date.now();
    
    if (this.logMap.has(key)) {
      const existingLog = this.logMap.get(key)!;
      
      if (now - existingLog.timestamp < this.deduplicationWindow) {
        existingLog.count++;
        return null;
      }
    }
    
    const newLog: LogEntry = {
      message,
      level,
      timestamp: now,
      count: 1,
      metadata
    };
    
    this.logMap.set(key, newLog);
    
    if (this.logMap.size > this.maxLogs) {
      this.cleanup();
    }
    
    return newLog;
  }
}

// Configuration de base du logger
const baseConfig = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: {
    service: 'liquidterminal-api'
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label: string) => ({ level: label }),
    bindings: (bindings: Record<string, any>) => ({ pid: bindings.pid, host: bindings.hostname })
  }
};

// Initialisation des streams de logs
let errorStream: NodeJS.WritableStream;
let combinedStream: NodeJS.WritableStream;
let logger: pino.Logger;
let errorLogger: pino.Logger;

// Fonction d'initialisation asynchrone
async function initializeLogger() {
  const logsDir = path.join(__dirname, '../../logs');
  await mkdir(logsDir, { recursive: true });

  errorStream = createWriteStream(path.join(logsDir, 'error.log'));
  combinedStream = createWriteStream(path.join(logsDir, 'combined.log'));

  // Configuration simplifiée sans transport de fichier
  logger = pino({
    ...baseConfig,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  });

  errorLogger = pino({
    ...baseConfig,
    level: 'error',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  });
}

// Initialiser les loggers
initializeLogger().catch(console.error);

// Wrapper pour la déduplication des logs
const deduplicatedLogger = {
  info: (message: string, metadata: Record<string, any> = {}) => {
    const deduplicator = LogDeduplicator.getInstance();
    const processedLog = deduplicator.processLog('info', message, metadata);
    if (processedLog) {
      if (processedLog.count > 1) {
        logger?.info({ ...metadata, count: processedLog.count }, `${message} (occurred ${processedLog.count} times)`);
      } else {
        logger?.info(metadata, message);
      }
    }
  },
  error: (message: string, metadata: Record<string, any> = {}) => {
    const deduplicator = LogDeduplicator.getInstance();
    const processedLog = deduplicator.processLog('error', message, metadata);
    if (processedLog) {
      if (processedLog.count > 1) {
        errorLogger?.error({ ...metadata, count: processedLog.count }, `${message} (occurred ${processedLog.count} times)`);
      } else {
        errorLogger?.error(metadata, message);
      }
    }
  },
  debug: (message: string, metadata: Record<string, any> = {}) => {
    const deduplicator = LogDeduplicator.getInstance();
    const processedLog = deduplicator.processLog('debug', message, metadata);
    if (processedLog) {
      if (processedLog.count > 1) {
        logger?.debug({ ...metadata, count: processedLog.count }, `${message} (occurred ${processedLog.count} times)`);
      } else {
        logger?.debug(metadata, message);
      }
    }
  },
  warn: (message: string, metadata: Record<string, any> = {}) => {
    const deduplicator = LogDeduplicator.getInstance();
    const processedLog = deduplicator.processLog('warn', message, metadata);
    if (processedLog) {
      if (processedLog.count > 1) {
        logger?.warn({ ...metadata, count: processedLog.count }, `${message} (occurred ${processedLog.count} times)`);
      } else {
        logger?.warn(metadata, message);
      }
    }
  }
};

// Fonction utilitaire pour mesurer le temps d'exécution
export const measureExecutionTime = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  const start = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - start;
    deduplicatedLogger.info(`Operation completed: ${operationName}`, { duration, operationName });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    deduplicatedLogger.error(`Operation failed: ${operationName}`, { 
      duration, 
      operationName, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
};

// Stream pour Morgan
export const stream = {
  write: (message: string) => {
    deduplicatedLogger.info(message.trim());
  }
};

export default deduplicatedLogger; 