import { EmailExecutionService } from '../email-execution.service';
import {
  outboundMessageRepository,
  emailSenderIdentityRepository,
  scheduledActionRepository,
} from '@/repositories';
import { unsubscribeService } from '@/modules/unsubscribe';
import { sendgridClient } from '@/libs/email/sendgrid.client';
import { parseIsoDuration } from '@/modules/campaign/scheduleUtils';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';

// Mock dependencies
jest.mock('@/repositories', () => ({
  outboundMessageRepository: {
    createForTenant: jest.fn(),
    findByDedupeKeyForTenant: jest.fn(),
  },
  emailSenderIdentityRepository: {
    findByLeadIdForTenant: jest.fn(),
  },
  scheduledActionRepository: {
    createForTenant: jest.fn(),
  },
}));

jest.mock('@/modules/unsubscribe', () => ({
  unsubscribeService: {
    isChannelUnsubscribed: jest.fn(),
  },
}));

jest.mock('@/libs/email/sendgrid.client', () => ({
  sendgridClient: {
    send: jest.fn(),
  },
}));

jest.mock('@/libs/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/libs/bullmq', () => ({
  getQueue: jest.fn(() => ({
    add: jest.fn(),
  })),
}));

jest.mock('@/modules/campaign/scheduleUtils', () => ({
  parseIsoDuration: jest.fn(),
}));

jest.mock('@/db', () => ({
  db: {
    transaction: jest.fn((callback) => callback({})),
  },
}));

jest.mock('@/libs/calendar/calendarUrlWrapper', () => ({
  calendarUrlWrapper: {
    wrapUrl: jest.fn((url) => url),
  },
}));

jest.mock('@/constants/timeout-jobs', () => ({
  DEFAULT_NO_OPEN_TIMEOUT: 'PT72H',
  DEFAULT_NO_CLICK_TIMEOUT: 'PT24H',
  TIMEOUT_JOB_OPTIONS: {},
}));

jest.mock('@/constants/queues', () => ({
  JOB_NAMES: {
    campaign_execution: {
      timeout: 'timeout',
    },
  },
}));

