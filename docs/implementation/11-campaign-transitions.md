# Ticket 11: Campaign Transitions Implementation

**Epic**: Event Processing (Phase 3)  
**Story Points**: 10  
**Priority**: Critical  
**Dependencies**: 05-campaign-plans, 08-timeout-worker, 09-webhook-ingestion, 10-message-events

## Objective

Implement the reactive campaign state machine that processes engagement events (opens, clicks, bounces) and timeout events (no-open, no-click) to automatically advance campaigns through their planned sequences, schedule follow-up actions, and update campaign status.

## Acceptance Criteria

- [ ] Event-driven state transitions based on campaign plan JSON
- [ ] Support for "opened", "clicked", "bounced", "unsubscribed" events
- [ ] Support for synthetic "no_open", "no_click" timeout events  
- [ ] Automatic scheduling of next campaign actions
- [ ] Campaign completion detection and status updates
- [ ] Audit trail of all state transitions
- [ ] Idempotent transition processing
- [ ] Proper handling of late/out-of-order events

## Technical Requirements

### Supported Event Types

1. **Engagement Events**: `opened`, `clicked`
2. **Delivery Events**: `delivered`, `bounced`, `blocked`
3. **Suppression Events**: `unsubscribed`, `spamreport`
4. **Synthetic Events**: `no_open`, `no_click` (from timeout worker)

### State Machine Logic

- **Node-based**: Campaign plans define nodes with transitions
- **Event-driven**: Events trigger transitions between nodes
- **Time-based**: Timeouts generate synthetic events
- **Terminal states**: "completed", "stopped", "error"

## Implementation Steps

### Step 1: Campaign State Manager

Create `server/src/services/campaigns/state.manager.ts`:

