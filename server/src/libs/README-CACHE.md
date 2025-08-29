# Cache Manager Service

A comprehensive Redis-based cache manager that integrates with the existing BullMQ Redis connection using cache-manager and KeyvRedis.

## Overview

This cache manager provides:
- **Shared Redis Connection**: Uses the same ioredis connection as BullMQ for efficient resource utilization
- **Easy-to-use Interface**: Multiple client interfaces for different use cases
- **Type Safety**: Full TypeScript support with generics
- **Advanced Features**: Rate limiting, session management, memoization, and more
- **Error Handling**: Graceful error handling with fallback strategies

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Your App      │    │  Cache Manager  │    │   Redis         │
│                 │    │                 │    │                 │
│ ├─ API Routes   │───▶│ ├─ CacheManager │───▶│ ├─ ioredis      │
│ ├─ Services     │    │ ├─ CacheClient  │    │ │   connection  │
│ └─ Workers      │    │ └─ AuthCache    │    │ └─ (shared with │
│                 │    │                 │    │     BullMQ)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### Basic Usage

```typescript
import { cacheSet, cacheGet, cacheGetOrSet } from '@/libs/cache';

// Simple cache operations
await cacheSet('user:123', { name: 'John', email: 'john@example.com' }, { ttl: 3600 });
const user = await cacheGet('user:123');

// Cache or fetch pattern
const expensiveData = await cacheGetOrSet(
  'expensive:calculation',
  async () => {
    // Expensive operation here
    return await performExpensiveCalculation();
  },
  { ttl: 1800 }
);
```

### JSON Cache Client

```typescript
import { setCacheJson, getCacheJson, defaultCacheClient } from '@/libs/cache-client';

// JSON serialization/deserialization
await setCacheJson('config:settings', { theme: 'dark', lang: 'en' }, 3600);
const settings = await getCacheJson('config:settings');

// Session management
await defaultCacheClient.setSession('sess_123', {
  userId: '456',
  role: 'admin',
  permissions: ['read', 'write']
}, 7200);

const session = await defaultCacheClient.getSession('sess_123');
```

### User-Specific Caching

```typescript
import { setUserCache, getUserCache, userCacheClient } from '@/libs/cache-client';

// User-specific cache
await setUserCache('123', 'preferences', { theme: 'dark', notifications: true });
const preferences = await getUserCache('123', 'preferences');

// Delete all user cache
await userCacheClient.deleteUserCache('123');
```

## Available Clients

### 1. Core Cache Manager (`@/libs/cache`)

The low-level cache manager with direct Redis operations:

```typescript
import { cacheManager, cacheSet, cacheGet, cacheDel } from '@/libs/cache';

// Direct usage
await cacheSet('key', 'value', { ttl: 300 });
const value = await cacheGet('key');
await cacheDel('key');

// Advanced operations
await cacheManager.increment('counter:api_calls', 1);
await cacheManager.expire('temp:data', 600);
const stats = await cacheManager.getStats();
```

### 2. High-Level Cache Client (`@/libs/cache-client`)

Feature-rich client with common patterns:

```typescript
import { 
  defaultCacheClient, 
  userCacheClient, 
  apiCacheClient, 
  sessionCacheClient 
} from '@/libs/cache-client';

// Memoization
const result = await defaultCacheClient.memoize(
  'expensive:operation',
  () => performExpensiveOperation(),
  3600
);

// Rate limiting
const { count, remaining } = await defaultCacheClient.incrementRateLimit(
  'api:user:123',
  60,  // window in seconds
  100  // limit
);

// Feature flags
await defaultCacheClient.setFeatureFlag('new_ui', true);
const isEnabled = await defaultCacheClient.getFeatureFlag('new_ui');
```

### 3. Auth Cache (`@/cache/AuthCacheRedis`)

Redis-based authentication cache (replaces in-memory version):

```typescript
import { authCacheRedis } from '@/cache/AuthCacheRedis';

// Token management
await authCacheRedis.setToken('jwt_token_123');
const token = await authCacheRedis.getToken('jwt_token_123');
await authCacheRedis.clearToken('jwt_token_123');

// User auth data
await authCacheRedis.set('supabase_user_123', {
  user: { id: '123', email: 'user@example.com' },
  userTenants: [{ id: 'tenant1', name: 'Company', isSuperUser: false }]
});

const authData = await authCacheRedis.get('supabase_user_123');
```

## Common Patterns

### 1. Cache-Aside Pattern

```typescript
async function getUser(id: string) {
  // Try cache first
  let user = await getCacheJson(`user:${id}`);
  
  if (!user) {
    // Cache miss - fetch from database
    user = await database.getUser(id);
    
    // Store in cache
    if (user) {
      await setCacheJson(`user:${id}`, user, 3600);
    }
  }
  
  return user;
}
```

### 2. Write-Through Pattern

```typescript
async function updateUser(id: string, data: UserData) {
  // Update database
  const user = await database.updateUser(id, data);
  
  // Update cache
  await setCacheJson(`user:${id}`, user, 3600);
  
  return user;
}
```

### 3. Cache Warming

