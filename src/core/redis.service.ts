import { Redis } from 'ioredis';
import { logDeduplicator } from '../utils/logDeduplicator';

export class RedisService {
  private client: Redis;
  private subscriber: Redis;
  private static instance: RedisService;
  private readonly DEFAULT_EXPIRATION = 60 * 5; // 5 minutes

  private constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    });

    this.client.on('error', (err) => {
      logDeduplicator.error('Redis Client Error', { 
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    });

    this.subscriber.on('error', (err) => {
      logDeduplicator.error('Redis Subscriber Error', { 
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    });
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
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
        await this.client.set(key, value, 'EX', ttl);
      } else {
        await this.client.set(key, value);
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
      await this.client.del(key);
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
      return await this.client.keys(pattern);
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
      await this.client.publish(channel, message);
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
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (receivedChannel, message) => {
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
      await this.subscriber.unsubscribe(channel);
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
      await this.client.flushall();
    } catch (error) {
      logDeduplicator.error('Redis flushall error', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      await this.subscriber.quit();
    } catch (error) {
      logDeduplicator.error('Redis disconnect error', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  public async reconnect(): Promise<void> {
    try {
      await this.client.connect();
      await this.subscriber.connect();
    } catch (error) {
      logDeduplicator.error('Redis reconnect error', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  multi() {
    return this.client.multi();
  }
}

export const redisService = RedisService.getInstance(); 