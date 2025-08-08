# Ticket 07: Send Worker Implementation

**Epic**: Core Campaign Engine (Phase 2)  
**Story Points**: 13  
**Priority**: Critical  
**Dependencies**: 01-database-schema, 02-bullmq-setup, 03-sendgrid-integration, 04-sender-identities, 05-campaign-plans, 06-scheduled-actions

## Objective

Implement the core email sending worker that processes scheduled campaign actions, enforces rate limiting and idempotency, renders content, sends via SendGrid, and creates follow-up actions based on campaign plans.

## Acceptance Criteria

- [ ] Worker processes `outreach:send` jobs with full idempotency
- [ ] Rate limiting enforced per-tenant, per-sender, and per-domain
- [ ] Content rendering with AI-generated personalization
- [ ] SendGrid integration with proper error handling
- [ ] Suppression list enforcement (unsubscribe, bounce, invalid emails)
- [ ] Follow-up timeout actions scheduled automatically
- [ ] Comprehensive logging and monitoring
- [ ] Graceful failure handling with retries

## Technical Requirements

### Core Functionality

1. **Job Processing**: Claim and process `scheduled_actions` atomically
2. **Idempotency**: Prevent duplicate sends using `outbound_messages` constraints
3. **Rate Limiting**: Multi-level rate controls with Redis token buckets
4. **Content Rendering**: Template processing with contact/lead context
5. **Provider Integration**: SendGrid email sending with tracking
6. **State Management**: Update campaign state and schedule follow-ups
7. **Error Handling**: Proper retry logic and failure classification

### Rate Limiting Scopes

- **Per-sender (AE)**: 20/min, 1,000/hour
- **Per-tenant**: 5,000/hour  
- **Global**: 20,000/hour
- **Per-domain**: 200/hour (gmail.com, outlook.com, etc.)

## Implementation Steps

### Step 1: Worker Infrastructure

Create `server/src/workers/send.worker.ts`:

