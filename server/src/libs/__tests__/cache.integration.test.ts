import { describe, beforeAll, afterAll, beforeEach, it, expect, jest } from '@jest/globals';
import { cacheManager, CacheManager } from '@/libs/cache';
import { defaultCacheClient, userCacheClient } from '@/libs/cache-client';
import { authCacheRedis } from '@/cache/AuthCacheRedis';

// Mock the Redis connection for testing
jest.mock('@/libs/bullmq', () => ({
  createRedisConnection: jest.fn(() => ({
    on: jest.fn(),
    keys: jest.fn().mockResolvedValue([] as string[]),
    del: jest.fn().mockResolvedValue(1 as number),
    incrby: jest.fn().mockResolvedValue(1 as number),
    expire: jest.fn().mockResolvedValue(1 as number),
    ttl: jest.fn().mockResolvedValue(300 as number),
    info: jest.fn().mockResolvedValue('used_memory_human:1.23M' as string),
  }))
}));

// Mock cache-manager and keyv
jest.mock('cache-manager', () => ({
  createCache: jest.fn(() => ({
    set: jest.fn().mockResolvedValue(undefined as void),
    get: jest.fn().mockResolvedValue(null as any),
    del: jest.fn().mockResolvedValue(undefined as void),
    reset: jest.fn().mockResolvedValue(undefined as void),
  }))
}));

jest.mock('@keyv/redis', () => {
  return jest.fn().mockImplementation(() => ({} as any));
});

jest.mock('keyv', () => ({
  Keyv: jest.fn().mockImplementation(() => ({} as any))
}));

