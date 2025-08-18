# Ticket #005: Add Startup Recovery for Scheduled Actions

**Priority**: High  
**Estimated Effort**: 1 day  
**Component**: Server startup process  
**Status**: Open  

## Description

On server startup, rebuild any orphaned scheduled actions that were lost due to server restarts or Redis failures.

## Current State

- If server restarts, pending `scheduled_actions` are not re-enqueued to BullMQ
- Campaigns can get stuck waiting for jobs that will never execute
- No recovery mechanism for Redis failures or queue corruption

## Problem

**Scenario**: Server crashes or restarts while campaigns are running
1. ✅ Scheduled actions exist in database with `status = 'pending'`
2. ❌ Corresponding BullMQ jobs are lost (Redis restart/failure)
3. ❌ Campaigns wait forever for actions that will never execute
4. ❌ No automatic recovery mechanism

**Impact**: Campaign reliability is compromised by infrastructure failures.

## Required Implementation

### 1. Add startup recovery function

```typescript
// server/src/libs/startup-recovery.ts
import { logger } from '@/libs/logger';
import { getQueue } from '@/libs/bullmq';
import { scheduledActionRepository } from '@/repositories';
import type { ScheduledAction } from '@/db/schema';

export async function recoverScheduledActions(): Promise<RecoveryResult> {
  const startTime = Date.now();
  logger.info('Starting scheduled actions recovery...');

  try {
    // Find orphaned actions (pending but not in BullMQ)
    const orphanedActions = await scheduledActionRepository.findOrphaned();
    
    logger.info(`Found ${orphanedActions.length} orphaned scheduled actions`);

    const results = {
      total: orphanedActions.length,
      recovered: 0,
      failed: 0,
      expired: 0
    };

    for (const action of orphanedActions) {
      try {
        const result = await this.recoverScheduledAction(action);
        if (result.recovered) {
          results.recovered++;
        } else if (result.expired) {
          results.expired++;
        }
      } catch (error) {
        results.failed++;
        logger.error('Failed to recover scheduled action', {
          actionId: action.id,
          campaignId: action.campaignId,
          actionType: action.actionType,
          scheduledAt: action.scheduledAt,
          error: error.message
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Scheduled actions recovery completed', {
      ...results,
      durationMs: duration
    });

    return results;
  } catch (error) {
    logger.error('Scheduled actions recovery failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

private async recoverScheduledAction(action: ScheduledAction): Promise<RecoveryActionResult> {
  const now = new Date();
  const scheduledTime = new Date(action.scheduledAt);
  
  // Check if action is expired (more than 1 hour past due)
  const expiredThreshold = 60 * 60 * 1000; // 1 hour in ms
  if (now.getTime() - scheduledTime.getTime() > expiredThreshold) {
    logger.warn('Scheduled action expired, marking as failed', {
      actionId: action.id,
      scheduledAt: action.scheduledAt,
      ageMs: now.getTime() - scheduledTime.getTime()
    });
    
    await scheduledActionRepository.update(action.id, {
      status: 'failed',
      lastError: 'Expired during recovery'
    });
    
    return { recovered: false, expired: true };
  }

  // Calculate delay (0 if past due)
  const delay = Math.max(0, scheduledTime.getTime() - now.getTime());
  
  // Enqueue to appropriate queue
  const queue = this.getQueueForActionType(action.actionType);
  const jobId = this.generateJobId(action);
  
  await queue.add(this.getJobNameForActionType(action.actionType), {
    tenantId: action.tenantId,
    campaignId: action.campaignId,
    actionType: action.actionType,
    ...action.payload
  }, {
    delay,
    jobId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  });

  // Update action status
  await scheduledActionRepository.update(action.id, {
    status: 'queued'
  });

  logger.info('Scheduled action recovered successfully', {
    actionId: action.id,
    campaignId: action.campaignId,
    actionType: action.actionType,
    delay,
    jobId
  });

  return { recovered: true, expired: false };
}

private getQueueForActionType(actionType: string): Queue {
  switch (actionType) {
    case 'send':
    case 'timeout':
      return getQueue('campaign_execution');
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

private getJobNameForActionType(actionType: string): string {
  switch (actionType) {
    case 'send':
      return 'execute';
    case 'timeout':
      return 'timeout';
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

private generateJobId(action: ScheduledAction): string {
  const timestamp = new Date(action.scheduledAt).getTime();
  return `recovery:${action.actionType}:${action.campaignId}:${action.id}:${timestamp}`;
}

interface RecoveryResult {
  total: number;
  recovered: number;
  failed: number;
  expired: number;
}

interface RecoveryActionResult {
  recovered: boolean;
  expired: boolean;
}
```

### 2. Add repository method for finding orphaned actions

```typescript
// server/src/repositories/entities/ScheduledActionRepository.ts
import { and, eq, lte } from 'drizzle-orm';

async findOrphaned(): Promise<ScheduledAction[]> {
  const cutoffTime = new Date(Date.now() - (5 * 60 * 1000)); // 5 minutes ago
  
  return await this.db
    .select()
    .from(this.table)
    .where(
      and(
        eq(this.table.status, 'pending'),
        lte(this.table.scheduledAt, cutoffTime) // Past due by at least 5 minutes
      )
    )
    .orderBy(this.table.scheduledAt);
}

async markAsExpired(actionId: string, reason: string): Promise<void> {
  await this.update(actionId, {
    status: 'failed',
    lastError: reason
  });
}
```

