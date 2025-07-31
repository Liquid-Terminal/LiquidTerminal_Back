  import Redis from 'ioredis';
  import { logDeduplicator } from '../utils/logDeduplicator';

  // Configuration adaptée pour Railway
  const redisConfig = {
    // ✅ SOLUTION Railway : Dual stack IPv4/IPv6
    family: 0, // 0 = dual stack (IPv4 + IPv6)
    
    // URL de connexion
    ...(process.env.REDIS_URL ? {} : { 
      host: 'localhost', 
      port: 6379 
    }),
    
    // Options pour Railway
    maxRetriesPerRequest: 5, // Plus de retries
    retryDelayOnFailover: 500,
    enableReadyCheck: false,
    lazyConnect: false, // Important pour Railway
    
    // Timeouts
    connectTimeout: 30000,
    commandTimeout: 10000,
    enableOfflineQueue: false,
    // Pour les connexions instables
    keepAlive: 30000,
    
    // Options SSL si nécessaire (Railway peut l'exiger)
    ...(process.env.NODE_ENV === 'production' && {
      tls: {},
    }),
  };

  const redis = process.env.REDIS_URL 
    ? new Redis(process.env.REDIS_URL, redisConfig)
    : new Redis(redisConfig);

  // Configuration des listeners d'événements pour le diagnostic
  redis.on('ready', () => {
    console.log('✅ Redis is ready');
    logDeduplicator.info('Redis is ready');
    // ✅ PING SEULEMENT QUAND READY
    redis.ping().then(() => {
      console.log('✅ Redis PING successful');
      logDeduplicator.info('Redis PING successful');
    }).catch((err) => {
      console.error('❌ Redis PING failed:', err);
      logDeduplicator.error('Redis PING failed', { 
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    });
  });

  redis.on('connecting', () => {
    console.log('🔄 Connecting to Redis...');
    console.log('🔧 Redis URL:', process.env.REDIS_URL ? 'SET' : 'NOT SET');
    logDeduplicator.info('Connecting to Redis');
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
    logDeduplicator.info('Redis connected successfully');
  });

  redis.on('reconnecting', () => {
    console.log('🔄 Reconnecting to Redis...');
    logDeduplicator.info('Reconnecting to Redis');
  });

  redis.on('close', () => {
    console.log('❌ Redis connection closed');
    logDeduplicator.warn('Redis connection closed');
  });

  redis.on('error', (err) => {
    console.error('❌ Redis Error:', err);
    
    // ✅ DIAGNOSTIC RAILWAY SPÉCIFIQUE
    if ((err as any).code === 'ETIMEDOUT') {
      console.error('🚨 ETIMEDOUT - Actions à vérifier:');
      console.error('   1. Railway dashboard > Redis service status');
      console.error('   2. Variables env: REDIS_URL =', process.env.REDIS_URL ? 'SET' : 'NOT SET');
      console.error('   3. Redéployer: railway up');
    }
    
    logDeduplicator.error('Redis Error', { 
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
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