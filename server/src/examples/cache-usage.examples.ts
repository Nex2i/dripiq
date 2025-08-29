/**
 * Cache Usage Examples
 * 
 * This file demonstrates how to use the cache manager throughout the codebase.
 * These are examples and should not be imported directly in production code.
 */

import { 
  cacheManager,
  cacheGet,
  cacheSet,
  cacheGetOrSet,
  cacheIncrement 
} from '@/libs/cache';

import { 
  defaultCacheClient,
  userCacheClient,
  apiCacheClient,
  setCacheJson,
  getCacheJson,
  memoizeCache,
  setUserCache,
  getUserCache
} from '@/libs/cache-client';

// ==========================================
// BASIC CACHE OPERATIONS
// ==========================================

async function basicCacheExamples() {
  // Simple string caching
  await cacheSet('user:123:name', 'John Doe', { ttl: 3600 });
  const userName = await cacheGet<string>('user:123:name');
  
  // JSON object caching
  const userData = { id: 123, name: 'John Doe', email: 'john@example.com' };
  await setCacheJson('user:123:profile', userData, 3600);
  const profile = await getCacheJson<typeof userData>('user:123:profile');
  
  // Cache or fetch pattern
  const expensiveData = await cacheGetOrSet(
    'expensive:operation:123',
    async () => {
      // Simulate expensive operation
      console.log('Performing expensive operation...');
      return { result: 'complex calculation result', timestamp: Date.now() };
    },
    { ttl: 1800 } // 30 minutes
  );
}

// ==========================================
// USER-SPECIFIC CACHING
// ==========================================

async function userCacheExamples() {
  const userId = '123';
  
  // Cache user preferences
  await setUserCache(userId, 'preferences', {
    theme: 'dark',
    language: 'en',
    notifications: true
  }, 24 * 60 * 60); // 24 hours
  
  // Get user preferences
  const preferences = await getUserCache(userId, 'preferences');
  
  // Cache user's recent activity
  await userCacheClient.setJson(`${userId}:recent_activity`, [
    { action: 'login', timestamp: Date.now() },
    { action: 'view_dashboard', timestamp: Date.now() - 1000 }
  ], 60 * 60); // 1 hour
}

// ==========================================
// API RESPONSE CACHING
// ==========================================

async function apiCacheExamples() {
  // Cache API responses
  const cacheApiResponse = async (endpoint: string, params: any) => {
    const cacheKey = `api:${endpoint}:${JSON.stringify(params)}`;
    
    return memoizeCache(
      cacheKey,
      async () => {
        console.log(`Fetching from API: ${endpoint}`);
        // Simulate API call
        return { data: 'api response', timestamp: Date.now() };
      },
      600 // 10 minutes
    );
  };
  
  // Usage
  const response1 = await cacheApiResponse('/users', { page: 1, limit: 10 });
  const response2 = await cacheApiResponse('/users', { page: 1, limit: 10 }); // From cache
}

// ==========================================
// SESSION MANAGEMENT
// ==========================================

async function sessionCacheExamples() {
  const sessionId = 'sess_123456789';
  
  // Store session data
  await defaultCacheClient.setSession(sessionId, {
    userId: '123',
    role: 'admin',
    loginTime: Date.now(),
    permissions: ['read', 'write', 'delete']
  }, 60 * 60 * 2); // 2 hours
  
  // Retrieve session data
  const sessionData = await defaultCacheClient.getSession(sessionId);
  
  // Clean up session
  await defaultCacheClient.deleteSession(sessionId);
}

// ==========================================
// RATE LIMITING
// ==========================================

async function rateLimitingExamples() {
  const userIp = '192.168.1.1';
  const apiKey = 'key_123';
  
  // Rate limit by IP (100 requests per minute)
  const ipLimit = await defaultCacheClient.incrementRateLimit(
    `ip:${userIp}`,
    60, // 1 minute window
    100 // 100 requests limit
  );
  
  if (ipLimit.remaining <= 0) {
    throw new Error('Rate limit exceeded');
  }
  
  // Rate limit by API key (1000 requests per hour)
  const apiLimit = await defaultCacheClient.incrementRateLimit(
    `api:${apiKey}`,
    3600, // 1 hour window
    1000 // 1000 requests limit
  );
  
  console.log(`API calls remaining: ${apiLimit.remaining}`);
}

// ==========================================
// FEATURE FLAGS
// ==========================================

async function featureFlagExamples() {
  // Set feature flags
  await defaultCacheClient.setFeatureFlag('new_dashboard', true, 60 * 15); // 15 minutes
  await defaultCacheClient.setFeatureFlag('beta_feature', false, 60 * 60); // 1 hour
  
  // Check feature flags
  const isDashboardEnabled = await defaultCacheClient.getFeatureFlag('new_dashboard');
  const isBetaEnabled = await defaultCacheClient.getFeatureFlag('beta_feature', false);
  
  if (isDashboardEnabled) {
    console.log('Showing new dashboard');
  }
}

// ==========================================
// BULK OPERATIONS
// ==========================================