### 3. Integrate with server startup

```typescript
// server/src/app.ts (or appropriate startup file)
import { recoverScheduledActions } from '@/libs/startup-recovery';

export async function createApp(): Promise<FastifyInstance> {
  const app = fastify({ logger: true });
  
  // ... existing app setup ...
  
  // Add startup recovery hook
  app.ready(async () => {
    try {
      logger.info('Starting application startup recovery...');
      await recoverScheduledActions();
      logger.info('Application startup recovery completed');
    } catch (error) {
      logger.error('Startup recovery failed, continuing anyway', {
        error: error.message
      });
      // Don't fail startup if recovery fails
    }
  });
  
  return app;
}
```

### 4. Add configuration and environment variables

```typescript
// server/src/config/recovery.config.ts
export const RECOVERY_CONFIG = {
  // How long past due before considering an action expired
  EXPIRY_THRESHOLD_MS: parseInt(process.env.RECOVERY_EXPIRY_THRESHOLD_MS || '3600000'), // 1 hour
  
  // How long past scheduled time before considering action orphaned
  ORPHAN_THRESHOLD_MS: parseInt(process.env.RECOVERY_ORPHAN_THRESHOLD_MS || '300000'), // 5 minutes
  
  // Whether to enable recovery on startup
  ENABLED: process.env.RECOVERY_ENABLED !== 'false', // Default enabled
  
  // Maximum number of actions to recover in single batch
  BATCH_SIZE: parseInt(process.env.RECOVERY_BATCH_SIZE || '1000')
};
```

## Files to Create/Modify

### New Files
- `server/src/libs/startup-recovery.ts`
- `server/src/config/recovery.config.ts`

### Modified Files
- `server/src/repositories/entities/ScheduledActionRepository.ts`
- `server/src/app.ts` (or startup file)
- `server/.env.example` (add recovery config variables)

## Implementation Details

### Recovery Strategy
1. **Find Orphaned Actions**: Query for `status = 'pending'` and `scheduled_at < now - threshold`
2. **Expiry Check**: Actions more than 1 hour overdue are marked as expired
3. **Re-enqueue**: Valid actions are re-added to BullMQ with adjusted delays
4. **Status Update**: Successfully recovered actions marked as `queued`

### Job ID Strategy
Use unique job IDs to prevent duplicates:
```
recovery:{actionType}:{campaignId}:{actionId}:{scheduledTimestamp}
```

### Error Handling
- Log all recovery attempts and results
- Don't fail server startup if recovery fails
- Mark unrecoverable actions as failed with reason
- Graceful degradation if BullMQ is unavailable

### Performance Considerations
- Batch processing for large numbers of orphaned actions
- Configurable batch sizes and thresholds
- Async processing to avoid blocking startup
- Database query optimization with proper indexes

## Testing Strategy

### Unit Tests
- Test orphaned action detection logic
- Test expiry threshold calculations
- Test job ID generation and uniqueness
- Test error handling scenarios
- Mock all external dependencies

### Integration Tests
- Test recovery with real database and Redis
- Test with various action types and timings
- Verify BullMQ job creation and scheduling
- Test server startup integration

### Chaos Testing
- Kill server during active campaigns
- Restart Redis during campaign execution
- Simulate database failures during recovery
- Test recovery with large numbers of orphaned actions

## Acceptance Criteria

- [ ] On startup, finds all pending scheduled actions with past due dates
- [ ] Re-enqueues actions to appropriate BullMQ queues with correct delays
- [ ] Updates action status to 'queued' after successful enqueue
- [ ] Marks expired actions as 'failed' with appropriate reason
- [ ] Handles enqueue failures gracefully without crashing startup
- [ ] Logs recovery statistics (actions found, recovered, failed, expired)
- [ ] Works correctly after Redis failures or server crashes
- [ ] Configurable thresholds and batch sizes
- [ ] Performance suitable for high-volume deployments

## Dependencies

- **Foundation for**: All other campaign execution tickets
- **Depends on**: Existing BullMQ and repository infrastructure
- Requires proper database indexes on `scheduled_actions` table
- Needs Redis connectivity for BullMQ operations

## Risk Assessment

**Low Risk**:
- Additive functionality that doesn't change existing behavior
- Graceful failure handling (startup continues if recovery fails)
- Read-heavy operations with minimal database impact
- Self-contained with clear boundaries

## Monitoring and Alerting

### Key Metrics
- Number of orphaned actions found on startup
- Recovery success/failure rates
- Time taken for recovery process
- Frequency of recovery operations

### Alerts
- High number of orphaned actions (indicates reliability issues)
- Recovery process failures
- Long recovery times (performance issues)
- Frequent server restarts requiring recovery

## Configuration Examples

```bash
# .env
RECOVERY_ENABLED=true
RECOVERY_EXPIRY_THRESHOLD_MS=3600000  # 1 hour
RECOVERY_ORPHAN_THRESHOLD_MS=300000   # 5 minutes  
RECOVERY_BATCH_SIZE=1000
```

## Deployment Considerations

- Deploy recovery code before enabling other campaign features
- Monitor recovery logs during initial deployment
- Consider gradual rollout with subset of servers
- Ensure proper database indexes exist before deployment
- Test recovery process in staging environment with realistic data volumes