```typescript
import { db } from '../../db';
import { 
  contactCampaigns,
  campaignTransitions,
  scheduledActions,
  messageEvents
} from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../../libs/logger';
import { queueManager } from '../../libs/bullmq/queue.manager';
import { createId } from '@paralleldrive/cuid2';

interface CampaignPlan {
  version: string;
  timezone: string;
  quietHours: { start: string; end: string };
  nodes: CampaignNode[];
  startNodeId: string;
}

interface CampaignNode {
  id: string;
  channel: 'email' | 'sms';
  action: 'send' | 'wait';
  subject?: string;
  body?: string;
  schedule?: { delay: string };
  transitions: CampaignTransition[];
}

interface CampaignTransition {
  on: string; // Event type
  to: string; // Target node ID or 'stop'
  within?: string; // Time limit (ISO 8601 duration)
  after?: string; // Timeout duration (ISO 8601 duration)
}

export class CampaignStateManager {
  
  async processEvent(
    tenantId: string,
    eventType: string,
    outboundMessageId?: string,
    metadata?: any
  ): Promise<{ campaignsProcessed: number; transitionsTriggered: number }> {
    
    logger.info('Processing campaign event', { 
      tenantId, 
      eventType, 
      outboundMessageId 
    });

    let campaignsProcessed = 0;
    let transitionsTriggered = 0;

    try {
      // Find affected campaigns
      const campaigns = await this.findAffectedCampaigns(tenantId, outboundMessageId, eventType);

      for (const campaign of campaigns) {
        const result = await this.processCampaignEvent(campaign, eventType, metadata);
        if (result.transitionTriggered) {
          transitionsTriggered++;
        }
        campaignsProcessed++;
      }

      return { campaignsProcessed, transitionsTriggered };

    } catch (error) {
      logger.error('Campaign event processing failed', { 
        tenantId, 
        eventType, 
        error: error.message 
      });
      throw error;
    }
  }

  private async findAffectedCampaigns(
    tenantId: string, 
    outboundMessageId?: string, 
    eventType?: string
  ) {
    if (outboundMessageId) {
      // Find campaign via outbound message
      const [result] = await db
        .select({
          campaign: contactCampaigns,
          messageNodeId: outboundMessages.nodeId,
        })
        .from(contactCampaigns)
        .innerJoin(outboundMessages, eq(outboundMessages.contactCampaignId, contactCampaigns.id))
        .where(
          and(
            eq(outboundMessages.id, outboundMessageId),
            eq(contactCampaigns.tenantId, tenantId),
            eq(contactCampaigns.status, 'active')
          )
        );

      return result ? [{ ...result.campaign, messageNodeId: result.messageNodeId }] : [];
    }

    // For synthetic events, find by current node and scheduled actions
    if (eventType === 'no_open' || eventType === 'no_click') {
      // This would be called from timeout worker with specific campaign context
      return [];
    }

    return [];
  }

  private async processCampaignEvent(
    campaign: any, 
    eventType: string, 
    metadata?: any
  ): Promise<{ transitionTriggered: boolean }> {
    
    const plan: CampaignPlan = campaign.planJson;
    const currentNode = plan.nodes.find(n => n.id === campaign.currentNodeId);
    
    if (!currentNode) {
      logger.warn('Current node not found in plan', { 
        campaignId: campaign.id, 
        currentNodeId: campaign.currentNodeId 
      });
      return { transitionTriggered: false };
    }

    // Find matching transition
    const transition = currentNode.transitions.find(t => t.on === eventType);
    if (!transition) {
      logger.debug('No transition found for event', { 
        campaignId: campaign.id, 
        eventType, 
        currentNodeId: campaign.currentNodeId 
      });
      return { transitionTriggered: false };
    }

    // Check if transition is within time limit
    if (transition.within && !this.isWithinTimeLimit(campaign, transition.within)) {
      logger.debug('Event outside time limit', { 
        campaignId: campaign.id, 
        eventType, 
        timeLimit: transition.within 
      });
      return { transitionTriggered: false };
    }

    // Execute transition
    await this.executeTransition(campaign, currentNode, transition, eventType, metadata);
    
    return { transitionTriggered: true };
  }

  private async executeTransition(
    campaign: any,
    fromNode: CampaignNode,
    transition: CampaignTransition,
    eventType: string,
    metadata?: any
  ) {
    const transitionId = createId();
    
    try {
      await db.transaction(async (tx) => {
        // Record the transition
        await tx.insert(campaignTransitions).values({
          id: transitionId,
          tenantId: campaign.tenantId,
          contactCampaignId: campaign.id,
          fromNodeId: fromNode.id,
          toNodeId: transition.to,
          trigger: eventType,
          reason: `Event: ${eventType}`,
          eventRef: metadata?.eventId,
          at: new Date(),
          createdAt: new Date(),
        });

        if (transition.to === 'stop') {
          // Terminal state - mark campaign as completed
          await tx
            .update(contactCampaigns)
            .set({ 
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(contactCampaigns.id, campaign.id));

          // Cancel any pending actions
          await this.cancelPendingActions(campaign.id, tx);

        } else {
          // Move to next node
          const targetNode = campaign.planJson.nodes.find(n => n.id === transition.to);
          if (!targetNode) {
            throw new Error(`Target node not found: ${transition.to}`);
          }

          // Update campaign current node
          await tx
            .update(contactCampaigns)
            .set({ 
              currentNodeId: transition.to,
              updatedAt: new Date(),
            })
            .where(eq(contactCampaigns.id, campaign.id));

          // Schedule next action if needed
          if (targetNode.action === 'send') {
            await this.scheduleNextAction(campaign, targetNode, tx);
          }

          // Schedule timeouts for new node
          await this.scheduleTimeouts(campaign, targetNode, tx);

          // Cancel old timeouts that are no longer relevant
          await this.cancelIrrelevantTimeouts(campaign.id, fromNode.id, tx);
        }
      });

      logger.info('Campaign transition executed', {
        campaignId: campaign.id,
        fromNode: fromNode.id,
        toNode: transition.to,
        eventType,
        transitionId,
      });

    } catch (error) {
      logger.error('Campaign transition failed', {
        campaignId: campaign.id,
        fromNode: fromNode.id,
        toNode: transition.to,
        eventType,
        error: error.message,
      });
      throw error;
    }
  }

  private async scheduleNextAction(campaign: any, node: CampaignNode, tx: any) {
    if (node.action !== 'send') return;

    const delay = this.parseDelay(node.schedule?.delay || 'PT0S');
    const runAt = new Date(Date.now() + delay);
    
    // Apply quiet hours
    const adjustedRunAt = this.applyQuietHours(runAt, campaign.planJson.timezone, campaign.planJson.quietHours);
    
    const actionId = createId();
    const dedupeKey = `${campaign.tenantId}:${campaign.id}:${node.id}:send:${adjustedRunAt.toISOString()}`;

    await tx.insert(scheduledActions).values({
      id: actionId,
      tenantId: campaign.tenantId,
      contactCampaignId: campaign.id,
      nodeId: node.id,
      actionType: 'send',
      runAt: adjustedRunAt,
      status: 'pending',
      dedupeKey,
      reason: `Send action for node ${node.id}`,
      createdAt: new Date(),
    });

    // Queue the job
    await queueManager.enqueueJob(
      'outreach:send',
      'send-campaign-message',
      {
        tenantId: campaign.tenantId,
        scheduledActionId: actionId,
        campaignId: campaign.id,
        contactId: campaign.contactId,
        nodeId: node.id,
        channel: node.channel,
      },
      {
        jobId: dedupeKey,
        delay: delay,
      }
    );
  }

  private async scheduleTimeouts(campaign: any, node: CampaignNode, tx: any) {
    for (const transition of node.transitions) {
      if (transition.after) {
        const delay = this.parseDelay(transition.after);
        const runAt = new Date(Date.now() + delay);
        
        const timeoutId = createId();
        const dedupeKey = `${campaign.tenantId}:${campaign.id}:${node.id}:timeout:${transition.on}`;

        await tx.insert(scheduledActions).values({
          id: timeoutId,
          tenantId: campaign.tenantId,
          contactCampaignId: campaign.id,
          nodeId: node.id,
          actionType: 'timeout',
          runAt,
          status: 'pending',
          dedupeKey,
          reason: `Timeout for ${transition.on} after ${transition.after}`,
          createdAt: new Date(),
        });

        // Queue timeout job
        await queueManager.enqueueJob(
          'outreach:timeout',
          'generate-timeout-event',
          {
            tenantId: campaign.tenantId,
            campaignId: campaign.id,
            contactId: campaign.contactId,
            nodeId: node.id,
            eventType: transition.on,
            scheduledAt: runAt.toISOString(),
          },
          {
            jobId: dedupeKey,
            delay: delay,
          }
        );
      }
    }
  }

  private async cancelPendingActions(campaignId: string, tx: any) {
    await tx
      .update(scheduledActions)
      .set({ 
        status: 'canceled',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledActions.contactCampaignId, campaignId),
          eq(scheduledActions.status, 'pending')
        )
      );
  }

  private async cancelIrrelevantTimeouts(campaignId: string, oldNodeId: string, tx: any) {
    // Cancel timeout actions for the old node
    await tx
      .update(scheduledActions)
      .set({ 
        status: 'canceled',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledActions.contactCampaignId, campaignId),
          eq(scheduledActions.nodeId, oldNodeId),
          eq(scheduledActions.actionType, 'timeout'),
          eq(scheduledActions.status, 'pending')
        )
      );
  }

  private isWithinTimeLimit(campaign: any, timeLimit: string): boolean {
    // Check if event occurred within time limit from when node was entered
    const timeLimitMs = this.parseDelay(timeLimit);
    const nodeEnteredAt = this.getNodeEnteredTime(campaign);
    
    if (!nodeEnteredAt) return true; // If we can't determine, allow it
    
    const now = new Date();
    const elapsed = now.getTime() - nodeEnteredAt.getTime();
    
    return elapsed <= timeLimitMs;
  }

  private getNodeEnteredTime(campaign: any): Date | null {
    // This would query campaign_transitions to find when current node was entered
    // For now, use campaign updated_at as approximation
    return new Date(campaign.updatedAt);
  }

  private parseDelay(duration: string): number {
    // Parse ISO 8601 duration (PT72H, PT30M, etc.) to milliseconds
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    
    return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
  }

  private applyQuietHours(
    scheduledTime: Date, 
    timezone: string, 
    quietHours: { start: string; end: string }
  ): Date {
    // Implement timezone-aware quiet hours logic
    // For now, return as-is
    return scheduledTime;
  }
}

export const campaignStateManager = new CampaignStateManager();
```

