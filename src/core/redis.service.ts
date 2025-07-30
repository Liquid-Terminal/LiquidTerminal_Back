import Redis from 'ioredis';
import { logDeduplicator } from '../utils/logDeduplicator';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Configuration des listeners d'erreur
redis.on('error', (err) => {
  logDeduplicator.error('Redis Error', { 
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  });
});

redis.on('connect', () => {
  logDeduplicator.info('Redis connected successfully');
});

// Service wrapper pour maintenir la compatibilité
export class RedisService {
  public static getInstance(): RedisService {
    return new RedisService();
  }

  public async get(key: string): Promise<string | null> {
    try {
      return await redis.get(key);
    } catch (error) {
      logDeduplicator.error('Redis get error', { 
        key,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await redis.set(key, value, 'EX', ttl);
      } else {
        await redis.set(key, value);
      }
    } catch (error) {
      logDeduplicator.error('Redis set error', { 
        key,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logDeduplicator.error('Redis delete error', { 
        key,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  public async keys(pattern: string): Promise<string[]> {
    try {
      return await redis.keys(pattern);
    } catch (error) {
      logDeduplicator.error('Redis keys error', { 
        pattern,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  }

  public async publish(channel: string, message: string): Promise<void> {
    try {
      await redis.publish(channel, message);
    } catch (error) {
      logDeduplicator.error('Redis publish error', { 
        channel,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  public async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      await redis.subscribe(channel);
      redis.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          callback(message);
        }
      });
    } catch (error) {
      logDeduplicator.error('Redis subscribe error', { 
        channel,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  public async unsubscribe(channel: string): Promise<void> {
    try {
      await redis.unsubscribe(channel);
    } catch (error) {
      logDeduplicator.error('Redis unsubscribe error', { 
        channel,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  public async flushAll(): Promise<void> {
    try {
      await redis.flushall();
    } catch (error) {
      logDeduplicator.error('Redis flushall error', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await redis.quit();
    } catch (error) {
      logDeduplicator.error('Redis disconnect error', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  public multi() {
    return redis.multi();
  }
}

export const redisService = RedisService.getInstance(); 