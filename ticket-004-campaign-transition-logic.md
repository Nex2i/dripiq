# Ticket #004: Complete Campaign Transition Processing Logic

**Priority**: Critical  
**Estimated Effort**: 2-3 days  
**Component**: `CampaignPlanExecutionService`  
**Status**: Open  

## Description

Complete the transition processing logic to properly evaluate plan transitions, update campaign state, and schedule next actions when events occur.

## Current State

- `processTransition()` method exists but is incomplete
- No integration with webhook/synthetic event processing
- Missing next-action scheduling after transitions

## Problem

The core reactive logic of the campaign system is incomplete. When events occur (real or synthetic), the system needs to:
1. Find matching transitions in the campaign plan
2. Update the campaign's current state
3. Schedule the next action if required
4. Record the transition for audit purposes

Without this logic, campaigns cannot advance through their planned sequences.

## Required Implementation

### 1. Complete `processTransition()` method

```typescript
// server/src/modules/campaign/campaignPlanExecution.service.ts
async processTransition(params: ProcessTransitionParams): Promise<TransitionResult> {
  const { tenantId, campaignId, eventType, currentNodeId, plan, eventRef } = params;
  
  logger.info('Processing campaign transition', {
    tenantId,
    campaignId,
    eventType,
    currentNodeId
  });

  // Find current node in plan
  const currentNode = plan.nodes.find(n => n.id === currentNodeId);
  if (!currentNode) {
    throw new Error(`Current node not found in plan: ${currentNodeId}`);
  }

  // Find matching transition
  const transition = currentNode.transitions?.find(t => 
    t.on === eventType && this.isTransitionValid(t, eventRef)
  );

  if (!transition) {
    logger.debug('No matching transition found', { 
      currentNodeId, 
      eventType, 
      availableTransitions: currentNode.transitions?.map(t => ({ on: t.on, to: t.to }))
    });
    return { 
      success: false, 
      reason: 'no_matching_transition',
      availableTransitions: currentNode.transitions?.length || 0
    };
  }

  logger.info('Found matching transition', {
    from: currentNodeId,
    to: transition.to,
    trigger: eventType
  });

  // Update campaign state
  await contactCampaignRepository.update(campaignId, {
    currentNodeId: transition.to,
    updatedAt: new Date()
  });

  // Record transition for audit
  const transitionRecord = await campaignTransitionRepository.create({
    tenantId,
    campaignId,
    fromStatus: currentNodeId,
    toStatus: transition.to,
    reason: `Event: ${eventType}`,
    eventRef,
    occurredAt: new Date()
  });

  // Schedule next action if target node requires it
  const nextActionResult = await this.scheduleNextAction(
    tenantId, 
    campaignId, 
    transition.to, 
    plan
  );

  const result: TransitionResult = {
    success: true,
    fromNodeId: currentNodeId,
    toNodeId: transition.to,
    eventType,
    transitionId: transitionRecord.id,
    nextAction: nextActionResult
  };

  logger.info('Campaign transition completed successfully', result);
  return result;
}
```

### 2. Add next action scheduling

```typescript
private async scheduleNextAction(
  tenantId: string,
  campaignId: string, 
  nodeId: string,
  plan: CampaignPlanOutput
): Promise<NextActionResult> {
  const node = plan.nodes.find(n => n.id === nodeId);
  if (!node) {
    return { scheduled: false, reason: 'node_not_found' };
  }

  logger.debug('Evaluating next action for node', {
    nodeId,
    action: node.action,
    channel: node.channel
  });

  if (node.action === 'send') {
    return await this.scheduleSendAction(tenantId, campaignId, nodeId, node, plan);
  } else if (node.action === 'wait') {
    return await this.scheduleWaitAction(tenantId, campaignId, nodeId, node, plan);
  } else if (node.action === 'stop') {
    // Mark campaign as completed
    await contactCampaignRepository.update(campaignId, {
      status: 'completed',
      completedAt: new Date()
    });
    return { scheduled: false, reason: 'campaign_completed' };
  }

  return { scheduled: false, reason: 'unknown_action_type' };
}

private async scheduleSendAction(
  tenantId: string,
  campaignId: string,
  nodeId: string,
  node: CampaignPlanNode,
  plan: CampaignPlanOutput
): Promise<NextActionResult> {
  // Calculate delay from node schedule
  const delay = this.calculateDelay(node.schedule?.delay || 'PT0S');
  const scheduledAt = new Date(Date.now() + delay);

  // Apply quiet hours if configured
  const adjustedTime = this.applyQuietHours(scheduledAt, plan.timezone, plan.quietHours);

  // Create scheduled action
  const scheduledAction = await scheduledActionRepository.create({
    tenantId,
    campaignId,
    actionType: 'send',
    scheduledAt: adjustedTime,
    payload: { nodeId }
  });

  // Enqueue execution job
  const executionQueue = getQueue('campaign_execution');
  await executionQueue.add('execute', {
    tenantId,
    campaignId,
    nodeId,
    actionType: 'send',
    metadata: {
      triggeredBy: 'transition',
      originalScheduledAt: scheduledAt.toISOString(),
      adjustedScheduledAt: adjustedTime.toISOString()
    }
  }, {
    delay: Math.max(0, adjustedTime.getTime() - Date.now()),
    jobId: `send:${campaignId}:${nodeId}:${Date.now()}`
  });

  logger.info('Send action scheduled', {
    campaignId,
    nodeId,
    scheduledAt: adjustedTime.toISOString(),
    delay: delay
  });

  return {
    scheduled: true,
    actionType: 'send',
    scheduledAt: adjustedTime,
    scheduledActionId: scheduledAction.id
  };
}

private async scheduleWaitAction(
  tenantId: string,
  campaignId: string,
  nodeId: string,
  node: CampaignPlanNode,
  plan: CampaignPlanOutput
): Promise<NextActionResult> {
  // Wait nodes don't schedule immediate actions
  // They rely on future events (timeouts or real events) to trigger transitions
  logger.info('Entered wait state', { campaignId, nodeId });
  
  return {
    scheduled: false,
    reason: 'wait_state',
    nodeId
  };
}
```

