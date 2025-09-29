# Simplified Observability API

The observability system has been simplified by removing the startup module and integrating all functionality into the main index file.

## Key Changes

### ✅ **Removed**
- `startup.ts` - Complex startup module with health checks
- `ObservabilityStartup` class
- `observabilityStartup` singleton instance
- Complex health check system

### ✅ **Simplified API**

#### Core Functions
```typescript
import { 
  initializeObservability,
  getObservabilityServices,
  getLangFuseStatus,
  isObservabilityReady,
  shutdownObservability
} from '@/modules/ai';
```

#### Usage
```typescript
// 1. Initialize (creates singleton)
await initializeObservability();

// 2. Check status
const status = getLangFuseStatus();
// Returns: { initialized: boolean, available: boolean, config?: {...} }

// 3. Get services
const { langfuseService, promptService } = await getObservabilityServices();

// 4. Check if ready
const ready = isObservabilityReady();

// 5. Shutdown (optional)
await shutdownObservability();
```

## Benefits

1. **🎯 Simpler**: Single import point, fewer concepts
2. **⚡ Faster**: Less overhead, direct service access
3. **🧹 Cleaner**: Removed unused health check complexity
4. **📦 Lighter**: Fewer files, smaller bundle
5. **🔧 Easier**: More straightforward to understand and maintain

## Migration

### Before (Complex)
```typescript
import { observabilityStartup, initializeObservability } from '@/modules/ai';

await initializeObservability();
const health = await observabilityStartup.performHealthChecks();
if (health.some(check => !check.healthy)) {
  throw new Error('Unhealthy services');
}
```

### After (Simple)
```typescript
import { initializeObservability, getLangFuseStatus } from '@/modules/ai';

await initializeObservability();
const status = getLangFuseStatus();
if (!status.available) {
  throw new Error('LangFuse not available');
}
```

The new API provides all the essential functionality while being much simpler to use and understand.