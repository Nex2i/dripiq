# Ticket 02: BullMQ Infrastructure Setup

**Epic**: Foundation (Phase 1)  
**Story Points**: 5  
**Priority**: Critical  
**Dependencies**: None

## Objective

Set up Redis and BullMQ infrastructure to handle distributed job processing for campaign orchestration. This includes queue configuration, connection management, and the foundation for worker processes.

## Acceptance Criteria

- [ ] Redis connection configured and tested
- [ ] BullMQ queues created with proper configuration
- [ ] Job idempotency mechanisms in place
- [ ] Queue monitoring and admin interface setup
- [ ] Error handling and retry policies configured
- [ ] Development and production configurations

## Technical Requirements

### BullMQ Queues to Create

1. **`outreach:send`** - Email/SMS sending with rate limiting
2. **`outreach:timeout`** - Synthetic event generation (no-open, no-click)
3. **`webhook:process`** - Webhook payload processing and normalization

### Key Features

- **Idempotency**: All jobs must use unique `jobId` to prevent duplicates
- **Rate Limiting**: Per-tenant and per-sender rate controls
- **Retry Logic**: Exponential backoff for failed jobs
- **Monitoring**: Admin UI and metrics collection

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd server
npm install bullmq ioredis
npm install --save-dev @types/ioredis
```

### Step 2: Redis Configuration

Create `server/src/config/redis.config.ts`:

```typescript
import { ConnectionOptions } from 'bullmq';

const redisConfig: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

export { redisConfig };
```

### Step 3: Queue Configuration

Create `server/src/libs/bullmq/queue.config.ts`:

```typescript
import { QueueOptions, WorkerOptions } from 'bullmq';
import { redisConfig } from '../../config/redis.config';

// Base queue configuration
const baseQueueConfig: QueueOptions = {
  connection: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// Base worker configuration
const baseWorkerConfig: WorkerOptions = {
  connection: redisConfig,
  concurrency: 5, // Adjust based on needs
  maxStalledCount: 1,
  stalledInterval: 30000,
  autorun: false, // Start manually
};

// Queue-specific configurations
export const queueConfigs = {
  'outreach:send': {
    ...baseQueueConfig,
    defaultJobOptions: {
      ...baseQueueConfig.defaultJobOptions,
      delay: 0, // No default delay, handled by scheduled_actions
      priority: 1,
    },
  },
  'outreach:timeout': {
    ...baseQueueConfig,
    defaultJobOptions: {
      ...baseQueueConfig.defaultJobOptions,
      delay: 0,
      priority: 2, // Lower priority than sends
    },
  },
  'webhook:process': {
    ...baseQueueConfig,
    defaultJobOptions: {
      ...baseQueueConfig.defaultJobOptions,
      delay: 0,
      priority: 0, // Highest priority for real-time processing
    },
  },
};

export const workerConfigs = {
  'outreach:send': {
    ...baseWorkerConfig,
    concurrency: 3, // Conservative for rate limiting
  },
  'outreach:timeout': {
    ...baseWorkerConfig,
    concurrency: 2,
  },
  'webhook:process': {
    ...baseWorkerConfig,
    concurrency: 10, // High concurrency for webhook processing
  },
};
```

### Step 4: Queue Manager

Create `server/src/libs/bullmq/queue.manager.ts`:

```typescript
import { Queue, QueueEvents } from 'bullmq';
import { queueConfigs } from './queue.config';
import { logger } from '../logger';

export type QueueName = 'outreach:send' | 'outreach:timeout' | 'webhook:process';

class QueueManager {
  private queues = new Map<QueueName, Queue>();
  private queueEvents = new Map<QueueName, QueueEvents>();

  async initialize() {
    for (const [queueName, config] of Object.entries(queueConfigs)) {
      const queue = new Queue(queueName, config);
      const queueEvents = new QueueEvents(queueName, { connection: config.connection });

      // Set up event listeners
      queueEvents.on('completed', ({ jobId, returnvalue }) => {
        logger.info(`Job ${jobId} completed in queue ${queueName}`, { returnvalue });
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        logger.error(`Job ${jobId} failed in queue ${queueName}`, { failedReason });
      });

      queueEvents.on('stalled', ({ jobId }) => {
        logger.warn(`Job ${jobId} stalled in queue ${queueName}`);
      });

      this.queues.set(queueName as QueueName, queue);
      this.queueEvents.set(queueName as QueueName, queueEvents);
    }

    logger.info('BullMQ queues initialized');
  }

  getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    return queue;
  }

  async enqueueJob<T = any>(
    queueName: QueueName, 
    jobName: string, 
    data: T, 
    options?: {
      jobId?: string;
      delay?: number;
      priority?: number;
    }
  ) {
    const queue = this.getQueue(queueName);
    
    // Ensure jobId is provided for idempotency
    if (!options?.jobId) {
      throw new Error('jobId is required for all jobs to ensure idempotency');
    }

    return await queue.add(jobName, data, {
      jobId: options.jobId,
      delay: options.delay,
      priority: options.priority,
    });
  }

  async getQueueStats(queueName: QueueName) {
    const queue = this.getQueue(queueName);
    return {
      waiting: await queue.getWaiting(),
      active: await queue.getActive(),
      completed: await queue.getCompleted(),
      failed: await queue.getFailed(),
      delayed: await queue.getDelayed(),
    };
  }

  async close() {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    for (const queueEvents of this.queueEvents.values()) {
      await queueEvents.close();
    }
    logger.info('BullMQ queues closed');
  }
}

