import { logger } from '@/libs/logger';
import { webhookDeliveryRepository, messageEventRepository } from '@/repositories';
import { SendGridWebhookValidator } from '@/libs/email/sendgrid.webhook.validator';
import { NewWebhookDelivery, NewMessageEvent } from '@/db/schema';
import {
  SendGridEvent,
  SendGridWebhookPayload,
  ProcessedEventResult,
  WebhookProcessingResult,
  SendGridWebhookError,
  EVENT_NORMALIZATION_MAP,
  SENDGRID_EVENT_TYPES,
} from './sendgrid.webhook.types';

/**
 * SendGrid Webhook Service
 * Handles processing of SendGrid webhook events including:
 * - Raw webhook storage
 * - Event normalization
 * - Duplicate detection
 * - Batch processing
 * - Error handling and logging
 */
export class SendGridWebhookService {
  private readonly validator: SendGridWebhookValidator;
  private readonly enableDuplicateDetection: boolean;
  private readonly batchProcessing: boolean;

  constructor(
    validator: SendGridWebhookValidator,
    options: {
      enableDuplicateDetection?: boolean;
      batchProcessing?: boolean;
    } = {}
  ) {
    this.validator = validator;
    this.enableDuplicateDetection = options.enableDuplicateDetection ?? true;
    this.batchProcessing = options.batchProcessing ?? true;
  }

  /**
   * Process a complete SendGrid webhook request
   * @param headers - Request headers
   * @param rawPayload - Raw request body as string
   * @returns Processing result with details
   */
  public async processWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawPayload: string
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    const processedAtTimestamp = new Date().toISOString();

    logger.info('Processing SendGrid webhook', {
      payloadSize: rawPayload.length,
      headers: this.sanitizeHeaders(headers),
    });