### 3. Add transition validation

```typescript
private isTransitionValid(transition: any, eventRef?: string): boolean {
  const now = new Date();
  
  // Check timing constraints
  if (transition.within) {
    // Event must happen within specified timeframe from node start
    // TODO: Implement timing validation based on node start time
    // For now, assume valid if within constraint exists
    logger.debug('Transition has within constraint', { 
      within: transition.within 
    });
  }
  
  if (transition.after) {
    // Event must happen after specified delay from node start  
    // TODO: Implement timing validation based on node start time
    logger.debug('Transition has after constraint', { 
      after: transition.after 
    });
  }
  
  return true; // Simplified validation for initial implementation
}

private calculateDelay(duration: string): number {
  // Parse ISO 8601 duration (PT0S, PT1H, PT24H, etc.)
  return parseISODuration(duration);
}

private applyQuietHours(
  scheduledAt: Date, 
  timezone?: string, 
  quietHours?: { start: string; end: string }
): Date {
  if (!quietHours || !timezone) {
    return scheduledAt;
  }
  
  // TODO: Implement quiet hours logic
  // For now, return original time
  return scheduledAt;
}
```

### 4. Add TypeScript interfaces

```typescript
// server/src/types/campaign-transition.types.ts
export interface ProcessTransitionParams {
  tenantId: string;
  campaignId: string;
  eventType: string;
  currentNodeId: string;
  plan: CampaignPlanOutput;
  eventRef?: string;
}

export interface TransitionResult {
  success: boolean;
  fromNodeId?: string;
  toNodeId?: string;
  eventType?: string;
  transitionId?: string;
  nextAction?: NextActionResult;
  reason?: string;
  availableTransitions?: number;
}

export interface NextActionResult {
  scheduled: boolean;
  actionType?: 'send' | 'wait' | 'stop';
  scheduledAt?: Date;
  scheduledActionId?: string;
  nodeId?: string;
  reason?: string;
}
```

## Files to Modify

### Modified Files
- `server/src/modules/campaign/campaignPlanExecution.service.ts`
- `server/src/modules/campaign/scheduleUtils.ts` (for delay calculations)

### New Files
- `server/src/types/campaign-transition.types.ts`

## Implementation Details

### Transition Matching Logic
```typescript
// Find transitions that match the event type
const matchingTransitions = currentNode.transitions?.filter(t => t.on === eventType);

// If multiple matches, prioritize by:
// 1. Most specific timing constraints
// 2. Order in transitions array
// 3. First match wins
```

### Timing Constraint Implementation
```typescript
// Future enhancement: validate timing constraints
// within: "PT72H" - event must occur within 72 hours of node start
// after: "PT24H" - event must occur at least 24 hours after node start

interface TimingConstraints {
  nodeStartTime: Date;
  eventTime: Date;
  constraint: { within?: string; after?: string };
}
```

### Quiet Hours Logic
```typescript
// Future enhancement: respect quiet hours
// If scheduled time falls within quiet hours, move to next allowed time
// Consider timezone conversion and business day logic
```

### Error Recovery
- Log all transition attempts with full context
- Graceful handling of invalid plan structures
- Retry logic for database failures
- Circuit breaker for downstream service failures

## Testing Strategy

### Unit Tests
- Test transition finding with various event types
- Test next action scheduling for different node types
- Test error handling for invalid plans/nodes
- Test timing constraint validation
- Mock all repository dependencies

### Integration Tests
- End-to-end transition processing with real database
- Test with complex campaign plans (multiple branches)
- Verify campaign state updates correctly
- Test scheduled action creation and job enqueueing

### Edge Case Tests
- Invalid node references in transitions
- Missing transitions for event types
- Concurrent transition processing
- Database failures during transition processing

## Acceptance Criteria

- [ ] Processes both real and synthetic events correctly
- [ ] Updates campaign `current_node_id` when transitions occur
- [ ] Records all transitions in `campaign_transitions` table
- [ ] Schedules next send actions with correct timing
- [ ] Handles terminal nodes (stop) properly by marking campaigns complete
- [ ] Validates transition timing constraints (within/after)
- [ ] Logs all transition decisions for debugging
- [ ] Handles wait nodes appropriately (no immediate scheduling)
- [ ] Graceful error handling for invalid plans or missing nodes
- [ ] Performance suitable for high-volume campaign processing

## Dependencies

- **Required by**: Ticket #002 (timeout worker), Ticket #003 (webhook integration)
- **Depends on**: Existing repository infrastructure
- Requires `parseISODuration()` utility function
- Needs indexed database tables for performance

## Risk Assessment

**High Risk**:
- Core business logic for campaign execution
- Complex state management and timing logic
- Performance critical for campaign scalability
- Integration point for multiple system components

## Performance Considerations

- Database queries for campaign/node lookups
- Concurrent transition processing for same campaign
- Queue job creation overhead
- Logging volume for high-traffic campaigns

## Monitoring and Alerting

### Key Metrics
- Transition processing success/failure rates
- Time from event to next action scheduling
- Campaign completion rates
- Queue job creation rates

### Alerts
- High transition processing failure rate
- Campaigns stuck in non-terminal states
- Long delays in transition processing
- Invalid plan structures causing errors