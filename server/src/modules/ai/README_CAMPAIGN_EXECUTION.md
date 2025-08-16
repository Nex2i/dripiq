# Campaign Plan Execution Service

This document describes the campaign execution system that materializes AI-generated JSON campaign plans into executable database records using the existing schema.

## Overview

The campaign execution system bridges the gap between AI-generated campaign plans (stored as JSON) and the BullMQ-driven execution workflow. It creates the necessary scheduled actions, handles event-driven transitions, and manages campaign state using the existing database tables.

## Current Status

🚧 **Service Created but NOT ACTIVATED** 🚧

The execution service has been built and integrated but is currently **commented out** in `contactCampaignPlan.service.ts`. To activate:

1. Uncomment the execution initialization code in `persistPlan()` method
2. Uncomment the repository methods in `ScheduledActionRepository` and `OutboundMessageRepository`
3. Test with a simple campaign first

## Architecture

### Key Components

#### 1. CampaignPlanExecutionService (`campaignPlanExecution.service.ts`)
- **`initializeCampaignExecution()`** - Creates initial scheduled actions for new campaigns
- **`processTransition()`** - Handles event-driven state transitions
- **`scheduleAction()`** - Creates scheduled action records for workers
- **`scheduleNodeTimeouts()`** - Sets up synthetic timeout events (no_open, no_click)

#### 2. Schedule Utilities (`utils/scheduleUtils.ts`)
- **`parseIsoDuration()`** - Converts ISO 8601 durations to milliseconds
- **`calculateScheduleTime()`** - Respects timezone and quiet hours
- **`applyQuietHours()`** - Adjusts send times to avoid quiet periods
- **Validation functions** for durations, times, and timezones

#### 3. Database Integration
Uses existing tables without modifications:
- **`contact_campaigns`** - Campaign state and JSON plan storage
- **`scheduled_actions`** - Execution queue for BullMQ workers
- **`outbound_messages`** - Message outbox with deduplication
- **`campaign_transitions`** - Audit trail of state changes
- **`message_events`** - Engagement events from webhooks

## Data Flow

### Campaign Creation Flow
```
AI Strategy Generation
  ↓
Campaign Plan JSON Created
  ↓
campaignPlanExecutionService.initializeCampaignExecution()
  ↓
Initial scheduled_action Created (send first email)
  ↓
Campaign status → 'active'
  ↓
Timeout actions scheduled (no_open, no_click)
```

### Event-Driven Transition Flow
```
Webhook Event (open/click/bounce)
  ↓
campaignPlanExecutionService.processTransition()
  ↓
Find matching transition in plan JSON
  ↓
Create campaign_transition record
  ↓
Update current_node_id
  ↓
Schedule next action if needed
```

## Example Campaign Plan Processing

Given this campaign plan JSON:
```json
{
  "version": "1.0",
  "timezone": "America/Los_Angeles",
  "quietHours": { "start": "21:00", "end": "07:30" },
  "startNodeId": "email_intro",
  "nodes": [
    {
      "id": "email_intro",
      "action": "send",
      "subject": "Introduction to our solution",
      "body": "Hi {{name}}, ...",
      "schedule": { "delay": "PT0S" },
      "transitions": [
        { "on": "opened", "to": "wait_click", "within": "PT72H" },
        { "on": "no_open", "to": "email_bump_1", "after": "PT72H" }
      ]
    }
  ]
}
```

The execution service creates:
1. **Initial Action**: `scheduled_actions` record for "email_intro" at current time (respecting quiet hours)
2. **Timeout Actions**: `scheduled_actions` for "no_open" event 72 hours later
3. **Campaign State**: Updates `contact_campaigns.status` to 'active'

## Integration Points

### With Existing Workers
- **Send Workers**: Read `scheduled_actions` and create `outbound_messages`
- **Webhook Workers**: Process events and call `processTransition()`
- **Timeout Workers**: Generate synthetic events (no_open, no_click)

### With Campaign Plan Service
- Integrated in `contactCampaignPlan.service.persistPlan()`
- Called after campaign creation for new campaigns and plan versions
- Uses dynamic import to avoid circular dependencies

## Activation Checklist

When ready to activate this system:

### 1. Uncomment Integration Code
In `contactCampaignPlan.service.ts`:
```typescript
// Remove /* */ comments around the execution initialization block
```

### 2. Uncomment Repository Methods
In `ScheduledActionRepository.ts` and `OutboundMessageRepository.ts`:
```typescript
// Remove /* */ comments around the campaign-related methods
```

### 3. Test Campaign Scenarios
- Simple send-only campaign
- Multi-step sequence with follow-ups
- Event-driven transitions (open → next email)
- Timeout handling (no_open → bump email)

### 4. Monitor Execution
- Check `scheduled_actions` table for correct scheduling
- Verify `campaign_transitions` capture state changes
- Ensure `outbound_messages` are created by workers

## Benefits

### Immediate
- Campaigns execute automatically after creation
- Full audit trail of campaign execution
- Proper timezone and quiet hours handling
- Idempotent action scheduling

### Analytics & Insights
- Query campaign performance across structured data
- Identify successful campaign patterns
- Track execution timing and bottlenecks
- Debug campaign flow issues

### Operational
- Clear visibility into pending actions
- Ability to pause/cancel campaigns
- Graceful error handling and recovery
- Integration with existing monitoring

## Future Enhancements

### Short Term
- Enhanced timezone handling with daylight savings
- More sophisticated quiet hours (weekends, holidays)
- Campaign template patterns based on successful flows

### Medium Term
- A/B testing framework for campaign variations
- Dynamic content personalization based on engagement
- Rate limiting and deliverability optimization

### Long Term
- Machine learning-driven campaign optimization
- Cross-channel orchestration (email + SMS)
- Predictive engagement scoring

## Notes

- All campaign data remains in JSON for flexibility
- Existing schema requires no modifications
- System is designed for gradual rollout and testing
- Backward compatibility maintained throughout