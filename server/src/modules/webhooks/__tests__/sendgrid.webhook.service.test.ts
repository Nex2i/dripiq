import { SendGridWebhookValidator } from '@/libs/email/sendgrid.webhook.validator';
import {
  webhookDeliveryRepository,
  messageEventRepository,
  outboundMessageRepository,
  contactCampaignRepository,
} from '@/repositories';
import { campaignPlanExecutionService } from '@/modules/campaign/campaignPlanExecution.service';
import { SendGridWebhookService } from '../sendgrid.webhook.service';
import { SendGridWebhookError, SendGridEvent } from '../sendgrid.webhook.types';

// Mock dependencies
jest.mock('@/repositories', () => ({
  webhookDeliveryRepository: {
    createForTenant: jest.fn(),
    updateByIdForTenant: jest.fn(),
  },
  messageEventRepository: {
    createForTenant: jest.fn(),
    findAllForTenant: jest.fn(),
    findBySgEventIdForTenant: jest.fn(),
    findByIdForTenant: jest.fn(),
    findByIdsForTenant: jest.fn(),
  },
  outboundMessageRepository: {
    findByIdForTenant: jest.fn(),
    findByIdsForTenant: jest.fn(),
  },
  contactCampaignRepository: {
    findByIdForTenant: jest.fn(),
    findByIdsForTenant: jest.fn(),
  },
}));

jest.mock('@/libs/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/modules/campaign/campaignPlanExecution.service', () => ({
  campaignPlanExecutionService: {
    processTransition: jest.fn(),
  },
}));

