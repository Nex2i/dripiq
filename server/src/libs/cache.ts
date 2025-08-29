import type { Redis } from 'ioredis';
import { createRedisConnection } from '@/libs/bullmq';
import { logger } from '@/libs/logger';

export interface CacheManagerConfig {
  defaultTtl?: number;
  maxKeys?: number;
  namespace?: string;
}

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

class CacheManager {
  private redis: Redis;
  private config: CacheManagerConfig;

  constructor(config: CacheManagerConfig = {}) {
    this.config = {
      defaultTtl: 60 * 60, // 1 hour default
      maxKeys: 10000,
      namespace: 'dripiq',
      ...config,
    };

    this.redis = createRedisConnection();
    this.setupCache();
  }

  private setupCache(): void {
    try {
      // Add error handling for the Redis instance
      this.redis.on('error', (error) => {
        logger.error('Redis cache error', { error: String(error) });
      });

      this.redis.on('connect', () => {
        logger.info('Cache Redis connected');
      });

      this.redis.on('ready', () => {
        logger.info('Cache Redis ready');
      });

      logger.info('Cache manager initialized successfully', {
        namespace: this.config.namespace,
        defaultTtl: this.config.defaultTtl,
        redisConnection: 'shared with BullMQ (ioredis direct)',
        redisStatus: this.redis.status,
      });
    } catch (error) {
      logger.error('Failed to initialize cache manager', { error: String(error) });
      throw error;
    }
  }

  /**
   * Set a value in the cache
   */
  async set<T = any>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || this.config.defaultTtl || 3600; // TTL in seconds
      const serializedValue = JSON.stringify(value);

      logger.info('Cache set attempt', {
        key: fullKey,
        valueType: typeof value,
        ttl,
        hasValue: value !== undefined && value !== null,
        serializedLength: serializedValue.length,
      });

      // Use Redis SETEX to set with TTL
      await this.redis.setex(fullKey, ttl, serializedValue);