### Step 2: Update Webhook Worker Integration

Update `server/src/workers/webhook.worker.ts` to use the state manager:

```typescript
// Add to webhook worker
import { campaignStateManager } from '../services/campaigns/state.manager';

// In the triggerCampaignTransitions method:
private async triggerCampaignTransitions(events: ProcessedEvent[]): Promise<number> {
  let totalTransitions = 0;

  for (const event of events) {
    try {
      const result = await campaignStateManager.processEvent(
        event.tenantId,
        event.eventType,
        event.outboundMessageId,
        { eventId: event.providerId }
      );
      
      totalTransitions += result.transitionsTriggered;
      
      logger.info('Campaign transitions processed', {
        eventType: event.eventType,
        campaignsProcessed: result.campaignsProcessed,
        transitionsTriggered: result.transitionsTriggered,
      });
      
    } catch (error) {
      logger.error('Failed to process campaign transitions', {
        eventType: event.eventType,
        tenantId: event.tenantId,
        error: error.message,
      });
      // Continue processing other events
    }
  }

  return totalTransitions;
}
```

### Step 3: Update Timeout Worker

Update `server/src/workers/timeout.worker.ts` to generate synthetic events:

```typescript
import { Worker, Job } from 'bullmq';
import { TimeoutJobData, TimeoutJobResult } from '../libs/bullmq/job.types';
import { campaignStateManager } from '../services/campaigns/state.manager';
import { logger } from '../libs/logger';

class TimeoutWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker('outreach:timeout', this.processJob.bind(this), {
      ...workerConfigs['outreach:timeout'],
      autorun: false,
    });
  }

  async processJob(job: Job<TimeoutJobData>): Promise<TimeoutJobResult> {
    const { tenantId, campaignId, contactId, nodeId, eventType, scheduledAt } = job.data;

    logger.info('Processing timeout job', {
      jobId: job.id,
      tenantId,
      campaignId,
      eventType,
    });

    try {
      // Generate synthetic event (e.g., "no_open" becomes "no_open")
      const syntheticEventType = `no_${eventType}`; // "opened" -> "no_open"
      
      const result = await campaignStateManager.processEvent(
        tenantId,
        syntheticEventType,
        undefined, // No outbound message for synthetic events
        {
          campaignId,
          contactId,
          nodeId,
          synthetic: true,
          scheduledAt,
        }
      );

      logger.info('Timeout event processed', {
        syntheticEventType,
        campaignsProcessed: result.campaignsProcessed,
        transitionsTriggered: result.transitionsTriggered,
      });

      return {
        success: true,
        eventsCreated: 1,
        transitionsTriggered: result.transitionsTriggered,
      };

    } catch (error) {
      logger.error('Timeout job failed', {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async start() {
    await this.worker.run();
    logger.info('Timeout worker started');
  }

  async stop() {
    await this.worker.close();
    logger.info('Timeout worker stopped');
  }
}

export const timeoutWorker = new TimeoutWorker();
```

