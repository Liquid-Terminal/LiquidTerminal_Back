import pino from 'pino';
import path from 'path';
import { mkdir } from 'fs/promises';
import { Writable } from 'stream';

interface LogEntry {
  message: string;
  level: string;
  timestamp: number;
  count: number;
  metadata: Record<string, any>;
}

class LogDeduplicatorInternal {
  private static instance: LogDeduplicatorInternal;
  private logMap: Map<string, LogEntry> = new Map();
  private readonly deduplicationWindow: number = 60000;
  private readonly maxLogs: number = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.cleanupInterval = setInterval(() => this.cleanupOldEntries(), this.deduplicationWindow);
  }

  public static getInstance(): LogDeduplicatorInternal {
    if (!LogDeduplicatorInternal.instance) {
      LogDeduplicatorInternal.instance = new LogDeduplicatorInternal();
    }
    return LogDeduplicatorInternal.instance;
  }

  private cleanupOldEntries(): void {
    const now = Date.now();
    for (const [key, log] of this.logMap.entries()) {
      if (now - log.timestamp > this.deduplicationWindow) {
        this.logMap.delete(key);
      }
    }
  }

  public cleanup(): void {
    if (this.logMap.size > this.maxLogs) {
      const entries = Array.from(this.logMap.entries());
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
      let i = 0;
      while (this.logMap.size > this.maxLogs && i < entries.length) {
        this.logMap.delete(entries[i][0]);
        i++;
      }
    }
  }

  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  public processLog(level: string, message: string, metadata: Record<string, any> = {}): LogEntry | null {
    const key = `${level}:${message}`;
    const now = Date.now();
    const existingLog = this.logMap.get(key);

    if (existingLog && (now - existingLog.timestamp < this.deduplicationWindow)) {
      existingLog.count++;
      existingLog.timestamp = now;
      return null;
    }

    const newLog: LogEntry = { message, level, timestamp: now, count: 1, metadata };
    this.logMap.set(key, newLog);
    if (this.logMap.size > this.maxLogs) {
      this.cleanup();
    }
    return newLog;
  }
}

const baseConfig = {
  base: { service: 'liquidterminal-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label: string) => ({ level: label }) },
};

let infoWarnLogger: pino.Logger;
let errorDebugLogger: pino.Logger;

let iwFileStream: pino.DestinationStream;
let edFileStream: pino.DestinationStream;

const logsDir = path.join(__dirname, '../../logs');
const combinedLogPath = path.join(logsDir, 'combined.log');
const errorLogPath = path.join(logsDir, 'error.log');

async function initializeLogger() {
  try {
    await mkdir(logsDir, { recursive: true });

    const prettyPrintOptions = {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname,service',
    };

    const consoleTransport = process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: prettyPrintOptions }
      : null;

    iwFileStream = pino.destination(combinedLogPath);
    const iwPinoStreams: pino.StreamEntry[] = [{ level: 'info', stream: iwFileStream }];
    if (consoleTransport) {
      iwPinoStreams.push({ level: 'info', stream: pino.transport(consoleTransport) as unknown as Writable });
    }
    infoWarnLogger = pino({ ...baseConfig, level: 'info' }, pino.multistream(iwPinoStreams));

    edFileStream = pino.destination(errorLogPath);
    const edPinoStreams: pino.StreamEntry[] = [{ level: 'debug', stream: edFileStream }];
    if (consoleTransport) {
      edPinoStreams.push({ level: 'debug', stream: pino.transport(consoleTransport) as unknown as Writable });
    }
    errorDebugLogger = pino({ ...baseConfig, level: 'debug' }, pino.multistream(edPinoStreams));

    const shutdown = () => {
      (iwFileStream as any)?.flushSync(); 
      (edFileStream as any)?.flushSync();
      
      LogDeduplicatorInternal.getInstance().shutdown();
      process.exit(0);
    };

    process.on('exit', () => {
        (iwFileStream as any)?.flushSync();
        (edFileStream as any)?.flushSync();
    });
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('Failed to initialize pino logger:', err);
    infoWarnLogger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });
    errorDebugLogger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' }); 
  }
}

initializeLogger();

const deduplicatedLogger = {
  info: (message: string, metadata: Record<string, any> = {}) => {
    if (!infoWarnLogger) { console.info(message, metadata); return; }
    const deduplicator = LogDeduplicatorInternal.getInstance();
    const processedLog = deduplicator.processLog('info', message, metadata);
    if (processedLog) {
      infoWarnLogger.info(processedLog.metadata, processedLog.count > 1 ? `${message} (occurred ${processedLog.count} times)` : message);
    }
  },
  error: (message: string, metadata: Record<string, any> = {}) => {
    if (!errorDebugLogger) { console.error(message, metadata); return; }
    const deduplicator = LogDeduplicatorInternal.getInstance();
    const processedLog = deduplicator.processLog('error', message, metadata);
    if (processedLog) {
      errorDebugLogger.error(processedLog.metadata, processedLog.count > 1 ? `${message} (occurred ${processedLog.count} times)` : message);
    }
  },
  debug: (message: string, metadata: Record<string, any> = {}) => {
    if (!errorDebugLogger) { console.debug(message, metadata); return; }
    const deduplicator = LogDeduplicatorInternal.getInstance();
    const processedLog = deduplicator.processLog('debug', message, metadata);
    if (processedLog) {
      errorDebugLogger.debug(processedLog.metadata, processedLog.count > 1 ? `${message} (occurred ${processedLog.count} times)` : message);
    }
  },
  warn: (message: string, metadata: Record<string, any> = {}) => {
    if (!infoWarnLogger) { console.warn(message, metadata); return; }
    const deduplicator = LogDeduplicatorInternal.getInstance();
    const processedLog = deduplicator.processLog('warn', message, metadata);
    if (processedLog) {
      infoWarnLogger.warn(processedLog.metadata, processedLog.count > 1 ? `${message} (occurred ${processedLog.count} times)` : message);
    }
  },
};

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
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const stream = {
  write: (message: string) => {
    deduplicatedLogger.info(message.trim());
  },
};

export default deduplicatedLogger; 