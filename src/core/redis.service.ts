import Redis from 'ioredis';

class RedisService {
  private client: Redis;
  private subscriber: Redis;
  private readonly DEFAULT_EXPIRATION = 60 * 5; // 5 minutes

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error', err));
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
      await this.client.set(key, value, 'EX', expiration);
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
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          callback(message);
        }
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
      await this.client.flushall();
    } catch (error) {
      console.error('Redis flushall error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.quit(),
        this.subscriber.quit()
      ]);
    } catch (error) {
      console.error('Redis disconnect error:', error);
      throw error;
    }
  }

  async reconnect(): Promise<void> {
    try {
      await this.disconnect();
      this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      this.subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
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