describe('Cache Integration Tests', () => {
  let testCacheManager: CacheManager;

  beforeAll(async () => {
    // Initialize test cache manager
    testCacheManager = new CacheManager({
      namespace: 'test',
      defaultTtl: 300,
    });
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup after tests
    try {
      await testCacheManager.clear();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Basic Cache Operations', () => {
    it('should set and get values', async () => {
      const key = 'test:basic:key';
      const value = { test: 'data', timestamp: Date.now() };

      // Mock successful set/get
      const mockCache = (testCacheManager as any).cache;
      mockCache.get.mockResolvedValueOnce(JSON.stringify(value));

      await testCacheManager.set(key, value);
      const retrieved = await testCacheManager.get(key);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining(key),
        value,
        expect.any(Number)
      );
    });

    it('should handle cache misses gracefully', async () => {
      const key = 'test:missing:key';

      // Mock cache miss
      const mockCache = (testCacheManager as any).cache;
      mockCache.get.mockResolvedValueOnce(undefined);

      const result = await testCacheManager.get(key);
      expect(result).toBeNull();
    });

    it('should delete values', async () => {
      const key = 'test:delete:key';

      await testCacheManager.del(key);

      const mockCache = (testCacheManager as any).cache;
      expect(mockCache.del).toHaveBeenCalledWith(
        expect.stringContaining(key)
      );
    });
  });

  describe('Cache Client Operations', () => {
    it('should handle JSON serialization/deserialization', async () => {
      const key = 'test:json:key';
      const value = { complex: { nested: 'object' }, array: [1, 2, 3] };

      // Mock the underlying cache manager
      const setSpy = jest.spyOn(cacheManager, 'set').mockResolvedValue();
      const getSpy = jest.spyOn(cacheManager, 'get').mockResolvedValue(JSON.stringify(value));

      await defaultCacheClient.setJson(key, value, 300);
      const result = await defaultCacheClient.getJson(key);

      expect(setSpy).toHaveBeenCalledWith(
        key,
        JSON.stringify(value),
        expect.objectContaining({ ttl: 300 })
      );
      expect(getSpy).toHaveBeenCalled();
    });

    it('should handle user-specific caching', async () => {
      const userId = 'user123';
      const key = 'preferences';
      const preferences = { theme: 'dark', language: 'en' };

      const setSpy = jest.spyOn(userCacheClient, 'setJson').mockResolvedValue();
      const getSpy = jest.spyOn(userCacheClient, 'getJson').mockResolvedValue(preferences);

      await userCacheClient.setUserCache(userId, key, preferences);
      const result = await userCacheClient.getUserCache(userId, key);

      expect(setSpy).toHaveBeenCalledWith(
        `user:${userId}:${key}`,
        preferences,
        undefined
      );
    });

    it('should handle rate limiting', async () => {
      const identifier = 'test:rate:limit';
      const expectedResult = { count: 1, remaining: 99, resetTime: expect.any(Number) };

      const incrementSpy = jest.spyOn(cacheManager, 'increment').mockResolvedValue(1);

      const result = await defaultCacheClient.incrementRateLimit(identifier, 60, 100);

      expect(incrementSpy).toHaveBeenCalledWith(
        `rate_limit:${identifier}`,
        1,
        expect.objectContaining({ ttl: 60 })
      );
      expect(result).toMatchObject({
        count: 1,
        remaining: expect.any(Number),
        resetTime: expect.any(Number)
      });
    });
  });

  describe('Auth Cache Redis', () => {
    it('should handle token operations', async () => {
      const token = 'test_token_123';

      const setJsonSpy = jest.spyOn(defaultCacheClient, 'setJson').mockResolvedValue();
      const getJsonSpy = jest.spyOn(defaultCacheClient, 'getJson').mockResolvedValue({ 
        token, 
        createdAt: Date.now() 
      });
      const deleteSessionSpy = jest.spyOn(defaultCacheClient, 'deleteSession').mockResolvedValue();

      await authCacheRedis.setToken(token);
      const retrievedToken = await authCacheRedis.getToken(token);
      await authCacheRedis.clearToken(token);

      expect(setJsonSpy).toHaveBeenCalled();
      expect(getJsonSpy).toHaveBeenCalled();
      expect(deleteSessionSpy).toHaveBeenCalled();
    });

    it('should handle auth data operations', async () => {
      const supabaseId = 'supabase_user_123';
      const authData = {
        user: { id: '123', email: 'test@example.com' } as any,
        userTenants: [{ id: 'tenant1', name: 'Test Tenant', isSuperUser: false }]
      };

      const setJsonSpy = jest.spyOn(defaultCacheClient, 'setJson').mockResolvedValue();
      const getJsonSpy = jest.spyOn(defaultCacheClient, 'getJson').mockResolvedValue({
        ...authData,
        cachedAt: Date.now()
      });

      await authCacheRedis.set(supabaseId, authData);
      const result = await authCacheRedis.get(supabaseId);

      expect(setJsonSpy).toHaveBeenCalled();
      expect(getJsonSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      const key = 'test:error:key';

      // Mock cache error
      const mockCache = (testCacheManager as any).cache;
      mockCache.get.mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await testCacheManager.get(key);
      expect(result).toBeNull();
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const key = 'test:json:error';

      // Mock invalid JSON response
      const getSpy = jest.spyOn(cacheManager, 'get').mockResolvedValue('invalid json{');

      const result = await defaultCacheClient.getJson(key);
      expect(result).toBeNull();
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const setSpy = jest.spyOn(cacheManager, 'set').mockResolvedValue();
      const getSpy = jest.spyOn(cacheManager, 'get').mockResolvedValue('test');
      const delSpy = jest.spyOn(cacheManager, 'del').mockResolvedValue();
      const getStatsSpy = jest.spyOn(cacheManager, 'getStats').mockResolvedValue({
        keys: 100,
        memory: '1.23M'
      });

      const health = await defaultCacheClient.healthCheck();

      expect(health).toMatchObject({
        status: expect.any(String),
        stats: expect.any(Object),
        latency: expect.any(Number)
      });
    });
  });

  describe('Memoization', () => {
    it('should memoize function results', async () => {
      const key = 'test:memoize';
      const expectedValue = { data: 'expensive result' };
      let callCount = 0;

      const expensiveFunction = jest.fn().mockImplementation(async () => {
        callCount++;
        return expectedValue;
      });

      // Mock cache miss first, then cache hit
      const getOrSetSpy = jest.spyOn(cacheManager, 'getOrSet').mockResolvedValue(expectedValue);

      const result1 = await defaultCacheClient.memoize(key, expensiveFunction);
      const result2 = await defaultCacheClient.memoize(key, expensiveFunction);

      expect(getOrSetSpy).toHaveBeenCalledTimes(2);
      expect(result1).toEqual(expectedValue);
      expect(result2).toEqual(expectedValue);
    });
  });
});

describe('Cache Statistics and Monitoring', () => {
  it('should provide cache statistics', async () => {
    const mockStats = {
      keys: 150,
      memory: '2.45M'
    };

    const getStatsSpy = jest.spyOn(cacheManager, 'getStats').mockResolvedValue(mockStats);

    const stats = await cacheManager.getStats();

    expect(stats).toMatchObject({
      keys: expect.any(Number),
      memory: expect.any(String)
    });
  });

  it('should handle TTL operations', async () => {
    const key = 'test:ttl';

    const expireSpy = jest.spyOn(cacheManager, 'expire').mockResolvedValue(true);
    const ttlSpy = jest.spyOn(cacheManager, 'ttl').mockResolvedValue(300);

    const expireResult = await cacheManager.expire(key, 600);
    const ttlResult = await cacheManager.ttl(key);

    expect(expireResult).toBe(true);
    expect(ttlResult).toBe(300);
  });
});