import { campaignTransitionRepository, contactCampaignRepository } from '@/repositories';
import { CampaignPlanExecutionService } from '../campaignPlanExecution.service';
import type { CampaignPlanOutput } from '../../ai/schemas/contactStrategy/contactCampaignStrategySchema';

// Mock the repositories
jest.mock('@/repositories', () => ({
  campaignTransitionRepository: {
    listByCampaignForTenant: jest.fn(),
    createForTenant: jest.fn(),
  },
  contactCampaignRepository: {
    findByIdForTenant: jest.fn(),
    updateByIdForTenant: jest.fn(),
  },
  scheduledActionRepository: {
    createForTenant: jest.fn(),
  },
}));

// Mock the logger
jest.mock('@/libs/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock BullMQ
jest.mock('@/libs/bullmq', () => ({
  getQueue: jest.fn(() => ({
    add: jest.fn(),
  })),
}));

describe('CampaignPlanExecutionService - Timing Validation', () => {
  let service: CampaignPlanExecutionService;
  const mockTenantId = 'tenant-123';
  const mockCampaignId = 'campaign-123';
  const _mockContactId = 'contact-123';

  beforeEach(() => {
    service = new CampaignPlanExecutionService();
    jest.clearAllMocks();
  });

  const createMockPlan = (): CampaignPlanOutput => ({
    version: '1.0',
    timezone: 'UTC',
    quietHours: { start: '22:00', end: '08:00' },
    defaults: {
      timers: {
        no_open_after: 'PT72H',
        no_click_after: 'PT24H',
      },
    },
    startNodeId: 'node-1',
    nodes: [
      {
        id: 'node-1',
        channel: 'email' as const,
        action: 'send' as const,
        subject: 'Welcome',
        body: 'Welcome to our service',
        schedule: { delay: 'PT0S' },
        transitions: [
          {
            on: 'opened' as const,
            to: 'node-2',
            within: 'PT24H', // Must open within 24 hours
          },
          {
            on: 'no_open' as const,
            to: 'node-3',
            after: 'PT24H', // Only after 24 hours of no opening
          },
        ],
      },
      {
        id: 'node-2',
        channel: 'email' as const,
        action: 'send' as const,
        subject: 'Thanks for opening',
        body: 'Thanks for your interest',
        schedule: { delay: 'PT0S' },
        transitions: [
          {
            on: 'clicked' as const,
            to: 'node-4',
            within: 'PT72H', // Must click within 72 hours
          },
        ],
      },
      {
        id: 'node-3',
        channel: 'email' as const,
        action: 'send' as const,
        subject: 'Did you miss our email?',
        body: 'Follow up message',
        schedule: { delay: 'PT0S' },
        transitions: [],
      },
      {
        id: 'node-4',
        channel: 'email' as const,
        action: 'stop' as const,
        transitions: [],
      },
    ],
  });

  describe('getCurrentNodeStartTime', () => {
    it('should return transition occurred time for non-start nodes', async () => {
      const mockTransitions = [
        {
          id: 'trans-1',
          tenantId: mockTenantId,
          campaignId: mockCampaignId,
          fromStatus: null,
          toStatus: 'active' as const,
          reason: 'Event: opened - transition from node-1 to node-2',
          occurredAt: new Date('2024-01-01T10:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (campaignTransitionRepository.listByCampaignForTenant as jest.Mock).mockResolvedValue(
        mockTransitions
      );

      // Use reflection to test private method
      const nodeStartTime = await (service as any).getCurrentNodeStartTime(
        mockTenantId,
        mockCampaignId,
        'node-2'
      );

      expect(nodeStartTime).toEqual(new Date('2024-01-01T10:00:00Z'));
    });

    it('should return campaign start time for start nodes', async () => {
      const mockCampaign = {
        id: mockCampaignId,
        tenantId: mockTenantId,
        startedAt: new Date('2024-01-01T09:00:00Z'),
      };

      (campaignTransitionRepository.listByCampaignForTenant as jest.Mock).mockResolvedValue([]);
      (contactCampaignRepository.findByIdForTenant as jest.Mock).mockResolvedValue(mockCampaign);

      const nodeStartTime = await (service as any).getCurrentNodeStartTime(
        mockTenantId,
        mockCampaignId,
        'node-1'
      );

      expect(nodeStartTime).toEqual(new Date('2024-01-01T09:00:00Z'));
    });

    it('should return null if no timing information available', async () => {
      (campaignTransitionRepository.listByCampaignForTenant as jest.Mock).mockResolvedValue([]);
      (contactCampaignRepository.findByIdForTenant as jest.Mock).mockResolvedValue(null);

      const nodeStartTime = await (service as any).getCurrentNodeStartTime(
        mockTenantId,
        mockCampaignId,
        'node-unknown'
      );

      expect(nodeStartTime).toBeNull();
    });
  });

  describe('isTransitionValid - Within Constraints', () => {
    beforeEach(() => {
      // Mock node start time to 1 hour ago
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      jest.spyOn(service as any, 'getCurrentNodeStartTime').mockResolvedValue(oneHourAgo);
    });

    it('should allow transition within the time window', async () => {
      const transition = {
        on: 'opened',
        to: 'node-2',
        within: 'PT24H', // 24 hours allowed
      };

      const isValid = await (service as any).isTransitionValid(
        transition,
        mockTenantId,
        mockCampaignId,
        'node-1',
        new Date() // Current time (1 hour after node start)
      );

      expect(isValid).toBe(true);
    });

    it('should reject transition outside the time window', async () => {
      const transition = {
        on: 'opened',
        to: 'node-2',
        within: 'PT30M', // Only 30 minutes allowed
      };

      const isValid = await (service as any).isTransitionValid(
        transition,
        mockTenantId,
        mockCampaignId,
        'node-1',
        new Date() // Current time (1 hour after node start - outside 30min window)
      );

      expect(isValid).toBe(false);
    });

    it('should handle edge case at exact time boundary', async () => {
      const nodeStartTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago exactly
      jest.spyOn(service as any, 'getCurrentNodeStartTime').mockResolvedValue(nodeStartTime);

      const transition = {
        on: 'opened',
        to: 'node-2',
        within: 'PT1H', // Exactly 1 hour allowed
      };

      const isValid = await (service as any).isTransitionValid(
        transition,
        mockTenantId,
        mockCampaignId,
        'node-1',
        new Date() // Current time (exactly 1 hour after node start)
      );

      expect(isValid).toBe(true);
    });
  });

  describe('isTransitionValid - After Constraints', () => {
    it('should reject transition before the required delay', async () => {
      // Mock node start time to 30 minutes ago
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      jest.spyOn(service as any, 'getCurrentNodeStartTime').mockResolvedValue(thirtyMinutesAgo);

      const transition = {
        on: 'no_open',
        to: 'node-3',
        after: 'PT1H', // Must wait 1 hour
      };

      const isValid = await (service as any).isTransitionValid(
        transition,
        mockTenantId,
        mockCampaignId,
        'node-1',
        new Date() // Current time (only 30 minutes after node start)
      );

      expect(isValid).toBe(false);
    });

    it('should allow transition after the required delay', async () => {
      // Mock node start time to 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      jest.spyOn(service as any, 'getCurrentNodeStartTime').mockResolvedValue(twoHoursAgo);

      const transition = {
        on: 'no_open',
        to: 'node-3',
        after: 'PT1H', // Must wait 1 hour
      };

      const isValid = await (service as any).isTransitionValid(
        transition,
        mockTenantId,
        mockCampaignId,
        'node-1',
        new Date() // Current time (2 hours after node start - after 1 hour requirement)
      );

      expect(isValid).toBe(true);
    });

    it('should handle edge case at exact time boundary', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      jest.spyOn(service as any, 'getCurrentNodeStartTime').mockResolvedValue(oneHourAgo);

      const transition = {
        on: 'no_open',
        to: 'node-3',
        after: 'PT1H', // Exactly 1 hour required
      };

      const isValid = await (service as any).isTransitionValid(
        transition,
        mockTenantId,
        mockCampaignId,
        'node-1',
        new Date() // Current time (exactly 1 hour after node start)
      );

      expect(isValid).toBe(true);
    });
  });

  describe('processTransition - Integration Tests', () => {
    beforeEach(() => {
      (contactCampaignRepository.updateByIdForTenant as jest.Mock).mockResolvedValue({});
      (campaignTransitionRepository.createForTenant as jest.Mock).mockResolvedValue({
        id: 'transition-123',
      });
    });

    it('should reject transition when timing constraints are not met', async () => {
      const plan = createMockPlan();

      // Mock that node started 30 minutes ago
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      jest.spyOn(service as any, 'getCurrentNodeStartTime').mockResolvedValue(thirtyMinutesAgo);
      jest.spyOn(service as any, 'scheduleNextAction').mockResolvedValue({ scheduled: false });

      const result = await service.processTransition({
        tenantId: mockTenantId,
        campaignId: mockCampaignId,
        contactId: 'mock-contact-id',
        leadId: 'mock-lead-id',
        eventType: 'no_open', // This requires 'after: PT24H'
        currentNodeId: 'node-1',
        plan,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('timing_constraints_not_met');
      expect(contactCampaignRepository.updateByIdForTenant).not.toHaveBeenCalled();
    });

    it('should allow transition when timing constraints are met', async () => {
      const plan = createMockPlan();

      // Mock that node started 25 hours ago (past the 24h requirement)
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      jest.spyOn(service as any, 'getCurrentNodeStartTime').mockResolvedValue(twentyFiveHoursAgo);
      jest.spyOn(service as any, 'scheduleNextAction').mockResolvedValue({
        scheduled: true,
        actionType: 'send' as const,
      });

      const result = await service.processTransition({
        tenantId: mockTenantId,
        campaignId: mockCampaignId,
        contactId: 'mock-contact-id',
        leadId: 'mock-lead-id',
        eventType: 'no_open', // This requires 'after: PT24H'
        currentNodeId: 'node-1',
        plan,
      });

      expect(result.success).toBe(true);
      expect(result.fromNodeId).toBe('node-1');
      expect(result.toNodeId).toBe('node-3');
      expect(contactCampaignRepository.updateByIdForTenant).toHaveBeenCalledWith(
        mockCampaignId,
        mockTenantId,
        {
          currentNodeId: 'node-3',
          updatedAt: expect.any(Date),
        }
      );
    });

    it('should handle multiple transitions with different timing constraints', async () => {
      const plan = createMockPlan();

      // Add multiple transitions to test priority
      plan.nodes[0]!.transitions = [
        {
          on: 'opened' as const,
          to: 'node-2',
          within: 'PT30M', // Very restrictive - should fail
        },
        {
          on: 'opened' as const,
          to: 'node-5',
          within: 'PT48H', // More lenient - should succeed
        },
      ];

      // Mock that node started 1 hour ago
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      jest.spyOn(service as any, 'getCurrentNodeStartTime').mockResolvedValue(oneHourAgo);
      jest.spyOn(service as any, 'scheduleNextAction').mockResolvedValue({ scheduled: false });

      const result = await service.processTransition({
        tenantId: mockTenantId,
        campaignId: mockCampaignId,
        contactId: 'mock-contact-id',
        leadId: 'mock-lead-id',
        eventType: 'opened',
        currentNodeId: 'node-1',
        plan,
      });

      // Should find the second transition that meets timing constraints
      expect(result.success).toBe(true);
      expect(result.toNodeId).toBe('node-5'); // Second transition target
    });

    it('should gracefully handle missing node start time', async () => {
      const plan = createMockPlan();

      // Mock that we cannot determine node start time
      jest.spyOn(service as any, 'getCurrentNodeStartTime').mockResolvedValue(null);
      jest.spyOn(service as any, 'scheduleNextAction').mockResolvedValue({ scheduled: false });

      const result = await service.processTransition({
        tenantId: mockTenantId,
        campaignId: mockCampaignId,
        contactId: 'mock-contact-id',
        leadId: 'mock-lead-id',
        eventType: 'opened',
        currentNodeId: 'node-1',
        plan,
      });

      // Should allow transition when we can't determine timing
      expect(result.success).toBe(true);
      expect(result.fromNodeId).toBe('node-1');
      expect(result.toNodeId).toBe('node-2');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully in timing validation', async () => {
      const transition = {
        on: 'opened',
        to: 'node-2',
        within: 'PT24H',
      };

      // Mock database error
      jest
        .spyOn(service as any, 'getCurrentNodeStartTime')
        .mockRejectedValue(new Error('Database connection failed'));

      const isValid = await (service as any).isTransitionValid(
        transition,
        mockTenantId,
        mockCampaignId,
        'node-1',
        new Date()
      );

      // Should allow transition on error to prevent system lockup
      expect(isValid).toBe(true);
    });
  });
});