```typescript
import { Worker, Job } from 'bullmq';
import { workerConfigs } from '../libs/bullmq/queue.config';
import { SendJobData, SendJobResult } from '../libs/bullmq/job.types';
import { logger } from '../libs/logger';
import { db } from '../db';
import { 
  scheduledActions, 
  outboundMessages, 
  contactCampaigns,
  communicationSuppressions,
  emailSenderIdentities 
} from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { sendgridClient } from '../libs/sendgrid/client';
import { RateLimiter } from '../libs/bullmq/rate.limiter';
import { createId } from '@paralleldrive/cuid2';

class SendWorker {
  private worker: Worker;
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter();
    this.worker = new Worker('outreach:send', this.processJob.bind(this), {
      ...workerConfigs['outreach:send'],
      autorun: false,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.worker.on('completed', (job) => {
      logger.info(`Send job completed: ${job.id}`, { 
        data: job.data,
        result: job.returnvalue 
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Send job failed: ${job?.id}`, { 
        data: job?.data,
        error: err.message 
      });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn(`Send job stalled: ${jobId}`);
    });
  }

  async processJob(job: Job<SendJobData>): Promise<SendJobResult> {
    const { tenantId, scheduledActionId, campaignId, contactId, nodeId, channel } = job.data;
    
    logger.info(`Processing send job`, { 
      jobId: job.id, 
      tenantId, 
      campaignId, 
      contactId, 
      nodeId 
    });

    try {
      // Step 1: Load and validate scheduled action
      const action = await this.loadScheduledAction(scheduledActionId, tenantId);
      if (!action) {
        throw new Error(`Scheduled action not found: ${scheduledActionId}`);
      }

      // Step 2: Load campaign and contact data
      const campaignData = await this.loadCampaignData(campaignId, contactId, tenantId);
      
      // Step 3: Check for existing message (idempotency)
      const dedupeKey = `${contactId}:${campaignId}:${nodeId}:${channel}`;
      const existingMessage = await this.checkExistingMessage(tenantId, dedupeKey);
      if (existingMessage) {
        logger.info(`Message already sent, skipping`, { dedupeKey });
        return { success: true, messageId: existingMessage.id };
      }

      // Step 4: Validate sender identity and get config
      const senderIdentity = await this.validateSenderIdentity(campaignData.senderIdentityId, tenantId);
      
      // Step 5: Check suppressions
      await this.checkSuppressions(tenantId, campaignData.contact.email!, channel);

      // Step 6: Apply rate limiting
      await this.enforceRateLimit(tenantId, senderIdentity.id, campaignData.contact.email!);

      // Step 7: Render content
      const content = await this.renderContent(campaignData, nodeId);

      // Step 8: Create outbound message record
      const messageId = createId();
      await this.createOutboundMessage({
        id: messageId,
        tenantId,
        contactCampaignId: campaignId,
        nodeId,
        channel,
        senderIdentityId: senderIdentity.id,
        toAddress: campaignData.contact.email!,
        subject: content.subject,
        body: content.body,
        renderedBody: content.renderedBody,
        dedupeKey,
        scheduledAt: new Date(),
      });

      // Step 9: Send via provider
      const sendResult = await this.sendViaProvider(
        senderIdentity,
        campaignData.contact.email!,
        content,
        {
          tenantId,
          campaignId,
          nodeId,
          messageId,
        }
      );

      // Step 10: Update message with provider response
      await this.updateMessageWithProviderResponse(messageId, sendResult);

      // Step 11: Mark scheduled action as completed
      await this.completeScheduledAction(scheduledActionId);

      // Step 12: Schedule follow-up actions
      await this.scheduleFollowUpActions(campaignData, nodeId);

      return {
        success: true,
        messageId,
        providerId: sendResult.messageId,
      };

    } catch (error) {
      logger.error(`Send job failed`, { 
        jobId: job.id, 
        error: error.message,
        stack: error.stack 
      });

      // Mark action as error if retries exhausted
      if (job.attemptsMade >= (job.opts.attempts || 3)) {
        await this.markActionAsError(scheduledActionId, error.message);
      }

      throw error;
    }
  }

  private async loadScheduledAction(actionId: string, tenantId: string) {
    const [action] = await db
      .select()
      .from(scheduledActions)
      .where(
        and(
          eq(scheduledActions.id, actionId),
          eq(scheduledActions.tenantId, tenantId),
          eq(scheduledActions.status, 'pending')
        )
      );

    return action;
  }

  private async loadCampaignData(campaignId: string, contactId: string, tenantId: string) {
    // Join campaign, contact, lead data
    const [result] = await db
      .select({
        campaign: contactCampaigns,
        contact: leadPointOfContacts,
        lead: leads,
      })
      .from(contactCampaigns)
      .innerJoin(leadPointOfContacts, eq(contactCampaigns.contactId, leadPointOfContacts.id))
      .innerJoin(leads, eq(contactCampaigns.leadId, leads.id))
      .where(
        and(
          eq(contactCampaigns.id, campaignId),
          eq(contactCampaigns.tenantId, tenantId)
        )
      );

    if (!result) {
      throw new Error(`Campaign data not found: ${campaignId}`);
    }

    return result;
  }

  private async checkExistingMessage(tenantId: string, dedupeKey: string) {
    const [existing] = await db
      .select()
      .from(outboundMessages)
      .where(
        and(
          eq(outboundMessages.tenantId, tenantId),
          eq(outboundMessages.dedupeKey, dedupeKey)
        )
      );

    return existing;
  }

  private async validateSenderIdentity(senderIdentityId: string | null, tenantId: string) {
    if (!senderIdentityId) {
      throw new Error('No sender identity specified');
    }

    const [sender] = await db
      .select()
      .from(emailSenderIdentities)
      .where(
        and(
          eq(emailSenderIdentities.id, senderIdentityId),
          eq(emailSenderIdentities.tenantId, tenantId),
          eq(emailSenderIdentities.validationStatus, 'verified')
        )
      );

    if (!sender) {
      throw new Error(`Sender identity not found or not verified: ${senderIdentityId}`);
    }

    return sender;
  }

  private async checkSuppressions(tenantId: string, email: string, channel: string) {
    const [suppression] = await db
      .select()
      .from(communicationSuppressions)
      .where(
        and(
          eq(communicationSuppressions.tenantId, tenantId),
          eq(communicationSuppressions.channel, channel),
          eq(communicationSuppressions.value, email)
        )
      );

    if (suppression) {
      throw new Error(`Email suppressed: ${email} (${suppression.type})`);
    }
  }

  private async enforceRateLimit(tenantId: string, senderIdentityId: string, email: string) {
    // Check multiple rate limit scopes
    const domain = email.split('@')[1];
    
    const checks = [
      { key: `sender:${senderIdentityId}`, limit: 20, window: 60 }, // 20/min per sender
      { key: `tenant:${tenantId}`, limit: 5000, window: 3600 }, // 5000/hour per tenant
      { key: `domain:${tenantId}:${domain}`, limit: 200, window: 3600 }, // 200/hour per domain
      { key: 'global', limit: 20000, window: 3600 }, // 20k/hour global
    ];

    for (const check of checks) {
      const result = await this.rateLimiter.checkRateLimit(check.key, check.limit, check.window);
      if (!result.allowed) {
        throw new Error(`Rate limit exceeded for ${check.key}: ${check.limit}/${check.window}s`);
      }
    }
  }

  private async renderContent(campaignData: any, nodeId: string) {
    // Extract plan and find node
    const plan = campaignData.campaign.planJson;
    const node = plan.nodes.find((n: any) => n.id === nodeId);
    
    if (!node) {
      throw new Error(`Plan node not found: ${nodeId}`);
    }

    // Simple template rendering (replace with more sophisticated system)
    const context = {
      contact: campaignData.contact,
      lead: campaignData.lead,
      // Add more context as needed
    };

    const subject = this.renderTemplate(node.subject, context);
    const body = this.renderTemplate(node.body, context);
    
    return {
      subject,
      body,
      renderedBody: body, // HTML version if needed
    };
  }

  private renderTemplate(template: string, context: any): string {
    // Simple template replacement - enhance with proper template engine
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = this.getNestedValue(context, key);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async start() {
    await this.worker.run();
    logger.info('Send worker started');
  }

  async stop() {
    await this.worker.close();
    await this.rateLimiter.close();
    logger.info('Send worker stopped');
  }
}

