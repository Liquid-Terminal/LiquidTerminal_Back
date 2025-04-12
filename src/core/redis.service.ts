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

    Promise.all([
      this.client.connect(),
      this.subscriber.connect()
    ]).catch(console.error);
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, expiration = this.DEFAULT_EXPIRATION): Promise<void> {
    try {
      await this.client.set(key, value, { EX: expiration });
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    try {
      await this.client.publish(channel, message);
    } catch (error) {
      console.error('Redis publish error:', error);
    }
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel, (message) => {
        callback(message);
      });
    } catch (error) {
      console.error('Redis subscribe error:', error);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.subscriber.unsubscribe(channel);
    } catch (error) {
      console.error('Redis unsubscribe error:', error);
    }
  }

  multi() {
    return this.client.multi();
  }
}

export const redisService = new RedisService(); 