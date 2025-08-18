# Ticket #002: Implement Timeout Worker for Synthetic Events

**Priority**: Critical  
**Estimated Effort**: 2-3 days  
**Component**: New `TimeoutWorker`  
**Status**: Open  

## Description

Create a dedicated worker to process timeout jobs and generate synthetic events (`no_open`, `no_click`) when recipients don't engage within specified timeframes.

## Current State

- No timeout worker exists
- No synthetic event generation capability
- Campaigns stall after first email without follow-up triggers

## Problem

Without synthetic events, campaigns cannot advance based on time delays. The reactive campaign logic depends on events (real or synthetic) to trigger transitions. Currently, if a recipient doesn't open or click, the campaign stops forever.

## Required Implementation

### 1. Create timeout worker

```typescript
// server/src/workers/timeout/timeout.worker.ts
import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { logger } from '@/libs/logger';
import { 
  messageEventRepository, 
  campaignTransitionService 
} from '@/repositories';

export interface TimeoutJobPayload {
  tenantId: string;
  campaignId: string;
  nodeId: string;
  messageId: string;
  eventType: 'no_open' | 'no_click';
}

async function processTimeout(job: Job<TimeoutJobPayload>): Promise<void> {
  const { campaignId, nodeId, messageId, eventType, tenantId } = job.data;
  
  logger.info('Processing timeout job', {
    jobId: job.id,
    campaignId,
    nodeId,
    eventType
  });
  
  // Check if real event already happened
  const realEventType = eventType.replace('no_', ''); // no_open -> open
  const realEventExists = await messageEventRepository.findByMessageAndType(
    messageId, 
    realEventType
  );
  
  if (realEventExists) {
    logger.info('Real event found, skipping synthetic event', { 
      messageId, 
      eventType,
      realEventId: realEventExists.id
    });
    return { skipped: true, reason: 'real_event_exists' };
  }
  
  // Generate synthetic event
  const syntheticEvent = await messageEventRepository.create({
    tenantId,
    messageId,
    type: eventType, // no_open, no_click
    eventAt: new Date(),
    data: { 
      synthetic: true, 
      triggeredBy: 'timeout',
      originalJobId: job.id 
    }
  });
  
  logger.info('Created synthetic event', {
    eventId: syntheticEvent.id,
    eventType,
    messageId
  });
  
  // Trigger campaign transition processing
  await campaignTransitionService.processEvent({
    tenantId,
    campaignId,
    eventType,
    messageEventId: syntheticEvent.id
  });
  
  return { 
    success: true, 
    syntheticEventId: syntheticEvent.id 
  };
}

export const timeoutWorker = getWorker('campaign_execution', async (job) => {
  if (job.name === 'timeout') {
    return await processTimeout(job);
  }
  
  throw new Error(`Unknown job type: ${job.name}`);
});
```

### 2. Update campaign execution worker

```typescript
// server/src/workers/campaign-execution/campaign-execution.worker.ts
// Add timeout processing to existing worker

async function processCampaignExecution(job: Job): Promise<any> {
  // Handle timeout jobs
  if (job.name === 'timeout') {
    return await processTimeout(job);
  }
  
  // Existing execution logic for 'execute' jobs
  if (job.name === 'execute') {
    return await processExecution(job);
  }
  
  throw new Error(`Unknown job name: ${job.name}`);
}
```

### 3. Add repository method for event checking

```typescript
// server/src/repositories/entities/MessageEventRepository.ts
async findByMessageAndType(
  messageId: string, 
  eventType: string
): Promise<MessageEvent | null> {
  const result = await this.db
    .select()
    .from(this.table)
    .where(
      and(
        eq(this.table.messageId, messageId),
        eq(this.table.type, eventType)
      )
    )
    .limit(1);
    
  return result[0] || null;
}
```

### 4. Update worker registration

```typescript
// server/src/workers/index.ts
export { timeoutWorker } from './timeout/timeout.worker';

// server/src/workers/worker.run.ts
import { timeoutWorker, campaignCreationWorker, campaignExecutionWorker } from './index';

const activeWorkers = [timeoutWorker, campaignCreationWorker, campaignExecutionWorker];
```

## Files to Create/Modify

### New Files
- `server/src/workers/timeout/timeout.worker.ts`
- `server/src/types/timeout.types.ts`

### Modified Files
- `server/src/workers/campaign-execution/campaign-execution.worker.ts`
- `server/src/repositories/entities/MessageEventRepository.ts`
- `server/src/workers/index.ts`
- `server/src/workers/worker.run.ts`

## Implementation Details

### Event Type Mapping
- `no_open` timeout checks for existing `open` events
- `no_click` timeout checks for existing `click` events
- Case-sensitive matching: ensure event types are consistent

### Synthetic Event Metadata
Store additional context in the event data:
```json
{
  "synthetic": true,
  "triggeredBy": "timeout",
  "originalJobId": "timeout:campaign_123:node_456:no_open",
  "scheduledAt": "2024-01-01T12:00:00Z",
  "actualFiredAt": "2024-01-01T12:00:05Z"
}
```

### Error Handling Strategy
- Log all timeout processing attempts
- Don't retry if real event exists (idempotent)
- Retry on database/network failures
- Alert on systematic timeout processing failures

### Performance Considerations
- Index `message_events` on `(message_id, type)` for fast lookups
- Consider event existence check caching for high-volume campaigns
- Monitor timeout worker queue depth and processing times

## Testing Strategy

### Unit Tests
- Test synthetic event generation
- Test real event detection and skipping
- Test error handling scenarios
- Mock dependencies (repositories, transition service)

### Integration Tests
- End-to-end timeout flow with real database
- Test with various campaign plans and timing configurations
- Verify campaign transitions are triggered correctly

### Load Testing
- Test timeout worker with high job volumes
- Verify performance with large numbers of concurrent timeouts
- Test queue recovery after worker failures

## Acceptance Criteria

- [ ] Timeout worker processes jobs from campaign_execution queue
- [ ] Checks for existing real events before generating synthetic ones
- [ ] Creates synthetic `message_events` with correct metadata
- [ ] Triggers campaign transition processing after synthetic event creation
- [ ] Handles job failures gracefully with proper logging
- [ ] Skips synthetic event generation when real events exist
- [ ] Integrates properly with existing worker infrastructure
- [ ] Performance meets requirements (process 1000+ timeouts/minute)

## Dependencies

- **Depends on**: Ticket #001 (timeout job scheduling)
- **Required by**: Ticket #004 (transition processing)
- Needs `campaignTransitionService.processEvent()` method
- Requires indexed `message_events` table for performance

## Risk Assessment

**Medium Risk**: 
- New worker component with complex logic
- Integration with existing campaign execution worker
- Performance implications for high-volume campaigns
- Dependency on transition processing service

## Deployment Considerations

- Deploy worker code before enabling timeout job scheduling
- Monitor worker queue depths and processing times
- Consider gradual rollout with subset of campaigns
- Ensure proper logging and alerting for timeout processing failures