# Ticket #003: Connect Webhook Events to Campaign Transitions

**Priority**: Critical  
**Estimated Effort**: 2 days  
**Component**: `sendgrid.webhook.service.ts`  
**Status**: Open  

## Description

After storing webhook events in the database, trigger campaign transition processing to advance campaign state and schedule next actions.

## Current State

- SendGrid webhooks are received and stored in `webhook_deliveries`
- Events are normalized and stored in `message_events`
- **Missing**: No campaign advancement after webhook processing

## Problem

When recipients engage with emails (open, click), the events are captured but campaigns don't advance. The reactive campaign system depends on events triggering transitions, but this connection is missing.

## Current Flow (Broken)
1. ✅ User opens email → SendGrid webhook received
2. ✅ Webhook stored in `webhook_deliveries`
3. ✅ Event normalized and stored in `message_events`
4. ❌ **STOPS HERE** - Campaign never advances to next step

## Required Flow (Fixed)
1. ✅ User opens email → SendGrid webhook received
2. ✅ Webhook stored and events normalized
3. 🆕 **Events trigger campaign transition processing**
4. 🆕 **Campaign state updated, next actions scheduled**

## Required Changes

### 1. Update webhook processing flow

```typescript
// In sendgrid.webhook.service.ts processWebhook()
const processedEvents = await this.processEvents(tenantId, events, processedAtTimestamp);

// Update webhook delivery status
await this.updateWebhookDeliveryStatus(webhookDelivery.id, tenantId, processedEvents);

// NEW: Trigger campaign transitions for successful events
for (const eventResult of processedEvents) {
  if (eventResult.success && eventResult.messageEvent) {
    try {
      await this.processCampaignTransition(tenantId, eventResult.messageEvent);
    } catch (error) {
      logger.error('Failed to process campaign transition', {
        tenantId,
        messageEventId: eventResult.messageEvent.id,
        eventType: eventResult.messageEvent.type,
        error: error.message,
        stack: error.stack
      });
      // Don't fail webhook processing if transition fails
    }
  }
}
```

### 2. Add campaign transition processing method

```typescript
// In sendgrid.webhook.service.ts
private async processCampaignTransition(tenantId: string, messageEvent: MessageEvent) {
  logger.debug('Processing campaign transition for message event', {
    tenantId,
    messageEventId: messageEvent.id,
    eventType: messageEvent.type
  });

  // Find the campaign associated with this message
  const outboundMessage = await outboundMessageRepository.findById(messageEvent.messageId);
  if (!outboundMessage) {
    logger.debug('No outbound message found for event', { 
      messageEventId: messageEvent.id 
    });
    return;
  }

  const campaign = await contactCampaignRepository.findById(outboundMessage.campaignId);
  if (!campaign) {
    logger.debug('No campaign found for message', { 
      outboundMessageId: outboundMessage.id 
    });
    return;
  }

  if (campaign.status !== 'active') {
    logger.debug('Campaign not active, skipping transition', {
      campaignId: campaign.id,
      status: campaign.status
    });
    return;
  }

  // Trigger transition processing
  await campaignPlanExecutionService.processTransition({
    tenantId,
    campaignId: campaign.id,
    eventType: messageEvent.type,
    currentNodeId: campaign.currentNodeId,
    plan: campaign.planJson as CampaignPlanOutput,
    eventRef: messageEvent.id
  });

  logger.info('Campaign transition processed successfully', {
    tenantId,
    campaignId: campaign.id,
    eventType: messageEvent.type,
    currentNodeId: campaign.currentNodeId
  });
}
```

### 3. Add required imports

```typescript
// At top of sendgrid.webhook.service.ts
import { campaignPlanExecutionService } from '@/modules/campaign/campaignPlanExecution.service';
import { outboundMessageRepository, contactCampaignRepository } from '@/repositories';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';
```

### 4. Update error handling and logging

```typescript
// Enhanced error context for debugging
logger.error('Failed to process campaign transition', {
  tenantId,
  messageEventId: eventResult.messageEvent.id,
  eventType: eventResult.messageEvent.type,
  messageId: eventResult.messageEvent.messageId,
  webhookDeliveryId: webhookDelivery.id,
  error: error.message,
  stack: error.stack
});
```

## Files to Modify

- `server/src/modules/webhooks/sendgrid.webhook.service.ts`
- `server/src/modules/campaign/campaignPlanExecution.service.ts` (ensure processTransition works)

## Implementation Details

### Event Type Mapping
Ensure webhook event types match campaign plan transition triggers:
- SendGrid `processed` → campaign plan `delivered`
- SendGrid `delivered` → campaign plan `delivered` 
- SendGrid `open` → campaign plan `opened`
- SendGrid `click` → campaign plan `clicked`
- SendGrid `bounce` → campaign plan `bounced`
- SendGrid `unsubscribe` → campaign plan `unsubscribed`

### Error Isolation
Critical: Transition processing failures must not break webhook processing
```typescript
// Wrap in try-catch with detailed logging
// Continue processing other events if one fails
// Return success for webhook even if transitions fail
```

### Performance Considerations
- Transition processing adds latency to webhook responses
- Consider async processing for high-volume webhooks
- Monitor webhook response times and transition processing duration
- Add circuit breaker if transition service becomes unavailable

### Idempotency
- Multiple webhook deliveries for same event should not cause duplicate transitions
- Campaign transition service should handle duplicate event processing gracefully

## Testing Strategy

### Unit Tests
- Test transition triggering with various event types
- Test error handling when campaign/message not found
- Test inactive campaign handling
- Mock all repository dependencies

### Integration Tests
- End-to-end webhook → transition → next action flow
- Test with real webhook payloads from SendGrid
- Verify campaign state changes correctly
- Test error scenarios (missing campaigns, invalid plans)

### Performance Tests
- Test webhook processing latency with transition processing
- Test with high-volume webhook batches
- Verify memory usage and connection pooling

## Acceptance Criteria

- [ ] Webhook events trigger campaign transition evaluation
- [ ] Only processes events for active campaigns
- [ ] Campaign state advances when matching transitions are found
- [ ] Next actions are scheduled when transitioning to 'send' nodes
- [ ] Transition failures don't break webhook processing
- [ ] All transitions are logged in `campaign_transitions` table
- [ ] Webhook response times remain acceptable (<500ms)
- [ ] Error handling provides sufficient debugging information
- [ ] Integration works with all supported SendGrid event types

## Dependencies

- **Depends on**: Ticket #004 (complete transition processing logic)
- **Required by**: End-to-end campaign functionality
- Requires `campaignPlanExecutionService.processTransition()` method
- Needs repository methods for finding campaigns and messages

## Risk Assessment

**Medium Risk**:
- Adds processing latency to webhook responses
- Potential for cascading failures if transition service fails
- Complex integration between webhook processing and campaign logic
- Performance implications for high-volume webhooks

## Monitoring and Alerting

### Key Metrics
- Webhook processing time (before/after transition integration)
- Transition processing success/failure rates
- Campaign advancement rates after webhook events
- Queue depths for downstream campaign execution jobs

### Alerts
- High webhook processing latency (>1s)
- High transition processing failure rate (>5%)
- Campaigns stuck without advancement after events
- Missing outbound messages or campaigns for events

## Rollout Strategy

1. **Phase 1**: Deploy with feature flag, monitor webhook performance
2. **Phase 2**: Enable for subset of tenants, monitor transition success
3. **Phase 3**: Full rollout with comprehensive monitoring
4. **Rollback Plan**: Disable transition processing, maintain webhook storage