import { cacheManager, CacheOptions, type CacheManager as CacheManagerType } from '@/libs/cache';
import { logger } from '@/libs/logger';

/**
 * High-level cache client with common patterns and utilities
 */
export class CacheClient {
  private manager: CacheManagerType;
  private defaultPrefix: string;

  constructor(manager: CacheManagerType = cacheManager, defaultPrefix: string = '') {
    this.manager = manager;
    this.defaultPrefix = defaultPrefix;
  }

  /**
   * Cache with automatic JSON serialization/deserialization
   */
  async setJson<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    const options: CacheOptions = {
      prefix: this.defaultPrefix,
      ttl,
    };

    try {
      const serialized = JSON.stringify(value);
      await this.manager.set(key, serialized, options);
    } catch (error) {
      logger.error('JSON cache set failed', { key, error: String(error) });
      throw error;
    }
  }

  async getJson<T = any>(key: string): Promise<T | null> {
    const options: CacheOptions = {
      prefix: this.defaultPrefix,
    };

    try {
      const cached = await this.manager.get<string>(key, options);
      if (!cached) return null;

      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error('JSON cache get failed', { key, error: String(error) });
      return null;
    }
  }

  /**
   * Session-based caching (for user sessions)
   */
  async setSession<T = any>(sessionId: string, data: T, ttl: number = 60 * 60 * 24): Promise<void> {
    const key = `session:${sessionId}`;
    await this.setJson(key, data, ttl);
  }

  async getSession<T = any>(sessionId: string): Promise<T | null> {
    const key = `session:${sessionId}`;
    return this.getJson<T>(key);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    const options: CacheOptions = { prefix: this.defaultPrefix };
    await this.manager.del(key, options);
  }

  /**
   * User-based caching
   */
  async setUserCache<T = any>(userId: string, key: string, data: T, ttl?: number): Promise<void> {
    const cacheKey = `user:${userId}:${key}`;
    await this.setJson(cacheKey, data, ttl);
  }

  async getUserCache<T = any>(userId: string, key: string): Promise<T | null> {
    const cacheKey = `user:${userId}:${key}`;
    return this.getJson<T>(cacheKey);
  }

  async deleteUserCache(userId: string, key?: string): Promise<void> {
    if (key) {
      const cacheKey = `user:${userId}:${key}`;
      const options: CacheOptions = { prefix: this.defaultPrefix };
      await this.manager.del(cacheKey, options);
    } else {
      // Delete all user cache
      const pattern = `user:${userId}:*`;
      await this.manager.deletePattern(pattern);
    }
  }

  /**
   * Rate limiting cache
   */
  async incrementRateLimit(
    identifier: string,
    window: number = 60,
    limit: number = 100
  ): Promise<{ count: number; remaining: number; resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    const options: CacheOptions = {
      prefix: this.defaultPrefix,
      ttl: window,
    };

    try {
      const count = await this.manager.increment(key, 1, options);
      const remaining = Math.max(0, limit - count);
      const resetTime = Date.now() + window * 1000;

      return { count, remaining, resetTime };
    } catch (error) {
      logger.error('Rate limit increment failed', { identifier, error: String(error) });
      throw error;
    }
  }

  async checkRateLimit(identifier: string): Promise<number> {
    const key = `rate_limit:${identifier}`;
    const options: CacheOptions = { prefix: this.defaultPrefix };

    const cached = await this.manager.get<number>(key, options);
    return cached || 0;
  }

  /**
   * Feature flag caching
   */
  async setFeatureFlag(flagName: string, enabled: boolean, ttl: number = 60 * 15): Promise<void> {
    const key = `feature_flag:${flagName}`;
    await this.manager.set(key, enabled, { prefix: this.defaultPrefix, ttl });
  }

  async getFeatureFlag(flagName: string, defaultValue: boolean = false): Promise<boolean> {
    const key = `feature_flag:${flagName}`;
    const options: CacheOptions = { prefix: this.defaultPrefix };

    const cached = await this.manager.get<boolean>(key, options);
    return cached !== null ? cached : defaultValue;
  }

  /**
   * Memoization helper for expensive operations
   */
  async memoize<T = any>(key: string, fetcher: () => Promise<T> | T, ttl?: number): Promise<T> {
    const options: CacheOptions = {
      prefix: this.defaultPrefix,
      ttl,
    };

    return this.manager.getOrSet(key, fetcher, options);
  }

  /**
   * Cache warming - preload cache with data
   */
  async warmCache<T = any>(
    entries: Array<{
      key: string;
      fetcher: () => Promise<T> | T;
      ttl?: number;
    }>
  ): Promise<void> {
    const promises = entries.map(async ({ key, fetcher, ttl }) => {
      try {
        const data = await fetcher();
        await this.setJson(key, data, ttl);
        logger.debug('Cache warmed', { key });
      } catch (error) {
        logger.error('Cache warming failed', { key, error: String(error) });
      }
    });

    await Promise.allSettled(promises);
    logger.info('Cache warming completed', { count: entries.length });
  }

  /**
   * Bulk operations
   */
  async bulkSet<T = any>(
    entries: Array<{
      key: string;
      value: T;
      ttl?: number;
    }>
  ): Promise<void> {
    const cacheEntries = entries.map(({ key, value, ttl }) => ({
      key,
      value: JSON.stringify(value),
      options: { prefix: this.defaultPrefix, ttl },
    }));

    await this.manager.mset(cacheEntries);
  }

  async bulkGet<T = any>(keys: string[]): Promise<Record<string, T | null>> {
    const options: CacheOptions = { prefix: this.defaultPrefix };
    const values = await this.manager.mget<string>(keys, options);

    const result: Record<string, T | null> = {};

    keys.forEach((key, index) => {
      const value = values[index];
      try {
        result[key] = value ? (JSON.parse(value) as T) : null;
      } catch (error) {
        logger.error('Bulk get JSON parse failed', { key, error: String(error) });
        result[key] = null;
      }
    });

    return result;
  }

  /**
   * Cache tags for grouped invalidation
   */
  async setWithTags<T = any>(key: string, value: T, tags: string[], ttl?: number): Promise<void> {
    // Set the main value
    await this.setJson(key, value, ttl);

    // Add key to each tag set
    const tagPromises = tags.map((tag) => {
      const tagKey = `tag:${tag}`;
      return this.manager.increment(tagKey, 0, {
        prefix: this.defaultPrefix,
        ttl: ttl ? ttl + 300 : undefined,
      });
    });

    await Promise.all(tagPromises);

    // Store tag metadata for the key
    const metaKey = `meta:${key}`;
    await this.setJson(metaKey, { tags, createdAt: Date.now() }, ttl);
  }

  async invalidateByTag(tag: string): Promise<number> {
    const pattern = `tag:${tag}:*`;
    return this.manager.deletePattern(pattern);
  }

  /**
   * Health check for cache
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    stats: any;
    latency: number;
  }> {
    const start = Date.now();

    try {
      // Test basic operations
      const testKey = `health_check:${Date.now()}`;
      await this.manager.set(testKey, 'test', { prefix: this.defaultPrefix, ttl: 10 });
      const value = await this.manager.get(testKey, { prefix: this.defaultPrefix });
      await this.manager.del(testKey, { prefix: this.defaultPrefix });

      const latency = Date.now() - start;
      const stats = await this.manager.getStats();

      return {
        status: value === 'test' ? 'healthy' : 'unhealthy',
        stats,
        latency,
      };
    } catch (error) {
      logger.error('Cache health check failed', { error: String(error) });
      return {
        status: 'unhealthy',
        stats: null,
        latency: Date.now() - start,
      };
    }
  }
}

// Create default instances for different use cases
export const defaultCacheClient = new CacheClient();
export const userCacheClient = new CacheClient(cacheManager, 'users');
export const apiCacheClient = new CacheClient(cacheManager, 'api');
export const sessionCacheClient = new CacheClient(cacheManager, 'sessions');

// Export convenience functions for common operations
export const {
  setJson: setCacheJson,
  getJson: getCacheJson,
  setSession: setCacheSession,
  getSession: getCacheSession,
  deleteSession: deleteCacheSession,
  setUserCache: setUserCache,
  getUserCache: getUserCache,
  deleteUserCache: deleteUserCache,
  memoize: memoizeCache,
  healthCheck: cacheHealthCheck,
} = defaultCacheClient;
