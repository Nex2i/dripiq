import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TimeoutExecutionService } from '../timeout-execution.service';
import { campaignPlanExecutionService } from '@/modules/campaign/campaignPlanExecution.service';
import {
  campaignTransitionRepository,
  contactCampaignRepository,
  messageEventRepository,
} from '@/repositories';

import type { Job } from 'bullmq';
import type { TimeoutJobPayload } from '@/types/timeout.types';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';
import { calendarClickValidationService } from '@/modules/calendarClickValidation.service';

// Mock dependencies
jest.mock('@/repositories');
jest.mock('@/modules/campaign/campaignPlanExecution.service');
jest.mock('@/services/calendarClickValidation.service');

// Mock BullMQ to prevent Redis connection issues
jest.mock('@/libs/bullmq', () => ({
  createRedisConnection: jest.fn(() => ({})),
  getQueue: jest.fn(() => ({})),
  getQueueEvents: jest.fn(() => ({})),
  getWorker: jest.fn(() => ({})),
  shutdownQueues: jest.fn(),
}));

const mockCampaignTransitionRepository = jest.mocked(campaignTransitionRepository);

const mockContactCampaignRepository = jest.mocked(contactCampaignRepository);
const mockMessageEventRepository = jest.mocked(messageEventRepository);
const mockCampaignPlanExecutionService = jest.mocked(campaignPlanExecutionService);
const mockCalendarClickValidationService = jest.mocked(calendarClickValidationService);

describe('TimeoutExecutionService - Direct Transitions', () => {
  let timeoutExecutionService: TimeoutExecutionService;
  let mockJob: Job<TimeoutJobPayload>;

  const mockCampaignPlan: CampaignPlanOutput = {
    version: '1.0',
    timezone: 'America/Los_Angeles',
    startNodeId: 'node1',
    nodes: [
      {
        id: 'node1',
        action: 'send',
        channel: 'email',
        subject: 'Test Email',
        body: 'Test Body',
        schedule: { delay: 'PT10S' },
        transitions: [
          {
            on: 'no_click',
            to: 'node2',
            after: 'PT24H',
          },
        ],
      },
      {
        id: 'node2',
        action: 'send',
        channel: 'email',
        subject: 'Follow-up Email',
        body: 'Follow-up Body',
        schedule: { delay: 'PT0S' },
        transitions: [],
      },
    ],
    defaults: {
      timers: {
        no_click_after: 'PT24H',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    timeoutExecutionService = new TimeoutExecutionService();

    // Mock transition repository to return empty array by default
    mockCampaignTransitionRepository.listByCampaignForTenant.mockResolvedValue([]);

    // Mock calendar click validation to return no clicks by default
    mockCalendarClickValidationService.hasCalendarClicksInWindow.mockResolvedValue({
      hasClicks: false,
      clickCount: 0,
      latestClick: undefined,
      timeWindow: {
        start: new Date(Date.now() - 3600000), // 1 hour ago
        end: new Date(),
      },
    });

    mockJob = {
      id: 'test-job-id',
      data: {
        tenantId: 'test-tenant',
        campaignId: 'test-campaign',
        nodeId: 'node1',
        messageId: 'test-message',
        eventType: 'no_click',
      },
      opts: {
        delay: 86400000, // 24 hours
      },
    } as Job<TimeoutJobPayload>;
  });

  it('should process timeout transition directly without creating synthetic events', async () => {
    // Mock campaign data
    const mockCampaign = {
      id: 'test-campaign',
      contactId: 'test-contact',
      leadId: 'test-lead',
      planJson: mockCampaignPlan,
      startedAt: new Date(Date.now() - 3600000), // 1 hour ago
    };

    mockContactCampaignRepository.findByIdForTenant.mockResolvedValue(mockCampaign as any);
    mockMessageEventRepository.findByMessageAndType.mockResolvedValue(null);

    // Mock successful timeout transition
    mockCampaignPlanExecutionService.processTimeoutTransition.mockResolvedValue({
      success: true,
      fromNodeId: 'node1',
      toNodeId: 'node2',
      timeoutEventType: 'no_click',
      transitionId: 'transition-id',
      nextAction: {
        scheduled: true,
        actionType: 'send',
        scheduledAt: new Date(),
        scheduledActionId: 'action-id',
      },
    });

    // Mock getCurrentNodeStartTime to return a valid start time
    mockCampaignPlanExecutionService.getCurrentNodeStartTime.mockResolvedValue(
      new Date(Date.now() - 3600000)
    );

    // Execute
    const result = await timeoutExecutionService.processTimeout(mockJob);

    // Verify synthetic event was NOT created
    expect(mockMessageEventRepository.createForTenant).not.toHaveBeenCalled();

    // Verify direct timeout transition was called
    expect(mockCampaignPlanExecutionService.processTimeoutTransition).toHaveBeenCalledWith({
      tenantId: 'test-tenant',
      campaignId: 'test-campaign',
      contactId: 'test-contact',
      leadId: 'test-lead',
      timeoutEventType: 'no_click',
      currentNodeId: 'node1',
      plan: mockCampaignPlan,
      originalJobId: 'test-job-id',
      scheduledAt: expect.any(Date),
    });

    // Verify result
    expect(result).toEqual({
      success: true,
      reason: undefined,
    });

    // Verify old processTransition method was NOT called
    expect(mockCampaignPlanExecutionService.processTransition).not.toHaveBeenCalled();
  });

  it('should handle timeout transition failures gracefully', async () => {
    const mockCampaign = {
      id: 'test-campaign',
      contactId: 'test-contact',
      leadId: 'test-lead',
      planJson: mockCampaignPlan,
      startedAt: new Date(Date.now() - 3600000), // 1 hour ago
    };

    mockContactCampaignRepository.findByIdForTenant.mockResolvedValue(mockCampaign as any);
    mockMessageEventRepository.findByMessageAndType.mockResolvedValue(null);

    // Mock failed timeout transition
    mockCampaignPlanExecutionService.processTimeoutTransition.mockResolvedValue({
      success: false,
      reason: 'no_matching_timeout_transition',
      availableTransitions: 0,
    });

    // Mock getCurrentNodeStartTime to return a valid start time
    mockCampaignPlanExecutionService.getCurrentNodeStartTime.mockResolvedValue(
      new Date(Date.now() - 3600000)
    );

    // Execute
    const result = await timeoutExecutionService.processTimeout(mockJob);

    // Verify synthetic event was NOT created
    expect(mockMessageEventRepository.createForTenant).not.toHaveBeenCalled();

    // Verify result reflects the failure
    expect(result).toEqual({
      success: false,
      reason: 'no_matching_timeout_transition',
    });
  });

  it('should skip timeout if real event already exists', async () => {
    // Mock existing real event
    mockMessageEventRepository.findByMessageAndType.mockResolvedValue({
      id: 'real-event-id',
      type: 'click',
    } as any);

    // Execute
    const result = await timeoutExecutionService.processTimeout(mockJob);

    // Verify synthetic event was NOT created
    expect(mockMessageEventRepository.createForTenant).not.toHaveBeenCalled();

    // Verify timeout transition was NOT called
    expect(mockCampaignPlanExecutionService.processTimeoutTransition).not.toHaveBeenCalled();

    // Verify result shows skip
    expect(result).toEqual({
      success: true,
      skipped: true,
      reason: 'real_event_exists',
    });
  });
});