    try {
      // Step 1: Verify webhook signature
      const verification = this.validator.verifyWebhookRequest(headers, rawPayload);
      if (!verification.isValid) {
        throw new SendGridWebhookError(
          `Webhook signature verification failed: ${verification.error}`,
          'SIGNATURE_VERIFICATION_FAILED',
          401
        );
      }

      // Step 2: Parse webhook payload
      const events = this.parseWebhookPayload(rawPayload);
      if (!events || events.length === 0) {
        throw new SendGridWebhookError('No events found in webhook payload', 'EMPTY_PAYLOAD', 400);
      }

      // Step 3: Determine tenant ID from events
      const tenantId = this.extractTenantId(events);
      if (!tenantId) {
        throw new SendGridWebhookError(
          'Unable to determine tenant ID from webhook events',
          'MISSING_TENANT_ID',
          400
        );
      }

      // Step 4: Store raw webhook delivery
      const webhookDelivery = await this.storeRawWebhook(
        tenantId,
        rawPayload,
        verification.signature,
        events
      );

      // Step 5: Process events
      const processedEvents = await this.processEvents(tenantId, events, processedAtTimestamp);

      // Step 6: Update webhook delivery status
      await this.updateWebhookDeliveryStatus(webhookDelivery.id, tenantId, processedEvents);

      const processingTime = Date.now() - startTime;
      const result: WebhookProcessingResult = {
        success: true,
        webhookDeliveryId: webhookDelivery.id,
        processedEvents,
        totalEvents: events.length,
        successfulEvents: processedEvents.filter((e) => e.success && !e.skipped).length,
        failedEvents: processedEvents.filter((e) => !e.success).length,
        skippedEvents: processedEvents.filter((e) => e.skipped).length,
        errors: processedEvents
          .filter((e) => e.error)
          .map((e) => e.error!)
          .filter(Boolean),
      };

      logger.info('SendGrid webhook processed successfully', {
        ...result,
        processingTimeMs: processingTime,
        tenantId,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('SendGrid webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: processingTime,
        payloadSize: rawPayload.length,
      });

      if (error instanceof SendGridWebhookError) {
        throw error;
      }

      throw new SendGridWebhookError(
        `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROCESSING_FAILED',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Parse and validate webhook payload
   * @param rawPayload - Raw JSON payload
   * @returns Array of SendGrid events
   */
  private parseWebhookPayload(rawPayload: string): SendGridWebhookPayload {
    try {
      const parsed = JSON.parse(rawPayload);

      // Validate that it's an array
      if (!Array.isArray(parsed)) {
        throw new SendGridWebhookError(
          'Webhook payload must be an array of events',
          'INVALID_PAYLOAD_FORMAT',
          400
        );
      }

      // Validate each event
      const validatedEvents: SendGridEvent[] = [];
      for (const [index, event] of parsed.entries()) {
        try {
          const validatedEvent = this.validateEvent(event);
          validatedEvents.push(validatedEvent);
        } catch (error) {
          logger.warn(`Invalid event at index ${index}`, {
            event,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Continue processing other events instead of failing the entire webhook
        }
      }

      if (validatedEvents.length === 0) {
        throw new SendGridWebhookError('No valid events found in payload', 'NO_VALID_EVENTS', 400);
      }

      return validatedEvents;
    } catch (error) {
      if (error instanceof SendGridWebhookError) {
        throw error;
      }
      throw new SendGridWebhookError('Failed to parse webhook payload JSON', 'INVALID_JSON', 400, {
        originalError: error,
      });
    }
  }

  /**
   * Validate individual SendGrid event
   * @param event - Raw event object
   * @returns Validated SendGrid event
   */
  private validateEvent(event: any): SendGridEvent {
    if (!event || typeof event !== 'object') {
      throw new Error('Event must be an object');
    }

    const requiredFields = [
      'email',
      'timestamp',
      'smtp-id',
      'event',
      'sg_event_id',
      'sg_message_id',
    ];
    for (const field of requiredFields) {
      if (!event[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!SENDGRID_EVENT_TYPES.includes(event.event)) {
      throw new Error(`Invalid event type: ${event.event}`);
    }

    // Basic type validation
    if (typeof event.email !== 'string' || !event.email.includes('@')) {
      throw new Error('Invalid email address');
    }

    if (typeof event.timestamp !== 'number' || event.timestamp <= 0) {
      throw new Error('Invalid timestamp');
    }

    return event as SendGridEvent;
  }

  /**
   * Extract tenant ID from events
   * @param events - Array of validated events
   * @returns Tenant ID or null
   */
  private extractTenantId(events: SendGridEvent[]): string | null {
    for (const event of events) {
      if (event.tenant_id) {
        return event.tenant_id;
      }
    }
    return null;
  }

  /**
   * Store raw webhook delivery
   * @param tenantId - Tenant ID
   * @param payload - Raw payload
   * @param signature - Webhook signature
   * @param events - Parsed events
   * @returns Stored webhook delivery
   */
  private async storeRawWebhook(
    tenantId: string,
    payload: string,
    signature: string,
    events: SendGridEvent[]
  ) {
    const webhookData: Omit<NewWebhookDelivery, 'tenantId'> = {
      provider: 'sendgrid',
      eventType: events.length === 1 && events[0] ? events[0].event : 'batch',
      messageId: this.extractMessageId(events),
      payload: events,
      signature,
      status: 'received',
    };

    return await webhookDeliveryRepository.createForTenant(tenantId, webhookData);
  }

  /**
   * Extract message ID from events (if single event)
   * @param events - Array of events
   * @returns Message ID or null
   */
  private extractMessageId(events: SendGridEvent[]): string | null {
    if (events.length === 1 && events[0] && events[0].outbound_message_id) {
      return events[0].outbound_message_id;
    }
    return null;
  }

  /**
   * Process array of events
   * @param tenantId - Tenant ID
   * @param events - Array of validated events
   * @param processedAtTimestamp - Pre-generated timestamp for batch processing
   * @returns Array of processing results
   */
  private async processEvents(
    tenantId: string,
    events: SendGridEvent[],
    processedAtTimestamp: string
  ): Promise<ProcessedEventResult[]> {
    const results: ProcessedEventResult[] = [];

    if (this.batchProcessing) {
      // Process all events in parallel for better performance
      const promises = events.map((event) =>
        this.processEvent(tenantId, event, processedAtTimestamp)
      );
      const eventResults = await Promise.allSettled(promises);

      for (const [index, result] of eventResults.entries()) {
        if (!events[index]) {
          continue;
        }

        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            eventId: events[index].sg_event_id,
            eventType: events[index].event,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          });
        }
      }
    } else {
      // Process events sequentially
      for (const event of events) {
        try {
          const result = await this.processEvent(tenantId, event, processedAtTimestamp);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            eventId: event.sg_event_id,
            eventType: event.event,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  /**
   * Process individual event
   * @param tenantId - Tenant ID
   * @param event - SendGrid event
   * @param processedAtTimestamp - Pre-generated timestamp for batch processing
   * @returns Processing result
   */
  private async processEvent(
    tenantId: string,
    event: SendGridEvent,
    processedAtTimestamp: string
  ): Promise<ProcessedEventResult> {
    const eventMapping = EVENT_NORMALIZATION_MAP[event.event];

    // Check if we should create a message event for this type
    if (!eventMapping.shouldCreateMessageEvent) {
      return {
        success: true,
        eventId: event.sg_event_id,
        eventType: event.event,
        skipped: true,
        reason: 'Event type does not require message event creation',
      };
    }

    // Check for duplicates if enabled
    if (this.enableDuplicateDetection) {
      const isDuplicate = await this.checkForDuplicate(tenantId, event);
      if (isDuplicate) {
        return {
          success: true,
          eventId: event.sg_event_id,
          eventType: event.event,
          skipped: true,
          reason: 'Duplicate event detected',
        };
      }
    }

    // Create normalized message event
    const messageEvent = this.normalizeEvent(event, processedAtTimestamp);
    const created = await messageEventRepository.createForTenant(tenantId, messageEvent);

    return {
      success: true,
      eventId: event.sg_event_id,
      eventType: event.event,
      messageId: created.id,
    };
  }

  /**
   * Check for duplicate events
   * @param tenantId - Tenant ID
   * @param event - SendGrid event
   * @returns True if duplicate found
   */
  private async checkForDuplicate(tenantId: string, event: SendGridEvent): Promise<boolean> {
    if (!event.sg_event_id) {
      // If no sg_event_id, we can't perform duplicate detection
      return false;
    }

    try {
      const existing = await messageEventRepository.findBySgEventIdForTenant(
        tenantId,
        event.sg_event_id
      );
      return !!existing;
    } catch (error) {
      logger.warn('Error checking for duplicates', { error, eventId: event.sg_event_id });
      return false; // If we can't check, proceed with processing
    }
  }

  /**
   * Normalize SendGrid event to internal message event format
   * @param event - SendGrid event
   * @param processedAtTimestamp - Pre-generated timestamp for batch processing
   * @returns Normalized message event data
   */
  private normalizeEvent(
    event: SendGridEvent,
    processedAtTimestamp: string
  ): Omit<NewMessageEvent, 'tenantId'> {
    const eventMapping = EVENT_NORMALIZATION_MAP[event.event];

    return {
      messageId: event.outbound_message_id || 'unknown',
      type: eventMapping.normalizedType,
      eventAt: new Date(event.timestamp * 1000),
      sgEventId: event.sg_event_id || null,
      data: {
        // Store complete original event for debugging and analytics
        ...event,
        // Add processing metadata
        processedAt: processedAtTimestamp,
        provider: 'sendgrid',
        normalizedType: eventMapping.normalizedType,
      },
    };
  }

  /**
   * Update webhook delivery status after processing
   * @param webhookDeliveryId - Webhook delivery ID
   * @param tenantId - Tenant ID
   * @param results - Processing results
   */
  private async updateWebhookDeliveryStatus(
    webhookDeliveryId: string,
    tenantId: string,
    results: ProcessedEventResult[]
  ): Promise<void> {
    const hasErrors = results.some((r) => !r.success);
    const status = hasErrors ? 'partial_failure' : 'processed';

    await webhookDeliveryRepository.updateByIdForTenant(webhookDeliveryId, tenantId, { status });
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   * @param headers - Request headers
   * @returns Sanitized headers
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };

    // Remove sensitive headers
    delete sanitized['x-twilio-email-event-webhook-signature'];
    delete sanitized['authorization'];
    delete sanitized['cookie'];

    return sanitized;
  }

  /**
   * Create service instance from environment configuration
   * @returns Configured service instance
   */
  public static fromEnvironment(): SendGridWebhookService {
    const validator = SendGridWebhookValidator.fromEnvironment();

    return new SendGridWebhookService(validator, {
      enableDuplicateDetection: process.env.SENDGRID_WEBHOOK_DUPLICATE_DETECTION !== 'false',
      batchProcessing: process.env.SENDGRID_WEBHOOK_BATCH_PROCESSING !== 'false',
    });
  }
}

// Export singleton instance factory (lazy initialization)
let _sendGridWebhookService: SendGridWebhookService | null = null;

export const sendGridWebhookService = {
  get instance(): SendGridWebhookService {
    if (!_sendGridWebhookService) {
      _sendGridWebhookService = SendGridWebhookService.fromEnvironment();
    }
    return _sendGridWebhookService;
  },
};