export const sendWorker = new SendWorker();
```

### Step 2: SendGrid Integration

Update `server/src/libs/sendgrid/client.ts`:

```typescript
export interface SendEmailParams {
  from: { email: string; name: string };
  to: string;
  subject: string;
  html: string;
  text?: string;
  customArgs?: Record<string, string>;
  trackingSettings?: {
    clickTracking?: { enable: boolean };
    openTracking?: { enable: boolean };
  };
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SendGridClient {
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const msg = {
        to: params.to,
        from: params.from,
        subject: params.subject,
        html: params.html,
        text: params.text || this.htmlToText(params.html),
        customArgs: params.customArgs,
        trackingSettings: params.trackingSettings,
      };

      const response = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
      };
    } catch (error) {
      logger.error('SendGrid send failed', { error, params });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html.replace(/<[^>]*>/g, '').trim();
  }
}
```

### Step 3: Follow-up Action Scheduling

```typescript
private async scheduleFollowUpActions(campaignData: any, currentNodeId: string) {
  const plan = campaignData.campaign.planJson;
  const currentNode = plan.nodes.find((n: any) => n.id === currentNodeId);
  
  if (!currentNode?.transitions) {
    return;
  }

  // Schedule timeout actions based on transitions
  for (const transition of currentNode.transitions) {
    if (transition.after) {
      const delay = this.parseDelay(transition.after); // PT72H -> milliseconds
      const runAt = new Date(Date.now() + delay);
      
      await this.createScheduledAction({
        contactCampaignId: campaignData.campaign.id,
        nodeId: currentNodeId,
        actionType: 'timeout',
        runAt,
        dedupeKey: `${campaignData.campaign.id}:${currentNodeId}:timeout:${transition.on}`,
        reason: `Timeout for ${transition.on}`,
      });
    }
  }
}
```

## File Structure

```
server/src/
├── workers/
│   ├── send.worker.ts              # Main send worker
│   ├── worker.manager.ts           # Worker lifecycle management
│   └── shared/
│       ├── content.renderer.ts     # Template rendering
│       ├── rate.limiter.ts         # Rate limiting logic
│       └── suppression.checker.ts  # Suppression validation
├── libs/
│   └── sendgrid/
│       ├── client.ts               # Enhanced SendGrid client
│       └── tracking.ts             # Custom args and tracking
└── services/
    └── campaigns/
        ├── send.service.ts         # Send orchestration service
        └── action.scheduler.ts     # Follow-up scheduling
```

## Testing Requirements

### Unit Tests

```typescript
describe('SendWorker', () => {
  test('processes send job successfully', async () => {
    // Mock all dependencies
    // Test successful send flow
  });
  
  test('enforces idempotency', async () => {
    // Test duplicate message prevention
  });
  
  test('respects rate limits', async () => {
    // Test rate limiting enforcement
  });
  
  test('handles suppressed emails', async () => {
    // Test suppression checking
  });
});
```

### Integration Tests

```typescript
describe('Send Worker Integration', () => {
  test('end-to-end send flow', async () => {
    // Create campaign, schedule action, process job
    // Verify message sent and follow-ups scheduled
  });
});
```

## Performance Considerations

### Optimizations
- **Database queries**: Use prepared statements and connection pooling
- **Rate limiting**: Redis pipeline operations
- **Content rendering**: Cache rendered templates where possible
- **Parallel processing**: Concurrent worker instances

### Monitoring
- Send success/failure rates
- Rate limit hit frequency
- Processing time per job
- Queue depth and processing lag

## Error Handling

### Retry Strategy
- **Temporary failures**: Retry with exponential backoff
- **Rate limit hits**: Delay and retry
- **Invalid data**: Mark as permanent failure
- **Provider errors**: Classify and handle appropriately

### Failure Classification
- **Retriable**: Network errors, rate limits, temporary provider issues
- **Permanent**: Invalid email, suppressed contact, missing data

## Security Considerations

- **Input validation**: Sanitize all template inputs
- **Rate limiting**: Prevent abuse and maintain deliverability
- **Suppression**: Honor unsubscribe and bounce lists
- **Provider credentials**: Secure API key storage

## Rollback Plan

1. **Worker errors**: Stop worker, investigate, fix, restart
2. **High failure rate**: Pause sending, review error patterns
3. **Rate limit issues**: Reduce concurrency, adjust limits
4. **Provider issues**: Switch to backup provider if available

## Definition of Done

- [ ] Worker processes jobs with full idempotency
- [ ] Multi-level rate limiting implemented and tested
- [ ] Content rendering working with campaign plans
- [ ] SendGrid integration sending emails successfully
- [ ] Suppression checking preventing unwanted sends
- [ ] Follow-up actions scheduled correctly
- [ ] Comprehensive error handling and logging
- [ ] Unit and integration tests passing
- [ ] Performance monitoring in place
- [ ] Code review completed