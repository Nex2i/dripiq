# Configuration Constants

This directory contains configuration constants used throughout the application.

## Timeout Jobs (`timeout-jobs.ts`)

Configuration constants for campaign timeout job management.

### Key Constants

- `TIMEOUT_JOB_COMPLETE_RETENTION_SECONDS`: How long completed jobs are kept (default: 1 hour)
- `TIMEOUT_JOB_FAIL_RETENTION_SECONDS`: How long failed jobs are kept (default: 24 hours)
- `DEFAULT_NO_OPEN_TIMEOUT`: Default time to wait for email opens (default: 72 hours)
- `DEFAULT_NO_CLICK_TIMEOUT`: Default time to wait for link clicks (default: 24 hours)

### Environment-Specific Configuration

Use `getTimeoutJobOptions(environment)` for environment-specific settings:

```typescript
import { getTimeoutJobOptions } from '@/constants/timeout-jobs';

// Development: Keep more jobs for debugging
const devOptions = getTimeoutJobOptions('development');

// Production: Aggressive cleanup to save memory
const prodOptions = getTimeoutJobOptions('production');

// Default: Balanced settings
const defaultOptions = getTimeoutJobOptions();
```

### Customization

To modify timeout job behavior:

1. Update constants in `timeout-jobs.ts`
2. Add environment-specific overrides in `getTimeoutJobOptions()`
3. Consider Redis memory usage when increasing retention values

### Memory Impact

Higher retention values increase Redis memory usage:
- Each job stores ~1-2KB of metadata
- 1000 retained jobs ≈ 1-2MB Redis memory
- Monitor Redis usage in production environments