export const queueManager = new QueueManager();
```

### Step 5: Job Types and Interfaces

Create `server/src/libs/bullmq/job.types.ts`:

```typescript
// Job data interfaces
export interface SendJobData {
  tenantId: string;
  scheduledActionId: string;
  campaignId: string;
  contactId: string;
  nodeId: string;
  channel: 'email' | 'sms';
}

export interface TimeoutJobData {
  tenantId: string;
  campaignId: string;
  contactId: string;
  nodeId: string;
  eventType: 'no_open' | 'no_click';
  scheduledAt: string; // ISO timestamp
}

export interface WebhookJobData {
  tenantId: string;
  webhookDeliveryId: string;
  provider: 'sendgrid';
  payload: any;
}

// Job result interfaces
export interface SendJobResult {
  success: boolean;
  messageId?: string;
  providerId?: string;
  error?: string;
}

export interface TimeoutJobResult {
  success: boolean;
  eventsCreated: number;
  transitionsTriggered: number;
}

export interface WebhookJobResult {
  success: boolean;
  eventsProcessed: number;
  transitionsTriggered: number;
}
```

### Step 6: Rate Limiting

Create `server/src/libs/bullmq/rate.limiter.ts`:

```typescript
import { Redis } from 'ioredis';
import { redisConfig } from '../../config/redis.config';

export class RateLimiter {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(redisConfig);
  }

  async checkRateLimit(
    key: string, 
    limit: number, 
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const pipeline = this.redis.pipeline();
    const now = Date.now();
    const window = windowSeconds * 1000;
    const cutoff = now - window;

    // Remove old entries and add current request
    pipeline.zremrangebyscore(key, 0, cutoff);
    pipeline.zadd(key, now, now);
    pipeline.zcard(key);
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();
    const count = results![2][1] as number;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetTime: now + window,
    };
  }

  async getRateLimitConfig(tenantId: string, channel: 'email' | 'sms') {
    // This would typically come from database
    // For now, return defaults
    const defaults = {
      email: {
        perMinute: 20,
        perHour: 1000,
        perDay: 10000,
      },
      sms: {
        perMinute: 10,
        perHour: 500,
        perDay: 5000,
      },
    };

    return defaults[channel];
  }

  async close() {
    await this.redis.disconnect();
  }
}
```

### Step 7: Queue Initialization

Update `server/src/index.ts` to initialize queues:

```typescript
import { queueManager } from './libs/bullmq/queue.manager';

// Add to server startup
async function startServer() {
  try {
    // Initialize BullMQ
    await queueManager.initialize();
    
    // Existing server setup...
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await queueManager.close();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}
```

## File Structure

```
server/src/
├── config/
│   └── redis.config.ts              # Redis connection config
├── libs/
│   └── bullmq/
│       ├── queue.config.ts          # Queue configurations
│       ├── queue.manager.ts         # Queue management
│       ├── job.types.ts             # Job data interfaces
│       └── rate.limiter.ts          # Rate limiting logic
└── workers/                         # Worker implementations (created in later tickets)
    ├── send.worker.ts
    ├── timeout.worker.ts
    └── webhook.worker.ts
```

## Environment Variables

Add to `.env` files:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# BullMQ Configuration  
BULLMQ_ADMIN_PASSWORD=secure_password_here
```

## Testing Requirements

No unit tests at this time.

## Performance Considerations

### Queue Settings
- **Concurrency**: Start conservative, tune based on load
- **Job Retention**: Balance between debugging and memory usage
- **Connection Pooling**: Redis connection reuse

### Monitoring
- Queue depth alerts
- Failed job notifications  
- Processing time metrics
- Rate limit hit tracking

## Rollback Plan

1. **Before deployment**: Test Redis connectivity
2. **During deployment**: Monitor queue initialization errors
3. **After deployment**: Verify jobs are being processed
4. **Emergency**: Disable queue processing, process jobs manually

## Admin Interface (Optional)

For development/debugging, consider adding Bull Dashboard:

```bash
npm install @bull-board/api @bull-board/fastify
```

## References

- BullMQ docs: https://docs.bullmq.io/
- Redis configuration: https://redis.io/docs/
- Current server setup: `server/src/index.ts`

## Definition of Done

- [ ] Redis connection working in all environments
- [ ] All three queues created and configured
- [ ] Job idempotency enforced with unique jobId
- [ ] Rate limiting infrastructure ready
- [ ] Queue monitoring and error handling in place
- [ ] Documentation updated
- [ ] Code review completed