      logger.info('Cache set successful', { key: fullKey, ttl });
    } catch (error) {
      logger.error('Cache set failed', {
        key,
        fullKey: this.buildKey(key, options?.prefix),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get a value from the cache
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);

      logger.info('Cache get attempt', { key: fullKey });

      const serializedValue = await this.redis.get(fullKey);

      if (serializedValue === null) {
        logger.info('Cache get result', { key: fullKey, hit: false });
        return null;
      }

      const value = JSON.parse(serializedValue) as T;

      logger.info('Cache get result', {
        key: fullKey,
        hit: true,
        valueType: typeof value,
        serializedLength: serializedValue.length,
      });

      return value;
    } catch (error) {
      logger.error('Cache get failed', {
        key,
        fullKey: this.buildKey(key, options?.prefix),
        error: String(error),
      });
      return null; // Return null on error instead of throwing
    }
  }

  /**
   * Delete a value from the cache
   */
  async del(key: string, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      await this.redis.del(fullKey);

      logger.debug('Cache delete successful', { key: fullKey });
    } catch (error) {
      logger.error('Cache delete failed', { key, error: String(error) });
      throw error;
    }
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    } catch (error) {
      logger.error('Cache has check failed', { key, error: String(error) });
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T = any>(
    key: string,
    fetcher: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }

      const value = await fetcher();
      await this.set(key, value, options);
      return value;
    } catch (error) {
      logger.error('Cache getOrSet failed', { key, error: String(error) });
      throw error;
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async clear(): Promise<void> {
    try {
      const pattern = `${this.config.namespace}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info('Cache cleared successfully', { keysDeleted: keys.length });
      } else {
        logger.info('Cache clear - no keys to delete');
      }
    } catch (error) {
      logger.error('Cache clear failed', { error: String(error) });
      throw error;
    }
  }

  /**
   * Test Redis connection and basic operations
   */
  async testConnection(): Promise<{
    connected: boolean;
    setTest: boolean;
    getTest: boolean;
    error?: string;
  }> {
    try {
      // Test basic Redis operations
      const testKey = this.buildKey(`test:${Date.now()}`);
      const testValue = { message: 'test-value', timestamp: Date.now() };

      // Test set
      await this.set('test-connection', testValue, { ttl: 10 });
      logger.debug('Cache test set successful', { key: testKey });

      // Test get
      const retrieved = await this.get<typeof testValue>('test-connection');
      const getTest = retrieved !== null && retrieved.message === testValue.message;
      logger.debug('Cache test get', { key: testKey, retrieved, success: getTest });

      // Cleanup
      await this.del('test-connection');

      return {
        connected: true,
        setTest: true,
        getTest,
      };
    } catch (error) {
      logger.error('Cache connection test failed', { error: String(error) });
      return {
        connected: false,
        setTest: false,
        getTest: false,
        error: String(error),
      };
    }
  }

  /**
   * Delete cache entries by pattern (Redis-specific)
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern, undefined);
      const keys = await this.redis.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      logger.debug('Cache pattern delete successful', { pattern: fullPattern, deleted: result });

      return result;
    } catch (error) {
      logger.error('Cache pattern delete failed', { pattern, error: String(error) });
      throw error;
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(entries: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    try {
      const promises = entries.map(({ key, value, options }) => this.set(key, value, options));

      await Promise.all(promises);
      logger.debug('Cache mset successful', { count: entries.length });
    } catch (error) {
      logger.error('Cache mset failed', { error: String(error) });
      throw error;
    }
  }

  /**
   * Get multiple values by keys
   */
  async mget<T = any>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    try {
      const promises = keys.map((key) => this.get<T>(key, options));
      const results = await Promise.all(promises);

      logger.debug('Cache mget successful', {
        count: keys.length,
        hits: results.filter((r) => r !== null).length,
      });

      return results;
    } catch (error) {
      logger.error('Cache mget failed', { error: String(error) });
      throw error;
    }
  }

  /**
   * Increment a numeric value in cache
   */
  async increment(key: string, amount: number = 1, options?: CacheOptions): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.incrby(fullKey, amount);

      // Set TTL if specified
      if (options?.ttl || this.config.defaultTtl) {
        const ttl = options?.ttl || this.config.defaultTtl || 3600;
        await this.redis.expire(fullKey, ttl);
      }

      logger.debug('Cache increment successful', { key: fullKey, amount, result });
      return result;
    } catch (error) {
      logger.error('Cache increment failed', { key, error: String(error) });
      throw error;
    }
  }

  /**
   * Set TTL for an existing key
   */
  async expire(key: string, ttl: number, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.expire(fullKey, ttl);

      logger.debug('Cache expire successful', { key: fullKey, ttl, result: Boolean(result) });
      return Boolean(result);
    } catch (error) {
      logger.error('Cache expire failed', { key, error: String(error) });
      throw error;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string, options?: CacheOptions): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.ttl(fullKey);

      logger.debug('Cache TTL check', { key: fullKey, ttl: result });
      return result;
    } catch (error) {
      logger.error('Cache TTL check failed', { key, error: String(error) });
      return -1;
    }
  }

  /**
   * Build the full cache key with namespace and optional prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const parts = [this.config.namespace];

    if (prefix) {
      parts.push(prefix);
    }

    parts.push(key);
    return parts.join(':');
  }

  /**
   * Get cache statistics (Redis-specific)
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    hits?: number;
    misses?: number;
    sampleKeys?: string[];
  }> {
    try {
      const pattern = `${this.config.namespace}:*`;
      const keys = await this.redis.keys(pattern);
      const info = await this.redis.info('memory');

      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1]?.trim() || 'unknown' : 'unknown';

      // Get a sample of keys for debugging
      const sampleKeys = keys.slice(0, 10);

      return {
        keys: keys.length,
        memory,
        sampleKeys,
      };
    } catch (error) {
      logger.error('Cache stats failed', { error: String(error) });
      return { keys: 0, memory: 'unknown' };
    }
  }

  /**
   * Debug method to inspect Redis directly
   */
  async inspectRedis(): Promise<{
    allKeys: string[];
    namespaceKeys: string[];
    redisInfo: any;
  }> {
    try {
      // Get all keys
      const allKeys = await this.redis.keys('*');

      // Get keys in our namespace
      const namespaceKeys = await this.redis.keys(`${this.config.namespace}:*`);

      // Get Redis info
      const redisInfo = {
        connected: this.redis.status === 'ready',
        status: this.redis.status,
        mode: this.redis.mode,
      };

      logger.info('Redis inspection', {
        totalKeys: allKeys.length,
        namespaceKeys: namespaceKeys.length,
        namespace: this.config.namespace,
        redisStatus: this.redis.status,
      });

      return {
        allKeys: allKeys.slice(0, 20), // Limit to first 20 for safety
        namespaceKeys,
        redisInfo,
      };
    } catch (error) {
      logger.error('Redis inspection failed', { error: String(error) });
      return {
        allKeys: [],
        namespaceKeys: [],
        redisInfo: { error: String(error) },
      };
    }
  }
}

// Create and export the default cache manager instance
export const cacheManager = new CacheManager();

// Export the class for creating custom instances
export { CacheManager };

// Export convenience methods for direct usage
export const {
  set: cacheSet,
  get: cacheGet,
  del: cacheDel,
  has: cacheHas,
  getOrSet: cacheGetOrSet,
  clear: cacheClear,
  deletePattern: cacheDeletePattern,
  mset: cacheMset,
  mget: cacheMget,
  increment: cacheIncrement,
  expire: cacheExpire,
  ttl: cacheTtl,
  getStats: cacheGetStats,
  testConnection: cacheTestConnection,
  inspectRedis: cacheInspectRedis,
} = cacheManager;
