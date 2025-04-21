import { createClient } from 'redis';

class RedisService {
  private client;
  private subscriber;
  private readonly DEFAULT_EXPIRATION = 60 * 5; // 5 minutes

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.subscriber = this.client.duplicate();

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error', err));

    this.connect().catch(console.error);
  }

  private async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect()
      ]);
    } catch (error) {
      console.error('Redis connection error:', error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
      throw error;
    }
  }

  async set(key: string, value: string, expiration = this.DEFAULT_EXPIRATION): Promise<void> {
    try {
      await this.client.set(key, value, { EX: expiration });
    } catch (error) {
      console.error('Redis set error:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error('Redis delete error:', error);
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Redis keys error:', error);
      throw error;
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    try {
      await this.client.publish(channel, message);
    } catch (error) {
      console.error('Redis publish error:', error);
      throw error;
    }
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel, (message) => {
        callback(message);
      });
    } catch (error) {
      console.error('Redis subscribe error:', error);
      throw error;
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.subscriber.unsubscribe(channel);
    } catch (error) {
      console.error('Redis unsubscribe error:', error);
      throw error;
    }
  }

  async flushall(): Promise<void> {
    try {
      await this.client.flushAll();
    } catch (error) {
      console.error('Redis flushall error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client.isOpen) {
        await this.client.disconnect();
      }
      if (this.subscriber.isOpen) {
        await this.subscriber.disconnect();
      }
    } catch (error) {
      console.error('Redis disconnect error:', error);
      throw error;
    }
  }

  async reconnect(): Promise<void> {
    try {
      await this.disconnect();
      await this.connect();
    } catch (error) {
      console.error('Redis reconnect error:', error);
      throw error;
    }
  }

  multi() {
    return this.client.multi();
  }
}

export const redisService = new RedisService(); 