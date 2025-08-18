import { SendGridWebhookValidator } from '@/libs/email/sendgrid.webhook.validator';
import { webhookDeliveryRepository, messageEventRepository } from '@/repositories';
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

describe('SendGridWebhookService', () => {
  let service: SendGridWebhookService;
  let mockValidator: jest.Mocked<SendGridWebhookValidator>;

  const mockWebhookDeliveryRepo = webhookDeliveryRepository as jest.Mocked<
    typeof webhookDeliveryRepository
  >;
  const mockMessageEventRepo = messageEventRepository as jest.Mocked<typeof messageEventRepository>;

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
        'No valid events found in payload'
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

      // Should throw because no valid events found
      expect(service.processWebhook({}, payload)).rejects.toThrow(
        'No valid events found in payload'
      );
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
});