```typescript
import { defaultCacheClient } from '@/libs/cache-client';

// Warm cache with frequently accessed data
await defaultCacheClient.warmCache([
  {
    key: 'popular:products',
    fetcher: () => database.getPopularProducts(),
    ttl: 1800
  },
  {
    key: 'config:app_settings',
    fetcher: () => database.getAppSettings(),
    ttl: 3600
  }
]);
```

### 4. Bulk Operations

```typescript
// Bulk set
await defaultCacheClient.bulkSet([
  { key: 'user:1', value: { name: 'John' }, ttl: 3600 },
  { key: 'user:2', value: { name: 'Jane' }, ttl: 3600 }
]);

// Bulk get
const users = await defaultCacheClient.bulkGet(['user:1', 'user:2']);
```

## Configuration

### Environment Variables

The cache manager uses the same Redis configuration as BullMQ:

```bash
REDIS_URL=redis://localhost:6379
BULLMQ_PREFIX=dripiq  # Optional: namespace for all cache keys
```

### Custom Configuration

```typescript
import { CacheManager } from '@/libs/cache';

const customCache = new CacheManager({
  defaultTtl: 1800,      // 30 minutes default TTL
  maxKeys: 50000,        // Maximum keys (informational)
  namespace: 'myapp'     // Custom namespace
});
```

## Advanced Features

### Rate Limiting

```typescript
// API rate limiting
const limit = await defaultCacheClient.incrementRateLimit(
  `api:${userIp}`,
  60,   // 1 minute window
  100   // 100 requests max
);

if (limit.remaining <= 0) {
  throw new Error('Rate limit exceeded');
}
```

### Memoization

```typescript
// Automatic memoization of expensive functions
const memoizedFunction = (userId: string) => 
  defaultCacheClient.memoize(
    `user:${userId}:profile`,
    () => fetchUserProfile(userId),
    3600
  );
```

### Health Monitoring

```typescript
// Check cache health
const health = await defaultCacheClient.healthCheck();
console.log('Cache status:', health.status);
console.log('Latency:', health.latency, 'ms');

// Get cache statistics
const stats = await cacheManager.getStats();
console.log('Cached keys:', stats.keys);
console.log('Memory usage:', stats.memory);
```

## Error Handling

The cache manager includes comprehensive error handling:

```typescript
// Graceful degradation
async function getDataWithFallback(key: string) {
  try {
    const cached = await getCacheJson(key);
    if (cached) return cached;
  } catch (error) {
    console.error('Cache error, falling back to database:', error);
  }
  
  // Fallback to database
  return await database.getData(key);
}
```

## Integration Examples

### With Fastify Routes

```typescript
// In your route handler
fastify.get('/api/users/:id', async (request, reply) => {
  const { id } = request.params;
  
  const user = await defaultCacheClient.memoize(
    `user:${id}`,
    () => userService.getUser(id),
    3600
  );
  
  return user;
});
```

### With Services

```typescript
class UserService {
  async getUser(id: string) {
    return userCacheClient.memoize(
      `profile:${id}`,
      () => this.fetchFromDatabase(id),
      3600
    );
  }
  
  async invalidateUser(id: string) {
    await userCacheClient.deleteUserCache(id);
  }
}
```

### With Workers

```typescript
// In a worker
import { cacheSet, cacheGet } from '@/libs/cache';

const processJob = async (job: Job) => {
  const cacheKey = `job:${job.id}:result`;
  
  // Check if already processed
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;
  
  // Process job
  const result = await performProcessing(job.data);
  
  // Cache result
  await cacheSet(cacheKey, result, { ttl: 3600 });
  
  return result;
};
```

## Migration from In-Memory Cache

The project has been migrated from the old in-memory AuthCache to the Redis-based AuthCacheRedis:

```typescript
// Current implementation
import { authCache } from '@/cache/AuthCacheRedis';

// All methods are now async
await authCache.setToken(token);
const user = await authCache.get(supabaseId);
await authCache.clearToken(token);
```

## Performance Tips

1. **Use appropriate TTLs**: Longer for static data, shorter for dynamic data
2. **Batch operations**: Use `bulkSet`/`bulkGet` for multiple keys
3. **Cache warming**: Pre-populate cache for frequently accessed data
4. **Monitor metrics**: Use `getStats()` and `healthCheck()` for monitoring
5. **Namespace properly**: Use prefixes to organize related data

## Troubleshooting

### Common Issues

1. **Redis connection errors**: Ensure `REDIS_URL` is set correctly
2. **Memory usage**: Monitor with `getStats()` and adjust TTLs
3. **Cache misses**: Check key naming and TTL configuration
4. **Type errors**: Ensure proper TypeScript types for cached data

### Debugging

```typescript
// Enable debug logging
import { logger } from '@/libs/logger';

// The cache manager automatically logs debug information
// Check logs for cache hits/misses and errors
```

## Files Structure

```
src/
├── libs/
│   ├── cache.ts              # Core cache manager
│   ├── cache-client.ts       # High-level client interface
│   └── README-CACHE.md       # This documentation
└── cache/
    └── AuthCacheRedis.ts     # Redis-based auth cache
```

This cache manager provides a robust, scalable caching solution that integrates seamlessly with your existing Redis infrastructure while offering multiple interfaces for different use cases.