# Ticket 09: Webhook Ingestion Implementation

**Epic**: Event Processing (Phase 3)  
**Story Points**: 8  
**Priority**: Critical  
**Dependencies**: 01-database-schema, 02-bullmq-setup, 07-send-worker

## Objective

Implement SendGrid webhook ingestion to capture email engagement events (delivered, opened, clicked, bounced, unsubscribed) with full idempotency, proper validation, and queued processing for campaign state updates.

## Acceptance Criteria

- [ ] Webhook endpoint receives and validates SendGrid payloads
- [ ] Signature verification for security 
- [ ] Idempotent processing prevents duplicate event handling
- [ ] All webhook events stored for audit and analysis
- [ ] Events queued for processing by webhook worker
- [ ] Proper error handling and logging
- [ ] Rate limiting to prevent abuse
- [ ] Support for batch webhook processing

## Technical Requirements

### SendGrid Events to Handle

1. **Delivery Events**: `processed`, `delivered`, `deferred`
2. **Engagement Events**: `open`, `click` 
3. **Bounce Events**: `bounce`, `blocked`
4. **Suppression Events**: `spamreport`, `unsubscribe`, `group_unsubscribe`

### Security & Reliability

- **Signature Verification**: Validate webhook authenticity
- **Idempotency**: Hash-based duplicate prevention
- **Rate Limiting**: Prevent webhook abuse
- **Async Processing**: Queue events for background processing

## Implementation Steps

### Step 1: Webhook Route Handler

Create `server/src/routes/webhooks/sendgrid.routes.ts`:

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { logger } from '../../libs/logger';
import { db } from '../../db';
import { webhookDeliveries } from '../../db/schema';
import { queueManager } from '../../libs/bullmq/queue.manager';
import { createId } from '@paralleldrive/cuid2';

interface SendGridWebhookBody {
  events?: SendGridEvent[];
  // Single event fallback
  event?: string;
  email?: string;
  timestamp?: number;
  [key: string]: any;
}

interface SendGridEvent {
  event: string;
  email: string;
  timestamp: number;
  'smtp-id'?: string;
  sg_event_id?: string;
  sg_message_id?: string;
  useragent?: string;
  ip?: string;
  url?: string;
  custom_args?: Record<string, string>;
  [key: string]: any;
}