async function bulkOperationsExamples() {
  // Bulk set multiple cache entries
  await defaultCacheClient.bulkSet([
    { key: 'config:app_name', value: 'DripIQ', ttl: 3600 },
    { key: 'config:version', value: '1.0.0', ttl: 3600 },
    { key: 'config:maintenance', value: 'false', ttl: 300 }
  ]);
  
  // Bulk get multiple cache entries
  const configs = await defaultCacheClient.bulkGet([
    'config:app_name',
    'config:version',
    'config:maintenance'
  ]);
  
  console.log('App configs:', configs);
}

// ==========================================
// CACHE WARMING
// ==========================================

async function cacheWarmingExamples() {
  // Warm cache with frequently accessed data
  await defaultCacheClient.warmCache([
    {
      key: 'popular:users',
      fetcher: async () => {
        // Simulate database query
        return [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' }
        ];
      },
      ttl: 1800
    },
    {
      key: 'popular:posts',
      fetcher: async () => {
        // Simulate expensive query
        return [
          { id: 1, name: 'post1' },
          { id: 2, name: 'post2' },
          { id: 3, name: 'post3' }
        ];
      },
      ttl: 900
    }
  ]);
}

// ==========================================
// COUNTERS AND METRICS
// ==========================================

async function counterExamples() {
  const today = new Date().toISOString().split('T')[0];
  
  // Track daily API calls
  const dailyApiCalls = await cacheIncrement(`metrics:api_calls:${today}`, 1, {
    ttl: 24 * 60 * 60 // 24 hours
  });
  
  // Track user login count
  const userLoginCount = await cacheIncrement('metrics:user:123:logins', 1, {
    ttl: 30 * 24 * 60 * 60 // 30 days
  });
  
  console.log(`API calls today: ${dailyApiCalls}`);
  console.log(`User login count: ${userLoginCount}`);
}

// ==========================================
// CACHE INVALIDATION
// ==========================================

async function cacheInvalidationExamples() {
  // Set cache with tags for grouped invalidation
  await defaultCacheClient.setWithTags(
    'user:123:profile',
    { name: 'John', email: 'john@example.com' },
    ['user:123', 'profiles'],
    3600
  );
  
  await defaultCacheClient.setWithTags(
    'user:123:settings',
    { theme: 'dark', lang: 'en' },
    ['user:123', 'settings'],
    3600
  );
  
  // Invalidate all cache entries tagged with 'user:123'
  await defaultCacheClient.invalidateByTag('user:123');
}

// ==========================================
// ERROR HANDLING AND MONITORING
// ==========================================

async function monitoringExamples() {
  // Health check
  const health = await defaultCacheClient.healthCheck();
  console.log('Cache health:', health);
  
  // Cache statistics
  const stats = await cacheManager.getStats();
  console.log('Cache stats:', stats);
  
  // Graceful error handling
  try {
    const data = await getCacheJson('potentially:missing:key');
    if (data) {
      console.log('Cache hit:', data);
    } else {
      console.log('Cache miss, fetching from source...');
      // Fallback to database or API
    }
  } catch (error) {
    console.error('Cache error, using fallback:', error);
    // Always have a fallback strategy
  }
}

// ==========================================
// MIDDLEWARE PATTERN FOR CACHING
// ==========================================

function createCacheMiddleware(prefix: string, defaultTtl: number = 300) {
  return {
    async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
      const fullKey = `${prefix}:${key}`;
      
      try {
        const cached = await getCacheJson<T>(fullKey);
        if (cached !== null) {
          return cached;
        }
        
        const data = await fetcher();
        await setCacheJson(fullKey, data, ttl || defaultTtl);
        return data;
      } catch (error) {
        console.error(`Cache middleware error for ${fullKey}:`, error);
        // Fallback to direct fetcher call
        return fetcher();
      }
    },
    
    async invalidate(key: string): Promise<void> {
      const fullKey = `${prefix}:${key}`;
      await cacheManager.del(fullKey);
    }
  };
}

// Usage of middleware pattern
async function middlewarePatternExample() {
  const userCache = createCacheMiddleware('users', 600); // 10 minutes default
  const campaignCache = createCacheMiddleware('campaigns', 300); // 5 minutes default
  
  // Cache user data
  const user = await userCache.getOrSet(
    '123',
    async () => {
      console.log('Fetching user from database...');
      return { id: 123, name: 'John Doe', email: 'john@example.com' };
    }
  );
  
  // Cache campaign data with custom TTL
  const campaign = await campaignCache.getOrSet(
    'campaign_456',
    async () => {
      console.log('Fetching campaign from database...');
      return { id: 456, name: 'Summer Sale', status: 'active' };
    },
    1800 // 30 minutes
  );
  
  // Invalidate specific cache
  await userCache.invalidate('123');
}

export {
  basicCacheExamples,
  userCacheExamples,
  apiCacheExamples,
  sessionCacheExamples,
  rateLimitingExamples,
  featureFlagExamples,
  bulkOperationsExamples,
  cacheWarmingExamples,
  counterExamples,
  cacheInvalidationExamples,
  monitoringExamples,
  middlewarePatternExample,
  createCacheMiddleware
};