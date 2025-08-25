import { logger } from '@/libs/logger';
import {
  webhookDeliveryRepository,
  messageEventRepository,
  outboundMessageRepository,
  contactCampaignRepository,
} from '@/repositories';
import { SendGridWebhookValidator } from '@/libs/email/sendgrid.webhook.validator';
import { NewWebhookDelivery, NewMessageEvent } from '@/db/schema';
import { campaignPlanExecutionService } from '@/modules/campaign/campaignPlanExecution.service';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';
import type { MessageEvent, OutboundMessage, ContactCampaign } from '@/db/schema';
import {
  SendGridEvent,
  SendGridWebhookPayload,
  ProcessedEventResult,
  WebhookProcessingResult,
  SendGridWebhookError,
  EVENT_NORMALIZATION_MAP,
  SENDGRID_EVENT_TYPES,
  KNOWN_SENDGRID_EVENTS_NOT_RECORDED,
  ALL_KNOWN_SENDGRID_EVENTS,
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
      // This is critical for data isolation and security - we must reject webhooks
      // without tenant context to prevent data leakage across tenants
      const tenantId = this.extractTenantId(events);
      if (!tenantId) {
        throw new SendGridWebhookError(
          'Unable to determine tenant ID from webhook events',
          'MISSING_TENANT_ID',
          400
        );
      }

      // Step 4: Store raw webhook delivery
      const webhookDelivery = await this.storeRawWebhook(tenantId, verification.signature, events);

      // Step 5: Process events
      const processedEvents = await this.processEvents(tenantId, events, processedAtTimestamp);

      // Step 6: Update webhook delivery status
      await this.updateWebhookDeliveryStatus(webhookDelivery.id, tenantId, processedEvents);

      // Step 7: Trigger campaign transitions for successful events
      try {
        await this.processCampaignTransitionsBatch(tenantId, processedEvents, webhookDelivery.id);
      } catch (error) {
        logger.error('Failed to process campaign transitions batch', {
          tenantId,
          webhookDeliveryId: webhookDelivery.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Don't fail webhook processing if batch transition processing fails
      }

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
      let skippedCount = 0;
      let invalidCount = 0;

      for (const [_index, event] of parsed.entries()) {
        const validatedEvent = this.validateEvent(event);
        if (validatedEvent !== null) {
          validatedEvents.push(validatedEvent);
        } else {
          skippedCount++;
          // Check if it was invalid or just not recordable
          if (!event?.event || !SENDGRID_EVENT_TYPES.includes(event.event)) {
            invalidCount++;
          }
        }
      }

      logger.info('Webhook payload validation completed', {
        totalEvents: parsed.length,
        validatedEvents: validatedEvents.length,
        skippedEvents: skippedCount,
        invalidEvents: invalidCount,
      });

      if (validatedEvents.length === 0) {
        // Provide more detailed error message
        const errorMessage =
          invalidCount > 0
            ? `No recordable events found in payload - ${invalidCount} invalid events, ${skippedCount - invalidCount} non-recordable events`
            : 'No recordable events found in payload - all events were non-recordable types';

        throw new SendGridWebhookError(errorMessage, 'NO_RECORDABLE_EVENTS', 400, {
          totalEvents: parsed.length,
          invalidEvents: invalidCount,
          skippedEvents: skippedCount,
        });
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
   * @returns Validated SendGrid event or null if event should be dismissed
   */
  private validateEvent(event: any): SendGridEvent | null {
    if (!event || typeof event !== 'object') {
      logger.warn('Event validation failed: not an object', { event });
      return null; // Don't throw, just skip invalid events
    }

    // Check if this is a known event type that we don't record - dismiss early
    if (KNOWN_SENDGRID_EVENTS_NOT_RECORDED.includes(event.event)) {
      return null; // Dismiss this event without warning
    }

    // Check if this is a valid recorded event type first
    if (!SENDGRID_EVENT_TYPES.includes(event.event)) {
      // Check if it's at least a known SendGrid event type
      if (ALL_KNOWN_SENDGRID_EVENTS.includes(event.event)) {
        return null; // Known but not configured for recording
      }
      // Unknown event type - log but don't fail entire webhook
      logger.warn('Unknown SendGrid event type', { eventType: event.event, event });
      return null;
    }

    // More lenient field validation - check core required fields
    const coreRequiredFields = ['email', 'timestamp', 'event'];
    for (const field of coreRequiredFields) {
      if (!event[field]) {
        logger.warn(`Event missing core required field: ${field}`, { event });
        return null; // Skip this event but don't fail entire webhook
      }
    }

    // Basic type validation
    if (typeof event.email !== 'string' || !event.email.includes('@')) {
      logger.warn('Invalid email address in event', { email: event.email, event });
      return null;
    }

    if (typeof event.timestamp !== 'number' || event.timestamp <= 0) {
      logger.warn('Invalid timestamp in event', { timestamp: event.timestamp, event });
      return null;
    }

    // Generate missing fields if needed
    if (!event.sg_event_id) {
      event.sg_event_id = `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      logger.debug('Generated missing sg_event_id for event', { event });
    }

    if (!event.sg_message_id && event['smtp-id']) {
      event.sg_message_id = event['smtp-id'];
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
  private async storeRawWebhook(tenantId: string, signature: string, events: SendGridEvent[]) {
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
    logger.debug('Processing individual event', {
      tenantId,
      eventType: event.event,
      eventId: event.sg_event_id,
      hasOutboundMessageId: !!event.outbound_message_id,
    });

    const eventMapping = EVENT_NORMALIZATION_MAP[event.event];

    // Check if we should create a message event for this type
    if (!eventMapping.shouldCreateMessageEvent) {
      logger.debug('Skipping event - does not require message event creation', {
        eventType: event.event,
        eventId: event.sg_event_id,
      });
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
        logger.debug('Skipping event - duplicate detected', {
          eventType: event.event,
          eventId: event.sg_event_id,
        });
        return {
          success: true,
          eventId: event.sg_event_id,
          eventType: event.event,
          skipped: true,
          reason: 'Duplicate event detected',
        };
      }
    }

    // Handle unsubscribe events
    if (event.event === 'unsubscribe' || event.event === 'group_unsubscribe') {
      // TODO: Implement unsubscribe handling
      // await this.handleUnsubscribeEvent(event, tenantId);
    }

    // Create normalized message event
    const messageEvent = this.normalizeEvent(event, processedAtTimestamp);

    logger.debug('Creating message event', {
      tenantId,
      eventType: event.event,
      normalizedType: eventMapping.normalizedType,
      messageId: messageEvent.messageId,
      eventId: event.sg_event_id,
    });

    try {
      const created = await messageEventRepository.createForTenant(tenantId, messageEvent);

      logger.info('Message event created successfully', {
        tenantId,
        eventType: event.event,
        messageEventId: created.id,
        eventId: event.sg_event_id,
      });

      return {
        success: true,
        eventId: event.sg_event_id,
        eventType: event.event,
        messageId: created.id,
      };
    } catch (error) {
      logger.error('Failed to create message event', {
        tenantId,
        eventType: event.event,
        eventId: event.sg_event_id,
        error: error instanceof Error ? error.message : 'Unknown error',
        messageEvent,
      });
      throw error;
    }
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

    // Handle missing outbound_message_id by trying to derive it from other fields
    let messageId = event.outbound_message_id;
    if (!messageId) {
      // Try to extract from sg_message_id or smtp-id
      messageId = event.sg_message_id || event['smtp-id'] || 'unknown';
      logger.debug('Derived messageId for event', {
        eventType: event.event,
        derivedMessageId: messageId,
        originalOutboundMessageId: event.outbound_message_id,
        sgMessageId: event.sg_message_id,
        smtpId: event['smtp-id'],
      });
    }

    const normalizedEvent = {
      messageId,
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

    logger.debug('Normalized event for storage', {
      eventType: event.event,
      normalizedType: eventMapping.normalizedType,
      messageId,
      eventAt: normalizedEvent.eventAt.toISOString(),
      sgEventId: normalizedEvent.sgEventId,
    });

    return normalizedEvent;
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

    // List of sensitive header names to remove
    const sensitiveHeaders = ['x-twilio-email-event-webhook-signature', 'authorization', 'cookie'];

    // Remove sensitive headers (handle both string and string array values)
    sensitiveHeaders.forEach((headerName) => {
      delete sanitized[headerName];
    });

    // For remaining headers, sanitize any array values to prevent accidental logging of sensitive data
    Object.keys(sanitized).forEach((key) => {
      const value = sanitized[key];
      if (Array.isArray(value)) {
        // Convert array to safe representation showing count and type info
        sanitized[key] = `[array of ${value.length} value(s)]`;
      }
    });

    return sanitized;
  }

  /**
   * Process campaign transition for a message event
   * @param tenantId - Tenant ID
   * @param messageEvent - Message event that triggered the transition
   */
  private async processCampaignTransition(
    tenantId: string,
    messageEvent: MessageEvent
  ): Promise<void> {
    logger.debug('Processing campaign transition for message event', {
      tenantId,
      messageEventId: messageEvent.id,
      eventType: messageEvent.type,
    });

    // Find the campaign associated with this message
    const outboundMessage = await outboundMessageRepository.findByIdForTenant(
      messageEvent.messageId,
      tenantId
    );
    if (!outboundMessage) {
      logger.debug('No outbound message found for event', {
        messageEventId: messageEvent.id,
        messageId: messageEvent.messageId,
      });
      return;
    }

    const campaign = await contactCampaignRepository.findByIdForTenant(
      outboundMessage.campaignId,
      tenantId
    );
    if (!campaign) {
      logger.debug('No campaign found for message', {
        outboundMessageId: outboundMessage.id,
        campaignId: outboundMessage.campaignId,
      });
      return;
    }

    if (campaign.status !== 'active') {
      logger.debug('Campaign not active, skipping transition', {
        campaignId: campaign.id,
        status: campaign.status,
      });
      return;
    }

    if (!campaign.currentNodeId) {
      logger.debug('Campaign has no current node, skipping transition', {
        campaignId: campaign.id,
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
      eventRef: messageEvent.id,
    });

    logger.info('Campaign transition processed successfully', {
      tenantId,
      campaignId: campaign.id,
      eventType: messageEvent.type,
      currentNodeId: campaign.currentNodeId,
    });
  }

  /**
   * Process campaign transitions for a batch of successful events
   * @param tenantId - Tenant ID
   * @param events - Array of processed events
   * @param webhookDeliveryId - Webhook delivery ID
   */
  private async processCampaignTransitionsBatch(
    tenantId: string,
    events: ProcessedEventResult[],
    webhookDeliveryId: string
  ): Promise<void> {
    const successfulEvents = events.filter((e) => e.success && !e.skipped && e.messageId);

    if (successfulEvents.length === 0) {
      logger.debug('No successful events to process campaign transitions for', {
        webhookDeliveryId,
      });
      return;
    }

    logger.debug('Processing campaign transitions for successful events', {
      webhookDeliveryId,
      eventCount: successfulEvents.length,
    });

    // Step 1: Batch fetch all message events
    const messageEventIds = successfulEvents
      .map((e) => e.messageId)
      .filter((id): id is string => !!id);
    const messageEvents = await messageEventRepository.findByIdsForTenant(
      messageEventIds,
      tenantId
    );

    if (messageEvents.length === 0) {
      logger.debug('No message events found for transition processing', {
        webhookDeliveryId,
        messageEventIds,
      });
      return;
    }

    // Step 2: Batch fetch all outbound messages
    const outboundMessageIds = messageEvents.map((e) => e.messageId);
    const outboundMessages = await outboundMessageRepository.findByIdsForTenant(
      outboundMessageIds,
      tenantId
    );

    if (outboundMessages.length === 0) {
      logger.debug('No outbound messages found for transition processing', {
        webhookDeliveryId,
        outboundMessageIds,
      });
      return;
    }

    // Step 3: Batch fetch all campaigns (deduplicated)
    const campaignIds = [...new Set(outboundMessages.map((m) => m.campaignId))];
    const campaigns = await contactCampaignRepository.findByIdsForTenant(campaignIds, tenantId);

    // Create lookup maps for efficient O(1) access
    const outboundMessageMap = new Map(outboundMessages.map((m) => [m.id, m]));
    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

    // Step 4: Process transitions with pre-fetched data
    let processedCount = 0;
    for (const messageEvent of messageEvents) {
      try {
        const processed = await this.processCampaignTransitionWithData(
          tenantId,
          messageEvent,
          outboundMessageMap,
          campaignMap
        );
        if (processed) processedCount++;
      } catch (error) {
        logger.error('Failed to process campaign transition for message event', {
          tenantId,
          messageEventId: messageEvent.id,
          webhookDeliveryId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    logger.info('Campaign transitions processed successfully for batch', {
      webhookDeliveryId,
      totalEvents: successfulEvents.length,
      processedTransitions: processedCount,
    });
  }

  /**
   * Process campaign transition using pre-fetched data (optimized for batch processing)
   * @param tenantId - Tenant ID
   * @param messageEvent - Message event that triggered the transition
   * @param outboundMessageMap - Pre-fetched outbound messages map
   * @param campaignMap - Pre-fetched campaigns map
   * @returns Boolean indicating if transition was processed
   */
  private async processCampaignTransitionWithData(
    tenantId: string,
    messageEvent: MessageEvent,
    outboundMessageMap: Map<string, OutboundMessage>,
    campaignMap: Map<string, ContactCampaign>
  ): Promise<boolean> {
    logger.debug('Processing campaign transition for message event', {
      tenantId,
      messageEventId: messageEvent.id,
      eventType: messageEvent.type,
    });

    // Find the campaign associated with this message using pre-fetched data
    const outboundMessage = outboundMessageMap.get(messageEvent.messageId);
    if (!outboundMessage) {
      logger.debug('No outbound message found for event', {
        messageEventId: messageEvent.id,
        messageId: messageEvent.messageId,
      });
      return false;
    }

    const campaign = campaignMap.get(outboundMessage.campaignId);
    if (!campaign) {
      logger.debug('No campaign found for message', {
        outboundMessageId: outboundMessage.id,
        campaignId: outboundMessage.campaignId,
      });
      return false;
    }

    if (campaign.status !== 'active') {
      logger.debug('Campaign not active, skipping transition', {
        campaignId: campaign.id,
        status: campaign.status,
      });
      return false;
    }

    if (!campaign.currentNodeId) {
      logger.debug('Campaign has no current node, skipping transition', {
        campaignId: campaign.id,
      });
      return false;
    }

    // Trigger transition processing
    await campaignPlanExecutionService.processTransition({
      tenantId,
      campaignId: campaign.id,
      eventType: messageEvent.type,
      currentNodeId: campaign.currentNodeId,
      plan: campaign.planJson as CampaignPlanOutput,
      eventRef: messageEvent.id,
    });

    logger.info('Campaign transition processed successfully', {
      tenantId,
      campaignId: campaign.id,
      eventType: messageEvent.type,
      currentNodeId: campaign.currentNodeId,
    });

    return true;
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