### Step 4: Campaign Transition API

Create `server/src/routes/campaigns/transitions.routes.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { db } from '../../db';
import { campaignTransitions, contactCampaigns } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function campaignTransitionRoutes(fastify: FastifyInstance) {
  
  // Get campaign transition history
  fastify.get('/campaigns/:campaignId/transitions', {
    schema: {
      params: {
        type: 'object',
        properties: {
          campaignId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { campaignId } = request.params as { campaignId: string };
    const tenantId = request.user.tenantId;

    // Verify campaign belongs to tenant
    const [campaign] = await db
      .select()
      .from(contactCampaigns)
      .where(
        and(
          eq(contactCampaigns.id, campaignId),
          eq(contactCampaigns.tenantId, tenantId)
        )
      );

    if (!campaign) {
      return reply.status(404).send({ error: 'Campaign not found' });
    }

    // Get transition history
    const transitions = await db
      .select()
      .from(campaignTransitions)
      .where(eq(campaignTransitions.contactCampaignId, campaignId))
      .orderBy(desc(campaignTransitions.at));

    return {
      campaign: {
        id: campaign.id,
        status: campaign.status,
        currentNodeId: campaign.currentNodeId,
      },
      transitions,
    };
  });

  // Get campaign current state and next actions
  fastify.get('/campaigns/:campaignId/state', async (request, reply) => {
    const { campaignId } = request.params as { campaignId: string };
    const tenantId = request.user.tenantId;

    const [campaign] = await db
      .select()
      .from(contactCampaigns)
      .where(
        and(
          eq(contactCampaigns.id, campaignId),
          eq(contactCampaigns.tenantId, tenantId)
        )
      );

    if (!campaign) {
      return reply.status(404).send({ error: 'Campaign not found' });
    }

    // Get pending actions
    const pendingActions = await db
      .select()
      .from(scheduledActions)
      .where(
        and(
          eq(scheduledActions.contactCampaignId, campaignId),
          eq(scheduledActions.status, 'pending')
        )
      )
      .orderBy(scheduledActions.runAt);

    // Get current node from plan
    const plan = campaign.planJson;
    const currentNode = plan.nodes.find(n => n.id === campaign.currentNodeId);

    return {
      campaign: {
        id: campaign.id,
        status: campaign.status,
        currentNodeId: campaign.currentNodeId,
        currentNode,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
      },
      pendingActions,
      plan: {
        version: plan.version,
        nodeCount: plan.nodes.length,
      },
    };
  });
}
```