describe('SendGridWebhookService', () => {
  let service: SendGridWebhookService;
  let mockValidator: jest.Mocked<SendGridWebhookValidator>;

  const mockWebhookDeliveryRepo = webhookDeliveryRepository as jest.Mocked<
    typeof webhookDeliveryRepository
  >;
  const mockMessageEventRepo = messageEventRepository as jest.Mocked<typeof messageEventRepository>;
  const mockOutboundMessageRepo = outboundMessageRepository as jest.Mocked<
    typeof outboundMessageRepository
  >;
  const mockContactCampaignRepo = contactCampaignRepository as jest.Mocked<
    typeof contactCampaignRepository
  >;
  const mockCampaignPlanExecutionService = campaignPlanExecutionService as jest.Mocked<
    typeof campaignPlanExecutionService
  >;

  // Shared mock data accessible throughout all test blocks
  const mockHeaders = {
    'x-twilio-email-event-webhook-signature': 'valid-signature',
    'x-twilio-email-event-webhook-timestamp': '1234567890',
    'content-type': 'application/json',
  };

  const mockSendGridEvent: SendGridEvent = {
    email: 'test@example.com',
    timestamp: 1234567890,
    'smtp-id': 'smtp-id-123',
    event: 'delivered',
    category: ['test'],
    sg_event_id: 'sg-event-123',
    sg_message_id: 'sg-message-456',
    tenant_id: 'tenant-123',
    campaign_id: 'campaign-456',
    outbound_message_id: 'message-789',
    response: 'Message delivered',
  } as any;

  const mockPayload = JSON.stringify([mockSendGridEvent]);

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock validator
    mockValidator = {
      verifyWebhookRequest: jest.fn(),
      verifySignature: jest.fn(),
    } as any;

    service = new SendGridWebhookService(mockValidator, {
      enableDuplicateDetection: true,
      batchProcessing: true,
    });
  });

  describe('processWebhook', () => {
    it('should successfully process valid webhook', async () => {
      // Setup mocks
      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: mockPayload,
        isValid: true,
      });

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'delivered',
        messageId: 'message-789',
        receivedAt: new Date(),
        payload: [mockSendGridEvent],
        signature: 'valid-signature',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockMessageEventRepo.createForTenant.mockResolvedValue({
        id: 'message-event-123',
        tenantId: 'tenant-123',
        messageId: 'message-789',
        type: 'delivered',
        eventAt: new Date(),
        sgEventId: 'sg-event-123',
        data: mockSendGridEvent,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue(undefined);

      // Execute
      const result = await service.processWebhook(mockHeaders, mockPayload);

      // Verify
      expect(result.success).toBe(true);
      expect(result.totalEvents).toBe(1);
      expect(result.successfulEvents).toBe(1);
      expect(result.failedEvents).toBe(0);
      expect(result.skippedEvents).toBe(0);
      expect(result.webhookDeliveryId).toBe('webhook-delivery-123');

      expect(mockValidator.verifyWebhookRequest).toHaveBeenCalledWith(mockHeaders, mockPayload);
      expect(mockWebhookDeliveryRepo.createForTenant).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({
          provider: 'sendgrid',
          eventType: 'delivered',
          messageId: 'message-789',
        })
      );
      expect(mockMessageEventRepo.createForTenant).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({
          messageId: 'message-789',
          type: 'delivered',
        })
      );
    });

    it('should reject webhook with invalid signature', async () => {
      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'invalid-signature',
        timestamp: '1234567890',
        payload: mockPayload,
        isValid: false,
        error: 'Signature verification failed',
      });

      await expect(service.processWebhook(mockHeaders, mockPayload)).rejects.toThrow(
        SendGridWebhookError
      );

      expect(mockWebhookDeliveryRepo.createForTenant).not.toHaveBeenCalled();
      expect(mockMessageEventRepo.createForTenant).not.toHaveBeenCalled();
    });

    it('should reject webhook with empty payload', async () => {
      const emptyPayload = '[]';
      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: emptyPayload,
        isValid: true,
      });

      await expect(service.processWebhook(mockHeaders, emptyPayload)).rejects.toThrow(
        SendGridWebhookError
      );
      await expect(service.processWebhook(mockHeaders, emptyPayload)).rejects.toThrow(
        'No recordable events found in payload'
      );
    });

    it('should reject webhook with invalid JSON', async () => {
      const invalidJson = 'invalid-json';
      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: invalidJson,
        isValid: true,
      });

      await expect(service.processWebhook(mockHeaders, invalidJson)).rejects.toThrow(
        SendGridWebhookError
      );
    });

    it('should reject webhook without tenant ID', async () => {
      const eventWithoutTenant = { ...mockSendGridEvent };
      delete eventWithoutTenant.tenant_id;
      const payload = JSON.stringify([eventWithoutTenant]);

      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload,
        isValid: true,
      });

      await expect(service.processWebhook(mockHeaders, payload)).rejects.toThrow(
        SendGridWebhookError
      );
      await expect(service.processWebhook(mockHeaders, payload)).rejects.toThrow(
        'Unable to determine tenant ID from webhook events'
      );
    });

    it('should handle batch events', async () => {
      const event2: SendGridEvent = {
        ...mockSendGridEvent,
        event: 'open',
        sg_event_id: 'sg-event-456',
        useragent: 'Mozilla/5.0',
        ip: '192.168.1.1',
      } as any;

      const batchPayload = JSON.stringify([mockSendGridEvent, event2]);

      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: batchPayload,
        isValid: true,
      });

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'batch',
        messageId: null,
        receivedAt: new Date(),
        payload: [mockSendGridEvent, event2],
        signature: 'valid-signature',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockMessageEventRepo.createForTenant
        .mockResolvedValueOnce({
          id: 'message-event-123',
          tenantId: 'tenant-123',
          messageId: 'message-789',
          type: 'delivered',
          eventAt: new Date(),
          sgEventId: 'sg-event-123',
          data: mockSendGridEvent,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'message-event-456',
          tenantId: 'tenant-123',
          messageId: 'message-789',
          type: 'open',
          eventAt: new Date(),
          sgEventId: 'sg-event-456',
          data: event2,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue(undefined);

      const result = await service.processWebhook(mockHeaders, batchPayload);

      expect(result.success).toBe(true);
      expect(result.totalEvents).toBe(2);
      expect(result.successfulEvents).toBe(2);
      expect(mockMessageEventRepo.createForTenant).toHaveBeenCalledTimes(2);
    });

    it('should skip deferred events', async () => {
      const deferredEvent: SendGridEvent = {
        ...mockSendGridEvent,
        event: 'deferred',
        response: 'Temporarily deferred',
        attempt: '1',
      } as any;

      const payload = JSON.stringify([deferredEvent]);

      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload,
        isValid: true,
      });

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'deferred',
        messageId: 'message-789',
        receivedAt: new Date(),
        payload: [deferredEvent],
        signature: 'valid-signature',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.processWebhook(mockHeaders, payload);

      expect(result.success).toBe(true);
      expect(result.totalEvents).toBe(1);
      expect(result.successfulEvents).toBe(0);
      expect(result.skippedEvents).toBe(1);
      expect(mockMessageEventRepo.createForTenant).not.toHaveBeenCalled();
    });

    it('should detect and skip duplicate events', async () => {
      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: mockPayload,
        isValid: true,
      });

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'delivered',
        messageId: 'message-789',
        receivedAt: new Date(),
        payload: [mockSendGridEvent],
        signature: 'valid-signature',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock existing event (duplicate)
      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue({
        id: 'existing-event',
        tenantId: 'tenant-123',
        messageId: 'message-789',
        type: 'delivered',
        eventAt: new Date(),
        sgEventId: 'sg-event-123',
        data: { sg_event_id: 'sg-event-123' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.processWebhook(mockHeaders, mockPayload);

      expect(result.success).toBe(true);
      expect(result.totalEvents).toBe(1);
      expect(result.successfulEvents).toBe(0);
      expect(result.skippedEvents).toBe(1);
      expect(mockMessageEventRepo.createForTenant).not.toHaveBeenCalled();
    });

    it('should handle partial failures gracefully', async () => {
      const event2: SendGridEvent = {
        ...mockSendGridEvent,
        sg_event_id: 'sg-event-456',
        event: 'open',
      } as any;

      const batchPayload = JSON.stringify([mockSendGridEvent, event2]);

      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: batchPayload,
        isValid: true,
      });

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'batch',
        messageId: null,
        receivedAt: new Date(),
        payload: [mockSendGridEvent, event2],
        signature: 'valid-signature',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue(undefined);

      // First event succeeds, second fails
      mockMessageEventRepo.createForTenant
        .mockResolvedValueOnce({
          id: 'message-event-123',
          tenantId: 'tenant-123',
          messageId: 'message-789',
          type: 'delivered',
          eventAt: new Date(),
          sgEventId: 'sg-event-123',
          data: mockSendGridEvent,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await service.processWebhook(mockHeaders, batchPayload);

      expect(result.success).toBe(true);
      expect(result.totalEvents).toBe(2);
      expect(result.successfulEvents).toBe(1);
      expect(result.failedEvents).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Database error');

      // Verify webhook status was updated to partial_failure
      expect(mockWebhookDeliveryRepo.updateByIdForTenant).toHaveBeenCalledWith(
        'webhook-delivery-123',
        'tenant-123',
        { status: 'partial_failure' }
      );
    });

    it('should handle invalid events gracefully', async () => {
      const invalidEvent = {
        // Missing required fields
        email: 'test@example.com',
        event: 'delivered',
      };

      const validEvent = { ...mockSendGridEvent, sg_event_id: 'valid-event' };
      const mixedPayload = JSON.stringify([invalidEvent, validEvent]);

      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: mixedPayload,
        isValid: true,
      });

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'batch',
        messageId: null,
        receivedAt: new Date(),
        payload: [validEvent], // Only valid event should be stored
        signature: 'valid-signature',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue(undefined);
      mockMessageEventRepo.createForTenant.mockResolvedValue({
        id: 'message-event-123',
        tenantId: 'tenant-123',
        messageId: 'message-789',
        type: 'delivered',
        eventAt: new Date(),
        sgEventId: 'valid-event',
        data: validEvent,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.processWebhook(mockHeaders, mixedPayload);

      expect(result.success).toBe(true);
      expect(result.totalEvents).toBe(1); // Only valid events are processed
      expect(result.successfulEvents).toBe(1);
    });

    it('should skip webhook events from different environment', async () => {
      // Setup webhook validator
      const mockValidator = {
        verifyWebhookRequest: jest.fn().mockReturnValue({
          isValid: true,
          signature: 'valid-signature',
        }),
      } as unknown as SendGridWebhookValidator;

      const service = new SendGridWebhookService(mockValidator);

      // Create event from different environment
      const mockSendGridEvent: SendGridEvent = {
        email: 'test@example.com',
        timestamp: 1640995200,
        event: 'open',
        sg_event_id: 'event-123',
        tenant_id: 'tenant-123',
        outbound_message_id: 'message-789',
        useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ip: '192.168.1.1',
        sg_message_id: 'sg-message-123',
        environment: 'production', // Different from current test environment
      };

      const payload = JSON.stringify([mockSendGridEvent]);
      const headers = { 'x-twilio-email-event-webhook-signature': 'valid-signature' };

      const result = await service.processWebhook(headers, payload);

      expect(result).toEqual({
        success: true,
        webhookDeliveryId: 'env-skipped',
        processedEvents: [],
        totalEvents: 1,
        successfulEvents: 0,
        failedEvents: 0,
        skippedEvents: 1,
        errors: [],
      });

      // Verify that no repository methods were called
      expect(mockWebhookDeliveryRepo.createForTenant).not.toHaveBeenCalled();
      expect(mockMessageEventRepo.createForTenant).not.toHaveBeenCalled();
    });

    it('should process webhook events from same environment', async () => {
      // Setup webhook validator
      const mockValidator = {
        verifyWebhookRequest: jest.fn().mockReturnValue({
          isValid: true,
          signature: 'valid-signature',
        }),
      } as unknown as SendGridWebhookValidator;

      const service = new SendGridWebhookService(mockValidator);

      // Mock successful responses
      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'open',
        messageId: 'message-789',
        receivedAt: new Date(),
        payload: [],
        signature: 'valid-signature',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockMessageEventRepo.createForTenant.mockResolvedValue({
        id: 'message-event-123',
        tenantId: 'tenant-123',
        messageId: 'message-789',
        type: 'open',
        eventAt: new Date(),
        sgEventId: 'event-123',
        data: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create event from same environment (test)
      const mockSendGridEvent: SendGridEvent = {
        email: 'test@example.com',
        timestamp: 1640995200,
        event: 'open',
        sg_event_id: 'event-123',
        tenant_id: 'tenant-123',
        outbound_message_id: 'message-789',
        useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ip: '192.168.1.1',
        sg_message_id: 'sg-message-123',
        environment: 'test', // Same as current test environment
      };

      const payload = JSON.stringify([mockSendGridEvent]);
      const headers = { 'x-twilio-email-event-webhook-signature': 'valid-signature' };

      const result = await service.processWebhook(headers, payload);

      expect(result.success).toBe(true);
      expect(result.webhookDeliveryId).toBe('webhook-delivery-123');
      expect(result.totalEvents).toBe(1);
      expect(result.successfulEvents).toBe(1);
      expect(result.skippedEvents).toBe(0);

      // Verify that repository methods were called
      expect(mockWebhookDeliveryRepo.createForTenant).toHaveBeenCalled();
      expect(mockMessageEventRepo.createForTenant).toHaveBeenCalled();
    });

    it('should allow events without environment field for backward compatibility', async () => {
      // Setup webhook validator
      const mockValidator = {
        verifyWebhookRequest: jest.fn().mockReturnValue({
          isValid: true,
          signature: 'valid-signature',
        }),
      } as unknown as SendGridWebhookValidator;

      const service = new SendGridWebhookService(mockValidator);

      // Mock successful responses
      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'open',
        messageId: 'message-789',
        receivedAt: new Date(),
        payload: [],
        signature: 'valid-signature',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockMessageEventRepo.createForTenant.mockResolvedValue({
        id: 'message-event-123',
        tenantId: 'tenant-123',
        messageId: 'message-789',
        type: 'open',
        eventAt: new Date(),
        sgEventId: 'event-123',
        data: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create event without environment field (backward compatibility)
      const mockSendGridEvent: SendGridEvent = {
        email: 'test@example.com',
        timestamp: 1640995200,
        event: 'open',
        sg_event_id: 'event-123',
        tenant_id: 'tenant-123',
        outbound_message_id: 'message-789',
        useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ip: '192.168.1.1',
        sg_message_id: 'sg-message-123',
        // No environment field
      };

      const payload = JSON.stringify([mockSendGridEvent]);
      const headers = { 'x-twilio-email-event-webhook-signature': 'valid-signature' };

      const result = await service.processWebhook(headers, payload);

      expect(result.success).toBe(true);
      expect(result.webhookDeliveryId).toBe('webhook-delivery-123');
      expect(result.totalEvents).toBe(1);
      expect(result.successfulEvents).toBe(1);

      // Verify that repository methods were called (backward compatibility)
      expect(mockWebhookDeliveryRepo.createForTenant).toHaveBeenCalled();
      expect(mockMessageEventRepo.createForTenant).toHaveBeenCalled();
    });
  });

  describe('event validation', () => {
    it('should validate required fields', () => {
      const invalidEvents = [
        { email: 'test@example.com' }, // Missing other required fields
        { timestamp: 123456789 }, // Missing email
        { email: 'invalid-email' }, // Invalid email format
        { email: 'test@example.com', timestamp: 'invalid' }, // Invalid timestamp
        { email: 'test@example.com', timestamp: 123456789, event: 'invalid' }, // Invalid event type
      ];

      const payload = JSON.stringify(invalidEvents);

      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload,
        isValid: true,
      });

      // Should throw because no recordable events found
      expect(service.processWebhook({}, payload)).rejects.toThrow(
        'No recordable events found in payload'
      );
    });

    it('should dismiss known but non-recorded events without warnings', async () => {
      const eventsWithProcessed = [
        {
          email: 'test@example.com',
          timestamp: 1234567890,
          'smtp-id': '<test@smtp.example.com>',
          event: 'processed', // This should be dismissed
          sg_event_id: 'processed-event-123',
          sg_message_id: 'msg-123',
          tenant_id: 'tenant-123',
          campaign_id: 'campaign-123',
          node_id: 'node-123',
          outbound_message_id: 'outbound-123',
          dedupe_key: 'dedupe-123',
        },
        {
          email: 'test@example.com',
          timestamp: 1234567890,
          'smtp-id': '<test@smtp.example.com>',
          event: 'delivered', // This should be recorded
          sg_event_id: 'delivered-event-123',
          sg_message_id: 'msg-123',
          tenant_id: 'tenant-123',
          campaign_id: 'campaign-123',
          node_id: 'node-123',
          outbound_message_id: 'outbound-123',
          dedupe_key: 'dedupe-123',
          response: 'OK',
        },
      ];

      const payload = JSON.stringify(eventsWithProcessed);

      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload,
        isValid: true,
      });

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'delivered',
        messageId: null,
        receivedAt: expect.any(Date),
        payload: JSON.parse(payload),
        signature: 'valid-signature',
        status: 'processed',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue(undefined);
      mockMessageEventRepo.createForTenant.mockResolvedValue({
        id: 'event-123',
        tenantId: 'tenant-123',
        messageId: 'outbound-123',
        type: 'delivered',
        eventAt: expect.any(Date),
        sgEventId: 'delivered-event-123',
        data: expect.any(Object),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const result = await service.processWebhook({}, payload);

      expect(result.success).toBe(true);
      expect(result.totalEvents).toBe(1); // Only the delivered event should be processed
      expect(result.successfulEvents).toBe(1);
      expect(result.failedEvents).toBe(0);
      // Verify that only the delivered event was recorded
      expect(mockMessageEventRepo.createForTenant).toHaveBeenCalledTimes(1);
    });
  });

  describe('configuration options', () => {
    it('should disable duplicate detection when configured', async () => {
      const serviceWithoutDuplicateDetection = new SendGridWebhookService(mockValidator, {
        enableDuplicateDetection: false,
        batchProcessing: true,
      });

      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: mockPayload,
        isValid: true,
      });

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'delivered',
        messageId: 'message-789',
        receivedAt: new Date(),
        payload: [mockSendGridEvent],
        signature: 'valid-signature',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockMessageEventRepo.createForTenant.mockResolvedValue({
        id: 'message-event-123',
        tenantId: 'tenant-123',
        messageId: 'message-789',
        type: 'delivered',
        eventAt: new Date(),
        sgEventId: 'sg-event-123',
        data: mockSendGridEvent,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await serviceWithoutDuplicateDetection.processWebhook(mockHeaders, mockPayload);

      // Should not check for duplicates
      expect(mockMessageEventRepo.findBySgEventIdForTenant).not.toHaveBeenCalled();
      expect(mockMessageEventRepo.createForTenant).toHaveBeenCalled();
    });

    it('should process events sequentially when batch processing is disabled', async () => {
      const serviceWithoutBatchProcessing = new SendGridWebhookService(mockValidator, {
        enableDuplicateDetection: true,
        batchProcessing: false,
      });

      const event2: SendGridEvent = {
        ...mockSendGridEvent,
        sg_event_id: 'sg-event-456',
        event: 'open',
      } as any;

      const batchPayload = JSON.stringify([mockSendGridEvent, event2]);

      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: batchPayload,
        isValid: true,
      });

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue({
        id: 'webhook-delivery-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'batch',
        messageId: null,
        receivedAt: new Date(),
        payload: [mockSendGridEvent, event2],
        signature: 'valid-signature',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue(undefined);
      mockMessageEventRepo.createForTenant
        .mockResolvedValueOnce({
          id: 'message-event-123',
          tenantId: 'tenant-123',
          messageId: 'message-789',
          type: 'delivered',
          eventAt: new Date(),
          sgEventId: 'sg-event-123',
          data: mockSendGridEvent,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'message-event-456',
          tenantId: 'tenant-123',
          messageId: 'message-789',
          type: 'open',
          eventAt: new Date(),
          sgEventId: 'sg-event-456',
          data: event2,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const result = await serviceWithoutBatchProcessing.processWebhook(mockHeaders, batchPayload);

      expect(result.success).toBe(true);
      expect(result.totalEvents).toBe(2);
      expect(result.successfulEvents).toBe(2);
    });
  });

  describe('campaign transition processing', () => {
    beforeEach(() => {
      // Reset all mocks before each test
      jest.clearAllMocks();
    });

    it('should trigger campaign transition for successful message events', async () => {
      // Setup mocks for campaign transition success scenario
      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: JSON.stringify([mockSendGridEvent]),
        isValid: true,
      });

      const mockWebhookDelivery = {
        id: 'webhook-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'delivered',
        status: 'received',
        messageId: null,
        receivedAt: new Date(),
        payload: mockSendGridEvent,
        signature: 'valid-signature',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockMessageEvent = {
        id: 'message-event-123',
        tenantId: 'tenant-123',
        messageId: 'outbound-message-123',
        type: 'delivered',
        eventAt: new Date(),
        sgEventId: 'sg-event-123',
        data: mockSendGridEvent,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockOutboundMessage = {
        id: 'outbound-message-123',
        tenantId: 'tenant-123',
        campaignId: 'campaign-123',
        contactId: 'contact-123',
        channel: 'email' as const,
        status: 'sent',
        senderIdentityId: null,
        providerMessageId: null,
        dedupeKey: 'dedupe-123',
        content: {},
        sentAt: new Date(),
        deliveredAt: null,
        failedAt: null,
        errorMessage: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockCampaign = {
        id: 'campaign-123',
        tenantId: 'tenant-123',
        leadId: 'lead-123',
        contactId: 'contact-123',
        channel: 'email' as const,
        status: 'active' as const,
        currentNodeId: 'node-123',
        planJson: { nodes: [], startNodeId: 'node-123' },
        planVersion: '1.0',
        planHash: 'hash-123',
        senderIdentityId: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue(mockWebhookDelivery);
      mockMessageEventRepo.createForTenant.mockResolvedValue(mockMessageEvent);
      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue(undefined);
      mockMessageEventRepo.findByIdsForTenant.mockResolvedValue([mockMessageEvent]);
      mockOutboundMessageRepo.findByIdsForTenant.mockResolvedValue([mockOutboundMessage]);
      mockContactCampaignRepo.findByIdsForTenant.mockResolvedValue([mockCampaign]);
      mockCampaignPlanExecutionService.processTransition.mockResolvedValue({
        success: true,
      });

      // Execute
      const result = await service.processWebhook(mockHeaders, JSON.stringify([mockSendGridEvent]));

      // Verify webhook processing succeeded
      expect(result.success).toBe(true);
      expect(result.successfulEvents).toBe(1);

      // Verify batch queries were used (key performance optimization)
      expect(mockMessageEventRepo.findByIdsForTenant).toHaveBeenCalledWith(
        ['message-event-123'],
        'tenant-123'
      );
      expect(mockOutboundMessageRepo.findByIdsForTenant).toHaveBeenCalledWith(
        ['outbound-message-123'],
        'tenant-123'
      );
      expect(mockContactCampaignRepo.findByIdsForTenant).toHaveBeenCalledWith(
        ['campaign-123'],
        'tenant-123'
      );

      // Verify campaign transition was triggered
      expect(mockCampaignPlanExecutionService.processTransition).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        campaignId: 'campaign-123',
        contactId: 'contact-123',
        leadId: 'lead-123',
        eventType: 'delivered',
        currentNodeId: 'node-123',
        plan: { nodes: [], startNodeId: 'node-123' },
        eventRef: 'message-event-123',
      });
    });

    it('should skip campaign transition for inactive campaigns', async () => {
      // Setup mocks for inactive campaign scenario
      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: JSON.stringify([mockSendGridEvent]),
        isValid: true,
      });

      const mockWebhookDelivery = {
        id: 'webhook-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'delivered',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockMessageEvent = {
        id: 'message-event-123',
        tenantId: 'tenant-123',
        messageId: 'outbound-message-123',
        type: 'delivered',
        eventAt: new Date(),
        sgEventId: 'sg-event-123',
        data: mockSendGridEvent,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockOutboundMessage = {
        id: 'outbound-message-123',
        tenantId: 'tenant-123',
        campaignId: 'campaign-123',
        contactId: 'contact-123',
        channel: 'email',
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockInactiveCampaign = {
        id: 'campaign-123',
        tenantId: 'tenant-123',
        leadId: 'lead-123',
        contactId: 'contact-123',
        channel: 'email',
        status: 'draft', // Inactive campaign
        currentNodeId: 'node-123',
        planJson: { nodes: [], startNodeId: 'node-123' },
        planVersion: '1.0',
        planHash: 'hash-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue(mockWebhookDelivery);
      mockMessageEventRepo.createForTenant.mockResolvedValue(mockMessageEvent);
      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue(undefined);
      mockMessageEventRepo.findByIdsForTenant.mockResolvedValue([mockMessageEvent]);
      mockOutboundMessageRepo.findByIdsForTenant.mockResolvedValue([mockOutboundMessage]);
      mockContactCampaignRepo.findByIdsForTenant.mockResolvedValue([mockInactiveCampaign]);

      // Execute
      const result = await service.processWebhook(mockHeaders, JSON.stringify([mockSendGridEvent]));

      // Verify webhook processing succeeded
      expect(result.success).toBe(true);
      expect(result.successfulEvents).toBe(1);

      // Verify campaign transition was NOT triggered
      expect(mockCampaignPlanExecutionService.processTransition).not.toHaveBeenCalled();
    });

    it('should handle campaign transition errors gracefully', async () => {
      // Setup mocks for campaign transition error scenario
      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: JSON.stringify([mockSendGridEvent]),
        isValid: true,
      });

      const mockWebhookDelivery = {
        id: 'webhook-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'delivered',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockMessageEvent = {
        id: 'message-event-123',
        tenantId: 'tenant-123',
        messageId: 'outbound-message-123',
        type: 'delivered',
        eventAt: new Date(),
        sgEventId: 'sg-event-123',
        data: mockSendGridEvent,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockOutboundMessage = {
        id: 'outbound-message-123',
        tenantId: 'tenant-123',
        campaignId: 'campaign-123',
        contactId: 'contact-123',
        channel: 'email',
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockCampaign = {
        id: 'campaign-123',
        tenantId: 'tenant-123',
        leadId: 'lead-123',
        contactId: 'contact-123',
        channel: 'email',
        status: 'active',
        currentNodeId: 'node-123',
        planJson: { nodes: [], startNodeId: 'node-123' },
        planVersion: '1.0',
        planHash: 'hash-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue(mockWebhookDelivery);
      mockMessageEventRepo.createForTenant.mockResolvedValue(mockMessageEvent);
      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue(undefined);
      mockMessageEventRepo.findByIdsForTenant.mockResolvedValue([mockMessageEvent]);
      mockOutboundMessageRepo.findByIdsForTenant.mockResolvedValue([mockOutboundMessage]);
      mockContactCampaignRepo.findByIdsForTenant.mockResolvedValue([mockCampaign]);

      // Mock transition service to throw an error
      mockCampaignPlanExecutionService.processTransition.mockRejectedValue(
        new Error('Transition processing failed')
      );

      // Execute
      const result = await service.processWebhook(mockHeaders, JSON.stringify([mockSendGridEvent]));

      // Verify webhook processing still succeeded despite transition error
      expect(result.success).toBe(true);
      expect(result.successfulEvents).toBe(1);

      // Verify campaign transition was attempted
      expect(mockCampaignPlanExecutionService.processTransition).toHaveBeenCalled();
    });

    it('should efficiently batch process multiple events with campaign deduplication', async () => {
      // Setup mocks for multiple events scenario
      const mockEvents = [
        { ...mockSendGridEvent, sg_event_id: 'sg1', unique_args: { messageId: 'msg1' } },
        { ...mockSendGridEvent, sg_event_id: 'sg2', unique_args: { messageId: 'msg2' } },
        { ...mockSendGridEvent, sg_event_id: 'sg3', unique_args: { messageId: 'msg3' } },
      ];

      mockValidator.verifyWebhookRequest.mockReturnValue({
        signature: 'valid-signature',
        timestamp: '1234567890',
        payload: JSON.stringify(mockEvents),
        isValid: true,
      });

      const mockWebhookDelivery = {
        id: 'webhook-123',
        tenantId: 'tenant-123',
        provider: 'sendgrid',
        eventType: 'delivered',
        status: 'received',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockMessageEvents = [
        { id: 'msg-event-1', tenantId: 'tenant-123', messageId: 'outbound-1', type: 'delivered' },
        { id: 'msg-event-2', tenantId: 'tenant-123', messageId: 'outbound-2', type: 'delivered' },
        { id: 'msg-event-3', tenantId: 'tenant-123', messageId: 'outbound-3', type: 'delivered' },
      ] as any;

      const mockOutboundMessages = [
        { id: 'outbound-1', campaignId: 'campaign-123' },
        { id: 'outbound-2', campaignId: 'campaign-123' }, // Same campaign
        { id: 'outbound-3', campaignId: 'campaign-456' }, // Different campaign
      ] as any;

      const mockCampaigns = [
        { id: 'campaign-123', status: 'active', currentNodeId: 'node-1', planJson: {} },
        { id: 'campaign-456', status: 'active', currentNodeId: 'node-2', planJson: {} },
      ] as any;

      mockWebhookDeliveryRepo.createForTenant.mockResolvedValue(mockWebhookDelivery);
      mockMessageEventRepo.createForTenant
        .mockResolvedValueOnce(mockMessageEvents[0])
        .mockResolvedValueOnce(mockMessageEvents[1])
        .mockResolvedValueOnce(mockMessageEvents[2]);
      mockMessageEventRepo.findBySgEventIdForTenant.mockResolvedValue(undefined);
      mockMessageEventRepo.findByIdsForTenant.mockResolvedValue(mockMessageEvents);
      mockOutboundMessageRepo.findByIdsForTenant.mockResolvedValue(mockOutboundMessages);
      mockContactCampaignRepo.findByIdsForTenant.mockResolvedValue(mockCampaigns);
      mockCampaignPlanExecutionService.processTransition.mockResolvedValue({ success: true });

      // Execute
      const result = await service.processWebhook(mockHeaders, JSON.stringify(mockEvents));

      // Verify webhook processing succeeded
      expect(result.success).toBe(true);
      expect(result.successfulEvents).toBe(3);

      // Verify efficient batch queries (key performance optimization)
      expect(mockMessageEventRepo.findByIdsForTenant).toHaveBeenCalledTimes(1);
      expect(mockOutboundMessageRepo.findByIdsForTenant).toHaveBeenCalledTimes(1);
      expect(mockContactCampaignRepo.findByIdsForTenant).toHaveBeenCalledTimes(1);

      // Verify campaign deduplication - should fetch unique campaigns only
      expect(mockContactCampaignRepo.findByIdsForTenant).toHaveBeenCalledWith(
        ['campaign-123', 'campaign-456'], // Deduplicated campaign IDs
        'tenant-123'
      );

      // Verify all transitions were processed
      expect(mockCampaignPlanExecutionService.processTransition).toHaveBeenCalledTimes(3);
    });
  });
});