export async function sendgridWebhookRoutes(fastify: FastifyInstance) {
  // SendGrid webhook endpoint
  fastify.post('/webhooks/sendgrid', {
    schema: {
      body: {
        type: 'array',
        items: { type: 'object' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const signature = request.headers['x-twilio-email-event-webhook-signature'] as string;
      const timestamp = request.headers['x-twilio-email-event-webhook-timestamp'] as string;
      const rawBody = JSON.stringify(request.body);

      // Step 1: Verify webhook signature
      if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
        logger.warn('Invalid webhook signature', { 
          signature: signature?.substring(0, 20), 
          timestamp 
        });
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      // Step 2: Generate payload hash for idempotency
      const payloadHash = crypto
        .createHash('sha256')
        .update(rawBody)
        .digest('hex');

      // Step 3: Store webhook delivery record
      const deliveryId = createId();
      try {
        await db.insert(webhookDeliveries).values({
          id: deliveryId,
          provider: 'sendgrid',
          receivedAt: new Date(),
          signatureValid: true,
          payload: request.body,
          payloadHash,
          processed: false,
        });
      } catch (error) {
        // If hash collision (duplicate), that's fine - return success
        if (error.code === '23505') { // Unique constraint violation
          logger.info('Duplicate webhook payload received', { payloadHash });
          return reply.status(200).send({ status: 'duplicate' });
        }
        throw error;
      }

      // Step 4: Extract tenant info and queue processing
      const events = Array.isArray(request.body) ? request.body : [request.body];
      const tenantId = extractTenantId(events[0]);

      if (tenantId) {
        // Queue for background processing
        await queueManager.enqueueJob(
          'webhook:process',
          'process-sendgrid-webhook',
          {
            tenantId,
            webhookDeliveryId: deliveryId,
            provider: 'sendgrid',
            payload: request.body,
          },
          {
            jobId: `webhook:${deliveryId}`,
            priority: 0, // High priority for real-time processing
          }
        );

        logger.info('Webhook queued for processing', { 
          deliveryId, 
          tenantId, 
          eventCount: events.length 
        });
      } else {
        logger.warn('Could not extract tenant ID from webhook', { 
          events: events.slice(0, 2) // Log first 2 events for debugging
        });
      }

      // Always return 200 to SendGrid
      return reply.status(200).send({ 
        status: 'received',
        deliveryId,
        eventCount: events.length
      });

    } catch (error) {
      logger.error('Webhook processing error', { 
        error: error.message,
        stack: error.stack 
      });
      
      // Return 200 to prevent SendGrid retries for unrecoverable errors
      return reply.status(200).send({ 
        status: 'error',
        error: error.message 
      });
    }
  });

  // Health check endpoint for SendGrid webhook validation
  fastify.get('/webhooks/sendgrid/health', async (request, reply) => {
    return reply.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

function verifyWebhookSignature(
  payload: string, 
  signature: string, 
  timestamp: string
): boolean {
  if (!signature || !timestamp) {
    return false;
  }

  // Check timestamp is within acceptable window (5 minutes)
  const timestampNum = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNum) > 300) {
    logger.warn('Webhook timestamp outside acceptable window', { 
      timestamp: timestampNum, 
      now,
      diff: Math.abs(now - timestampNum)
    });
    return false;
  }

  // Verify ECDSA signature
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) {
    logger.error('SendGrid webhook public key not configured');
    return false;
  }

  try {
    const verifier = crypto.createVerify('sha256WithRSAEncryption');
    verifier.update(payload + timestamp);
    return verifier.verify(publicKey, signature, 'base64');
  } catch (error) {
    logger.error('Signature verification failed', { error: error.message });
    return false;
  }
}

function extractTenantId(event: SendGridEvent): string | null {
  // Extract tenant ID from custom args or other metadata
  if (event.custom_args?.tenant_id) {
    return event.custom_args.tenant_id;
  }
  
  // Fallback: extract from message ID or other fields
  // This depends on how you embed tenant info in outbound messages
  
  return null;
}
```

### Step 2: Webhook Processing Worker

Create `server/src/workers/webhook.worker.ts`:

```typescript
import { Worker, Job } from 'bullmq';
import { workerConfigs } from '../libs/bullmq/queue.config';
import { WebhookJobData, WebhookJobResult } from '../libs/bullmq/job.types';
import { logger } from '../libs/logger';
import { db } from '../db';
import { 
  webhookDeliveries,
  messageEvents,
  outboundMessages,
  contactCampaigns,
  communicationSuppressions
} from '../db/schema';
import { eq, and } from 'drizzle-orm';

interface ProcessedEvent {
  tenantId: string;
  eventType: string;
  eventAt: Date;
  outboundMessageId?: string;
  email: string;
  providerId: string;
  metadata: any;
}

class WebhookWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker('webhook:process', this.processJob.bind(this), {
      ...workerConfigs['webhook:process'],
      autorun: false,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.worker.on('completed', (job) => {
      logger.info(`Webhook job completed: ${job.id}`, { 
        result: job.returnvalue 
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Webhook job failed: ${job?.id}`, { 
        error: err.message 
      });
    });
  }

  async processJob(job: Job<WebhookJobData>): Promise<WebhookJobResult> {
    const { tenantId, webhookDeliveryId, provider, payload } = job.data;

    logger.info(`Processing webhook job`, { 
      jobId: job.id,
      webhookDeliveryId,
      provider
    });

    try {
      // Step 1: Load webhook delivery record
      const [delivery] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, webhookDeliveryId));

      if (!delivery) {
        throw new Error(`Webhook delivery not found: ${webhookDeliveryId}`);
      }

      if (delivery.processed) {
        logger.info('Webhook already processed', { webhookDeliveryId });
        return { success: true, eventsProcessed: 0, transitionsTriggered: 0 };
      }

      // Step 2: Normalize events
      const events = Array.isArray(payload) ? payload : [payload];
      const processedEvents: ProcessedEvent[] = [];

      for (const event of events) {
        const processed = await this.normalizeEvent(tenantId, provider, event);
        if (processed) {
          processedEvents.push(processed);
        }
      }

      // Step 3: Store normalized events
      let eventsCreated = 0;
      for (const event of processedEvents) {
        try {
          await db.insert(messageEvents).values({
            id: createId(),
            tenantId: event.tenantId,
            outboundMessageId: event.outboundMessageId,
            provider,
            eventType: event.eventType,
            eventAt: event.eventAt,
            url: event.metadata.url,
            ip: event.metadata.ip,
            userAgent: event.metadata.userAgent,
            providerEventId: event.providerId,
            payload: event.metadata,
            createdAt: new Date(),
          });
          eventsCreated++;
        } catch (error) {
          // Skip duplicate events (provider_event_id unique constraint)
          if (error.code !== '23505') {
            throw error;
          }
        }
      }

      // Step 4: Update message statuses
      await this.updateMessageStatuses(processedEvents);

      // Step 5: Handle suppressions
      await this.handleSuppressions(tenantId, processedEvents);

      // Step 6: Mark webhook as processed
      await db
        .update(webhookDeliveries)
        .set({ 
          processed: true, 
          processedAt: new Date() 
        })
        .where(eq(webhookDeliveries.id, webhookDeliveryId));

      // Step 7: Trigger campaign transitions (implemented in next ticket)
      const transitionsTriggered = await this.triggerCampaignTransitions(processedEvents);

      logger.info('Webhook processing completed', {
        webhookDeliveryId,
        eventsProcessed: eventsCreated,
        transitionsTriggered
      });

      return {
        success: true,
        eventsProcessed: eventsCreated,
        transitionsTriggered
      };

    } catch (error) {
      logger.error('Webhook processing failed', {
        webhookDeliveryId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  private async normalizeEvent(
    tenantId: string, 
    provider: string, 
    rawEvent: any
  ): Promise<ProcessedEvent | null> {
    // Extract standard fields
    const eventType = rawEvent.event;
    const email = rawEvent.email;
    const timestamp = rawEvent.timestamp;

    if (!eventType || !email || !timestamp) {
      logger.warn('Invalid event structure', { rawEvent });
      return null;
    }

    // Find corresponding outbound message
    const outboundMessageId = await this.findOutboundMessage(
      tenantId,
      rawEvent['smtp-id'] || rawEvent.sg_message_id,
      email
    );

    return {
      tenantId,
      eventType,
      eventAt: new Date(timestamp * 1000),
      outboundMessageId,
      email,
      providerId: rawEvent.sg_event_id || rawEvent['smtp-id'] || '',
      metadata: {
        url: rawEvent.url,
        ip: rawEvent.ip,
        userAgent: rawEvent.useragent,
        reason: rawEvent.reason,
        response: rawEvent.response,
        customArgs: rawEvent.custom_args,
        raw: rawEvent,
      },
    };
  }

  private async findOutboundMessage(
    tenantId: string,
    providerId: string,
    email: string
  ): Promise<string | undefined> {
    if (!providerId) return undefined;

    const [message] = await db
      .select({ id: outboundMessages.id })
      .from(outboundMessages)
      .where(
        and(
          eq(outboundMessages.tenantId, tenantId),
          eq(outboundMessages.providerMessageId, providerId)
        )
      );

    return message?.id;
  }

  private async updateMessageStatuses(events: ProcessedEvent[]) {
    const statusMap: Record<string, string> = {
      delivered: 'delivered',
      bounce: 'bounced',
      blocked: 'blocked',
      deferred: 'deferred',
    };

    for (const event of events) {
      if (event.outboundMessageId && statusMap[event.eventType]) {
        await db
          .update(outboundMessages)
          .set({ status: statusMap[event.eventType] })
          .where(eq(outboundMessages.id, event.outboundMessageId));
      }
    }
  }

  private async handleSuppressions(tenantId: string, events: ProcessedEvent[]) {
    const suppressionEvents = ['bounce', 'blocked', 'spamreport', 'unsubscribe'];
    
    for (const event of events) {
      if (suppressionEvents.includes(event.eventType)) {
        await db.insert(communicationSuppressions).values({
          id: createId(),
          tenantId,
          channel: 'email',
          value: event.email,
          type: event.eventType as any,
          source: 'webhook',
          firstSeenAt: event.eventAt,
          lastSeenAt: event.eventAt,
          createdAt: new Date(),
        }).onConflictDoUpdate({
          target: [
            communicationSuppressions.tenantId,
            communicationSuppressions.channel,
            communicationSuppressions.value,
            communicationSuppressions.type
          ],
          set: {
            lastSeenAt: event.eventAt,
            updatedAt: new Date(),
          }
        });
      }
    }
  }

  private async triggerCampaignTransitions(events: ProcessedEvent[]): Promise<number> {
    // Placeholder - implement in next ticket (11-campaign-transitions)
    return 0;
  }

  async start() {
    await this.worker.run();
    logger.info('Webhook worker started');
  }

  async stop() {
    await this.worker.close();
    logger.info('Webhook worker stopped');
  }
}

export const webhookWorker = new WebhookWorker();
```

### Step 3: Rate Limiting Middleware

Create `server/src/plugins/webhook.rateLimit.plugin.ts`:

```typescript
import { FastifyInstance, FastifyRequest } from 'fastify';
import { RateLimiter } from '../libs/bullmq/rate.limiter';

export async function webhookRateLimitPlugin(fastify: FastifyInstance) {
  const rateLimiter = new RateLimiter();

  fastify.addHook('preHandler', async (request: FastifyRequest, reply) => {
    // Only apply to webhook routes
    if (!request.url.startsWith('/webhooks/')) {
      return;
    }

    const clientIp = request.ip;
    const key = `webhook:${clientIp}`;
    
    // Allow 1000 webhook requests per hour per IP
    const result = await rateLimiter.checkRateLimit(key, 1000, 3600);
    
    if (!result.allowed) {
      reply.status(429).send({
        error: 'Rate limit exceeded',
        resetTime: result.resetTime,
      });
    }
  });
}
```

### Step 4: Environment Configuration

Add to `.env`:

```bash
# SendGrid Webhook Configuration
SENDGRID_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
SENDGRID_WEBHOOK_VERIFY_SIGNATURE=true
```

## File Structure

```
server/src/
├── routes/
│   └── webhooks/
│       └── sendgrid.routes.ts      # Webhook endpoint
├── workers/
│   └── webhook.worker.ts           # Event processing worker
├── plugins/
│   └── webhook.rateLimit.plugin.ts # Rate limiting
├── libs/
│   └── webhooks/
│       ├── signature.validator.ts  # Signature verification
│       ├── event.normalizer.ts     # Event standardization
│       └── tenant.extractor.ts     # Tenant ID extraction
└── services/
    └── webhooks/
        └── webhook.service.ts       # Webhook orchestration
```

## Testing Requirements

### Unit Tests

```typescript
describe('SendGrid Webhook Handler', () => {
  test('validates webhook signatures correctly', async () => {
    // Test signature validation
  });
  
  test('handles duplicate webhooks idempotently', async () => {
    // Test payload hash deduplication
  });
  
  test('extracts tenant ID from events', async () => {
    // Test tenant ID extraction logic
  });
});

describe('Webhook Worker', () => {
  test('normalizes events correctly', async () => {
    // Test event normalization
  });
  
  test('updates message statuses', async () => {
    // Test status updates from delivery events
  });
  
  test('creates suppression records', async () => {
    // Test suppression handling
  });
});
```

### Integration Tests

```typescript
describe('Webhook Integration', () => {
  test('end-to-end webhook processing', async () => {
    // Send webhook -> verify processing -> check database state
  });
});
```

## Security Considerations

### Webhook Security
- **Signature Verification**: Always verify SendGrid signatures
- **Timestamp Validation**: Reject old webhooks (replay attacks)
- **Rate Limiting**: Prevent webhook flooding
- **Input Validation**: Sanitize all webhook data

### Data Protection
- **Audit Trail**: Full webhook payloads retained
- **Sensitive Data**: Log filtering for PII
- **Access Control**: Webhook endpoints protected

## Performance Considerations

### Optimization
- **Async Processing**: Never block webhook response
- **Batch Processing**: Handle multiple events efficiently  
- **Database Performance**: Optimized queries and indexes
- **Memory Usage**: Stream large webhook payloads

### Monitoring
- Webhook processing latency
- Event processing success rate
- Queue depth for webhook jobs
- Duplicate webhook frequency

## Error Handling

### Webhook Endpoint
- Always return 200 to SendGrid (prevents retries)
- Log errors for investigation
- Graceful handling of malformed payloads

### Worker Processing
- Retry on transient failures
- Skip invalid events with logging
- Handle duplicate events gracefully

## Rollback Plan

1. **Webhook issues**: Disable webhook processing, investigate
2. **High error rate**: Pause worker, review failed jobs
3. **Performance issues**: Scale worker concurrency
4. **Data corruption**: Reprocess from webhook_deliveries table

## Definition of Done

- [ ] Webhook endpoint receiving SendGrid events successfully
- [ ] Signature verification working correctly
- [ ] Idempotent processing preventing duplicates
- [ ] Events stored and queued for processing
- [ ] Worker processing events and updating message statuses
- [ ] Suppression records created for bounces/unsubscribes
- [ ] Rate limiting preventing abuse
- [ ] Comprehensive error handling and logging
- [ ] Unit and integration tests passing
- [ ] Monitoring and alerting in place