## File Structure

```
server/src/
├── services/
│   └── campaigns/
│       ├── state.manager.ts        # Core state machine logic
│       ├── transition.processor.ts # Event processing
│       └── timeout.scheduler.ts    # Timeout management
├── workers/
│   ├── webhook.worker.ts           # Updated with transitions
│   └── timeout.worker.ts           # Synthetic event generation
├── routes/
│   └── campaigns/
│       └── transitions.routes.ts   # Transition API endpoints
└── libs/
    └── campaigns/
        ├── plan.validator.ts       # Campaign plan validation
        └── duration.parser.ts      # ISO 8601 duration parsing
```

## Testing Requirements

No unit tests at this time.

## Performance Considerations

### Optimization
- **Batch processing**: Handle multiple events together
- **Efficient queries**: Optimized database access patterns
- **Cache frequent data**: Campaign plans and configurations
- **Parallel processing**: Independent campaign processing

### Monitoring
- Transition processing latency
- Event processing success rate
- Campaign completion rates
- Timeout accuracy

## Error Handling

### Resilience
- **Idempotent processing**: Safe to retry transitions
- **Late events**: Handle out-of-order event processing
- **Invalid plans**: Graceful handling of malformed plans
- **Database failures**: Transaction rollback and retry

## Definition of Done

- [ ] Event-driven state transitions working correctly
- [ ] Support for all planned event types
- [ ] Automatic follow-up action scheduling
- [ ] Campaign completion detection
- [ ] Transition audit trail complete
- [ ] Integration with webhook and timeout workers
- [ ] API endpoints for transition monitoring
- [ ] Comprehensive error handling
- [ ] Performance monitoring in place
