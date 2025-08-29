import { createCache } from 'cache-manager';
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';
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
  private cache: any;
  private redis: any;
  private keyv!: Keyv;
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
      // Create KeyvRedis store using the existing Redis connection
      const keyvRedis = new KeyvRedis(this.redis, {
        namespace: this.config.namespace,
      });

      // Create Keyv instance with Redis store
      this.keyv = new Keyv({
        store: keyvRedis,
        ttl: (this.config.defaultTtl || 3600) * 1000, // Convert to milliseconds
      });

      // Create cache-manager instance with Keyv store
      this.cache = createCache({
        stores: [this.keyv],
      });

      logger.info('Cache manager initialized successfully', {
        namespace: this.config.namespace,
        defaultTtl: this.config.defaultTtl,
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
      const ttl = options?.ttl || this.config.defaultTtl;
      
      await this.cache.set(fullKey, value, ttl * 1000); // Convert to milliseconds
      
      logger.debug('Cache set successful', { key: fullKey, ttl });
    } catch (error) {
      logger.error('Cache set failed', { key, error: String(error) });
      throw error;
    }
  }

  /**
   * Get a value from the cache
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const value = await this.cache.get<T>(fullKey);
      
      logger.debug('Cache get', { key: fullKey, hit: value !== undefined });
      
      return value || null;
    } catch (error) {
      logger.error('Cache get failed', { key, error: String(error) });
      return null; // Return null on error instead of throwing
    }
  }

  /**
   * Delete a value from the cache
   */
  async del(key: string, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      await this.cache.del(fullKey);
      
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
      const value = await this.cache.get(fullKey);
      return value !== undefined;
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
      await this.keyv.clear();
      logger.info('Cache cleared successfully');
    } catch (error) {
      logger.error('Cache clear failed', { error: String(error) });
      throw error;
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
      const promises = entries.map(({ key, value, options }) => 
        this.set(key, value, options)
      );
      
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
      const promises = keys.map(key => this.get<T>(key, options));
      const results = await Promise.all(promises);
      
      logger.debug('Cache mget successful', { 
        count: keys.length, 
        hits: results.filter(r => r !== null).length 
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
        const ttl = options?.ttl || this.config.defaultTtl;
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
  }> {
    try {
      const pattern = `${this.config.namespace}:*`;
      const keys = await this.redis.keys(pattern);
      const info = await this.redis.info('memory');
      
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';
      
      return {
        keys: keys.length,
        memory,
      };
    } catch (error) {
      logger.error('Cache stats failed', { error: String(error) });
      return { keys: 0, memory: 'unknown' };
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
} = cacheManager;