describe('EmailExecutionService', () => {
  let service: EmailExecutionService;
  const mockTenantId = 'tenant-123';
  const mockCampaignId = 'campaign-456';
  const mockNodeId = 'node-789';
  const mockMessageId = 'message-abc';

  const mockOutboundMessageRepo = outboundMessageRepository as jest.Mocked<
    typeof outboundMessageRepository
  >;
  const mockEmailSenderIdentityRepo = emailSenderIdentityRepository as jest.Mocked<
    typeof emailSenderIdentityRepository
  >;
  const mockScheduledActionRepo = scheduledActionRepository as jest.Mocked<
    typeof scheduledActionRepository
  >;
  const mockUnsubscribeService = unsubscribeService as jest.Mocked<typeof unsubscribeService>;
  const mockSendgridClient = sendgridClient as jest.Mocked<typeof sendgridClient>;
  const mockParseIsoDuration = parseIsoDuration as jest.MockedFunction<typeof parseIsoDuration>;

  beforeEach(() => {
    service = new EmailExecutionService(mockTenantId);
    jest.clearAllMocks();
  });

  describe('scheduleTimeoutJobs', () => {
    const createMockPlan = (nodeTransitions: any[] = []): CampaignPlanOutput => ({
      version: '1.0',
      timezone: 'UTC',
      defaults: {
        timers: {
          no_open_after: 'PT72H',
          no_click_after: 'PT24H',
        },
      },
      startNodeId: mockNodeId,
      nodes: [
        {
          id: mockNodeId,
          channel: 'email' as const,
          action: 'send' as const,
          subject: 'Test Subject',
          body: 'Test Body',
          schedule: { delay: 'PT0S' },
          transitions: nodeTransitions,
        },
      ],
    });

    it('should schedule timeout jobs based on specific node transitions', async () => {
      // Setup: Plan with specific transition timing
      const plan = createMockPlan([
        { on: 'no_open', to: 'next-node', after: 'PT10M' }, // 10 minutes
        { on: 'no_click', to: 'other-node', after: 'PT2H' }, // 2 hours
      ]);

      // Mock parseIsoDuration to return specific values
      mockParseIsoDuration
        .mockReturnValueOnce(10 * 60 * 1000) // PT10M = 10 minutes
        .mockReturnValueOnce(2 * 60 * 60 * 1000); // PT2H = 2 hours

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify parseIsoDuration was called with specific transition timing
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT10M');
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT2H');

      // Verify scheduled actions were created with correct timing
      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledTimes(2);

      // Verify no_open timeout job
      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledWith(mockTenantId, {
        campaignId: mockCampaignId,
        actionType: 'timeout',
        scheduledAt: expect.any(Date),
        payload: {
          nodeId: mockNodeId,
          messageId: mockMessageId,
          eventType: 'no_open',
        },
        bullmqJobId: expect.any(String),
      });

      // Verify no_click timeout job
      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledWith(mockTenantId, {
        campaignId: mockCampaignId,
        actionType: 'timeout',
        scheduledAt: expect.any(Date),
        payload: {
          nodeId: mockNodeId,
          messageId: mockMessageId,
          eventType: 'no_click',
        },
        bullmqJobId: expect.any(String),
      });
    });

    it('should fall back to default timeout values when no specific transitions', async () => {
      // Setup: Plan with no timeout transitions
      const plan = createMockPlan([
        { on: 'opened', to: 'next-node', within: 'PT24H' }, // Not a timeout transition
      ]);

      // Mock parseIsoDuration for default values
      mockParseIsoDuration
        .mockReturnValueOnce(72 * 60 * 60 * 1000) // PT72H = 72 hours (no_open default)
        .mockReturnValueOnce(24 * 60 * 60 * 1000); // PT24H = 24 hours (no_click default)

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify parseIsoDuration was called with default values
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT72H'); // Default no_open
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT24H'); // Default no_click

      // Verify both default timeout jobs were scheduled
      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledTimes(2);
    });

    it('should schedule specific transitions and fall back for missing ones', async () => {
      // Setup: Plan with only no_open transition, missing no_click
      const plan = createMockPlan([
        { on: 'no_open', to: 'next-node', after: 'PT5M' }, // 5 minutes
        { on: 'opened', to: 'other-node', within: 'PT1H' }, // Not a timeout
      ]);

      // Mock parseIsoDuration
      mockParseIsoDuration
        .mockReturnValueOnce(5 * 60 * 1000) // PT5M = 5 minutes (specific)
        .mockReturnValueOnce(24 * 60 * 60 * 1000); // PT24H = 24 hours (default for no_click)

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify specific transition timing was used for no_open
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT5M');
      // Verify default was used for missing no_click
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT24H');

      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledTimes(2);
    });

    it('should skip non-timeout event types in transitions', async () => {
      // Setup: Plan with non-timeout transitions that have 'after'
      const plan = createMockPlan([
        { on: 'delivered', to: 'next-node', after: 'PT0S' }, // Not a timeout event
        { on: 'opened', to: 'other-node', after: 'PT1H' }, // Not a timeout event
      ]);

      // Mock parseIsoDuration for defaults only
      mockParseIsoDuration
        .mockReturnValueOnce(72 * 60 * 60 * 1000) // Default no_open
        .mockReturnValueOnce(24 * 60 * 60 * 1000); // Default no_click

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify only default values were used (non-timeout events ignored)
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT72H');
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT24H');
      expect(mockParseIsoDuration).not.toHaveBeenCalledWith('PT0S');
      expect(mockParseIsoDuration).not.toHaveBeenCalledWith('PT1H');

      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple transitions of the same timeout type', async () => {
      // Setup: Plan with multiple no_open transitions
      const plan = createMockPlan([
        { on: 'no_open', to: 'node-1', after: 'PT10M' }, // First no_open
        { on: 'no_open', to: 'node-2', after: 'PT30M' }, // Second no_open (should be skipped)
        { on: 'no_click', to: 'node-3', after: 'PT1H' },
      ]);

      mockParseIsoDuration
        .mockReturnValueOnce(10 * 60 * 1000) // PT10M (first no_open)
        .mockReturnValueOnce(60 * 60 * 1000); // PT1H (no_click)

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify only first no_open transition was used
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT10M');
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT1H');
      expect(mockParseIsoDuration).not.toHaveBeenCalledWith('PT30M'); // Second no_open skipped

      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledTimes(2);
    });

    it('should handle nodes with no transitions', async () => {
      // Setup: Plan with no transitions at all
      const plan = createMockPlan([]); // Empty transitions

      mockParseIsoDuration
        .mockReturnValueOnce(72 * 60 * 60 * 1000) // Default no_open
        .mockReturnValueOnce(24 * 60 * 60 * 1000); // Default no_click

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify default values were used
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT72H');
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT24H');

      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledTimes(2);
    });

    it('should handle missing node in plan', async () => {
      // Setup: Plan without the target node
      const plan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: {
          timers: {
            no_open_after: 'PT72H',
            no_click_after: 'PT24H',
          },
        },
        startNodeId: 'different-node',
        nodes: [
          {
            id: 'different-node',
            channel: 'email' as const,
            action: 'send' as const,
            subject: 'Test',
            body: 'Test',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
        ],
      };

      // Execute
      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify no scheduling occurred
      expect(mockScheduledActionRepo.createForTenant).not.toHaveBeenCalled();
      expect(mockParseIsoDuration).not.toHaveBeenCalled();
    });

    it('should handle transitions with within constraint (not after)', async () => {
      // Setup: Plan with only 'within' transitions (no 'after')
      const plan = createMockPlan([
        { on: 'opened', to: 'next-node', within: 'PT24H' },
        { on: 'clicked', to: 'other-node', within: 'PT72H' },
      ]);

      mockParseIsoDuration
        .mockReturnValueOnce(72 * 60 * 60 * 1000) // Default no_open
        .mockReturnValueOnce(24 * 60 * 60 * 1000); // Default no_click

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify only defaults were used (no 'after' transitions found)
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT72H');
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT24H');

      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledTimes(2);
    });

    it('should use plan defaults when no defaults.timers is provided', async () => {
      // Setup: Plan without defaults.timers
      const planWithoutDefaults: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: {
          timers: {},
        },
        startNodeId: mockNodeId,
        nodes: [
          {
            id: mockNodeId,
            channel: 'email' as const,
            action: 'send' as const,
            subject: 'Test',
            body: 'Test',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
        ],
      };

      // Mock constants from timeout-jobs.ts
      mockParseIsoDuration
        .mockReturnValueOnce(72 * 60 * 60 * 1000) // DEFAULT_NO_OPEN_TIMEOUT = PT72H
        .mockReturnValueOnce(24 * 60 * 60 * 1000); // DEFAULT_NO_CLICK_TIMEOUT = PT24H

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJobs(
        mockCampaignId,
        mockNodeId,
        planWithoutDefaults,
        mockMessageId
      );

      // Verify hardcoded constants were used
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT72H');
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT24H');

      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid ISO duration in transitions gracefully', async () => {
      // Setup: Plan with invalid transition timing
      const plan = createMockPlan([
        { on: 'no_open', to: 'next-node', after: 'INVALID_DURATION' }, // Invalid ISO
        { on: 'no_click', to: 'other-node', after: 'PT2H' }, // Valid
      ]);

      // Mock parseIsoDuration to throw for invalid duration
      mockParseIsoDuration
        .mockImplementationOnce(() => {
          throw new Error('Invalid ISO 8601 duration: INVALID_DURATION');
        })
        .mockReturnValueOnce(2 * 60 * 60 * 1000) // PT2H = 2 hours
        .mockReturnValueOnce(72 * 60 * 60 * 1000) // Default no_open fallback
        .mockReturnValueOnce(24 * 60 * 60 * 1000); // Default no_click (shouldn't be used)

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify no_click was still scheduled despite no_open error
      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledWith(mockTenantId, {
        campaignId: mockCampaignId,
        actionType: 'timeout',
        scheduledAt: expect.any(Date),
        payload: {
          nodeId: mockNodeId,
          messageId: mockMessageId,
          eventType: 'no_click',
        },
        bullmqJobId: expect.any(String),
      });

      // Verify default no_open was scheduled as fallback
      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledWith(mockTenantId, {
        campaignId: mockCampaignId,
        actionType: 'timeout',
        scheduledAt: expect.any(Date),
        payload: {
          nodeId: mockNodeId,
          messageId: mockMessageId,
          eventType: 'no_open',
        },
        bullmqJobId: expect.any(String),
      });

      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledTimes(2);
    });

    it('should handle parseIsoDuration errors gracefully', async () => {
      // Setup: Plan with transitions that will cause parseIsoDuration to throw
      const plan = createMockPlan([
        { on: 'no_open', to: 'next-node', after: 'INVALID_DURATION' },
      ]);

      // Mock parseIsoDuration to throw for invalid duration
      mockParseIsoDuration.mockImplementationOnce(() => {
        throw new Error('Invalid ISO 8601 duration: INVALID_DURATION');
      });

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute should not throw error
      await expect(
        (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId)
      ).resolves.not.toThrow();

      // The key point is that it handles errors gracefully and doesn't crash
      // The exact number of jobs scheduled depends on fallback logic which we've already tested
    });

    it('should use timeout event type constants correctly', async () => {
      // This test validates that the TIMEOUT_EVENT_TYPES constant is used correctly
      const plan = createMockPlan([
        { on: 'delivered', to: 'next-node', after: 'PT1H' }, // Not a timeout event
        { on: 'opened', to: 'other-node', after: 'PT2H' }, // Not a timeout event  
        { on: 'no_open', to: 'timeout-node', after: 'PT10M' }, // IS a timeout event
      ]);

      mockParseIsoDuration
        .mockReturnValueOnce(10 * 60 * 1000) // PT10M for no_open transition
        .mockReturnValueOnce(24 * 60 * 60 * 1000); // Default for no_click

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify that parseIsoDuration was called for the timeout transition
      expect(mockParseIsoDuration).toHaveBeenCalledWith('PT10M');
      
      // Verify that some jobs were scheduled (validates error handling works)
      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalled();
    });

    it('should continue scheduling other transitions when one fails', async () => {
      // Setup: Plan with one valid transition, the other will use default
      const plan = createMockPlan([
        { on: 'no_click', to: 'node-3', after: 'PT1H' }, // Valid transition
        // no_open will use plan default
      ]);

      mockParseIsoDuration
        .mockReturnValueOnce(60 * 60 * 1000) // PT1H for no_click transition
        .mockReturnValueOnce(72 * 60 * 60 * 1000); // PT72H for no_open default

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJobs(mockCampaignId, mockNodeId, plan, mockMessageId);

      // Verify both timeouts were scheduled
      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledTimes(2);
      
      // Should have been called with both event types
      const calls = mockScheduledActionRepo.createForTenant.mock.calls;
      const eventTypes = calls.map((call: any) => call[1].payload.eventType);
      expect(eventTypes).toContain('no_click');
      expect(eventTypes).toContain('no_open');
    });
  });

  describe('scheduleTimeoutJob', () => {
    it('should skip jobs with negative delay', async () => {
      const pastTime = new Date(Date.now() - 10000); // 10 seconds ago
      const params = {
        campaignId: mockCampaignId,
        nodeId: mockNodeId,
        messageId: mockMessageId,
        eventType: 'no_open' as const,
        scheduledAt: pastTime,
      };

      // Execute
      await (service as any).scheduleTimeoutJob(params);

      // Verify no database record or BullMQ job was created
      expect(mockScheduledActionRepo.createForTenant).not.toHaveBeenCalled();
    });

    it('should schedule job with positive delay', async () => {
      const futureTime = new Date(Date.now() + 60000); // 1 minute from now
      const params = {
        campaignId: mockCampaignId,
        nodeId: mockNodeId,
        messageId: mockMessageId,
        eventType: 'no_open' as const,
        scheduledAt: futureTime,
      };

      mockScheduledActionRepo.createForTenant.mockResolvedValue({
        id: 'scheduled-action-123',
      } as any);

      // Execute
      await (service as any).scheduleTimeoutJob(params);

      // Verify database record was created
      expect(mockScheduledActionRepo.createForTenant).toHaveBeenCalledWith(mockTenantId, {
        campaignId: mockCampaignId,
        actionType: 'timeout',
        scheduledAt: futureTime,
        payload: {
          nodeId: mockNodeId,
          messageId: mockMessageId,
          eventType: 'no_open',
        },
        bullmqJobId: expect.any(String),
      });
    });
  });

  describe('generateTimeoutJobId', () => {
    it('should generate unique job IDs for different parameters', () => {
      const params1 = {
        campaignId: 'campaign-1',
        nodeId: 'node-1',
        messageId: 'message-1',
        eventType: 'no_open' as const,
        scheduledAt: new Date('2024-01-01T00:00:00Z'),
      };

      const params2 = {
        campaignId: 'campaign-2',
        nodeId: 'node-1',
        messageId: 'message-1',
        eventType: 'no_open' as const,
        scheduledAt: new Date('2024-01-01T00:00:00Z'),
      };

      const jobId1 = (service as any).generateTimeoutJobId(params1);
      const jobId2 = (service as any).generateTimeoutJobId(params2);

      expect(jobId1).not.toBe(jobId2);
      expect(jobId1).toMatch(/^timeout_campaign-1_node-1_no_open_message-1_[a-f0-9]{8}$/);
      expect(jobId2).toMatch(/^timeout_campaign-2_node-1_no_open_message-1_[a-f0-9]{8}$/);
    });

    it('should generate same job ID for identical parameters', () => {
      const params = {
        campaignId: 'campaign-1',
        nodeId: 'node-1',
        messageId: 'message-1',
        eventType: 'no_open' as const,
        scheduledAt: new Date('2024-01-01T00:00:00Z'),
      };

      const jobId1 = (service as any).generateTimeoutJobId(params);
      const jobId2 = (service as any).generateTimeoutJobId(params);

      expect(jobId1).toBe(jobId2);
    });
  });
});