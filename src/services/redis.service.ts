import { createClient } from 'redis';

class RedisService {
  private client;
  private readonly DEFAULT_EXPIRATION = 60 * 5; // 5 minutes

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.client.connect().catch(console.error);
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
}

export const redisService = new RedisService(); 