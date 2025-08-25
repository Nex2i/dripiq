# Ticket #001: Add Timeout Job Scheduling to Email Send Worker

**Priority**: Critical  
**Estimated Effort**: 1-2 days  
**Component**: `EmailExecutionService`  
**Status**: Open  

## Description

After successfully sending an email, the worker must schedule timeout jobs to generate synthetic events (`no_open`, `no_click`) if the recipient doesn't engage within the specified timeframes.

## Current State

- `EmailExecutionService.executeEmailSend()` sends emails successfully
- Updates `outbound_messages` table with send status
- **Missing**: No timeout jobs are scheduled after successful send

## Problem

Campaigns send the first email but never schedule follow-up actions. Without timeout jobs, campaigns will stall indefinitely waiting for engagement that may never come.

## Required Changes

### 1. Update `EmailExecutionService.executeEmailSend()`

```typescript
// After successful send
if (sendResult.success) {
  await this.scheduleTimeoutJobs(campaignId, nodeId, planJson, outboundMessageId);
}
```

### 2. Add `scheduleTimeoutJobs()` method

```typescript
private async scheduleTimeoutJobs(
  campaignId: string, 
  nodeId: string, 
  plan: CampaignPlanOutput,
  messageId: string
) {
  const node = plan.nodes.find(n => n.id === nodeId);
  const defaults = plan.defaults?.timers;
  
  // Schedule no_open timeout (default 72h)
  const noOpenDelay = this.parseDelay(defaults?.no_open_after || 'PT72H');
  await this.scheduleTimeoutJob({
    campaignId,
    nodeId,
    messageId,
    eventType: 'no_open',
    scheduledAt: new Date(Date.now() + noOpenDelay)
  });
  
  // Schedule no_click timeout (default 24h) 
  const noClickDelay = this.parseDelay(defaults?.no_click_after || 'PT24H');
  await this.scheduleTimeoutJob({
    campaignId,
    nodeId,
    messageId,
    eventType: 'no_click',
    scheduledAt: new Date(Date.now() + noClickDelay)
  });
}
```

### 3. Add timeout job creation

```typescript
private async scheduleTimeoutJob(params: TimeoutJobParams) {
  // Create scheduled_action record
  await scheduledActionRepository.create({
    tenantId: this.tenantId,
    campaignId: params.campaignId,
    actionType: 'timeout',
    scheduledAt: params.scheduledAt,
    payload: {
      nodeId: params.nodeId,
      messageId: params.messageId,
      eventType: params.eventType
    }
  });
  
  // Enqueue BullMQ job
  const timeoutQueue = getQueue('campaign_execution'); // or dedicated timeout queue
  await timeoutQueue.add('timeout', params, {
    delay: params.scheduledAt.getTime() - Date.now(),
    jobId: `timeout:${params.campaignId}:${params.nodeId}:${params.eventType}`
  });
}
```

### 4. Add TypeScript interfaces

```typescript
interface TimeoutJobParams {
  campaignId: string;
  nodeId: string;
  messageId: string;
  eventType: 'no_open' | 'no_click';
  scheduledAt: Date;
}
```

## Files to Modify

- `server/src/workers/campaign-execution/email-execution.service.ts`
- `server/src/modules/campaign/scheduleUtils.ts` (for delay parsing)
- `server/src/types/timeout.types.ts` (new file for interfaces)

## Implementation Notes

### ISO 8601 Duration Parsing
The system uses ISO 8601 durations (PT72H, PT24H). Ensure `parseDelay()` utility correctly converts these to milliseconds:

```typescript
// Example: PT72H = 72 hours = 72 * 60 * 60 * 1000 ms
function parseDelay(duration: string): number {
  // Implementation needed in scheduleUtils.ts
}
```

### BullMQ Job ID Strategy
Use consistent job IDs for deduplication:
- Format: `timeout:{campaignId}:{nodeId}:{eventType}`
- Prevents duplicate timeout jobs for same message

### Error Handling
- Log timeout scheduling failures but don't fail the email send
- Ensure database transactions are handled properly
- Graceful degradation if BullMQ is unavailable

## Testing Strategy

### Unit Tests
- Test timeout job creation with various delay configurations
- Test ISO 8601 duration parsing edge cases
- Test error handling when scheduling fails

### Integration Tests
- Verify scheduled_actions records are created correctly
- Verify BullMQ jobs are enqueued with correct delays
- Test with actual campaign plan JSON structures

## Acceptance Criteria

- [ ] After successful email send, timeout jobs are scheduled in `scheduled_actions` table
- [ ] BullMQ timeout jobs are enqueued with correct delays
- [ ] Timeout jobs include all necessary context (campaignId, nodeId, messageId, eventType)
- [ ] ISO 8601 duration parsing works correctly (PT72H → milliseconds)
- [ ] Job IDs are consistent and prevent duplicates
- [ ] Error handling doesn't break email sending flow
- [ ] Both no_open and no_click timeouts are scheduled appropriately

## Dependencies

- Requires `scheduleUtils.ts` utility for duration parsing
- Depends on existing `scheduledActionRepository`
- Needs BullMQ queue infrastructure (already exists)

## Risk Assessment

**Low Risk**: This is an additive change that doesn't modify existing email sending logic. If timeout scheduling fails, email sending continues to work.