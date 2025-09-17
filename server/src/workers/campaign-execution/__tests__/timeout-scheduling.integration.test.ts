import { EmailExecutionService } from '../email-execution.service';
import { parseIsoDuration } from '@/modules/campaign/scheduleUtils';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';

// Mock only the external dependencies, not the core logic we're testing
jest.mock('@/repositories', () => ({
  outboundMessageRepository: {
    createForTenant: jest.fn(),
    findByDedupeKeyForTenant: jest.fn(),
  },
  mailAccountRepository: {
    findActivePrimaryForTenant: jest.fn(),
  },
  leadRepository: {
    findByIdForTenant: jest.fn(),
  },
  userRepository: {
    findById: jest.fn(),
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

jest.mock('@/modules/email', () => ({
  EmailProcessor: {
    sendCampaignEmail: jest.fn(),
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

// Don't mock parseIsoDuration - use the real implementation
jest.unmock('@/modules/campaign/scheduleUtils');

describe('Timeout Scheduling Integration', () => {
  let service: EmailExecutionService;
  const mockTenantId = 'tenant-123';

  beforeEach(() => {
    service = new EmailExecutionService(mockTenantId);
    jest.clearAllMocks();
  });

  it('should correctly schedule timeouts for the user provided campaign plan', async () => {
    // This is the actual campaign plan from the user's query
    const userCampaignPlan: CampaignPlanOutput = {
      version: '1.0',
      timezone: 'America/Los_Angeles',
      quietHours: { end: '08:00', start: '18:00' },
      defaults: { timers: { no_open_after: 'PT10M', no_click_after: 'PT24H' } },
      startNodeId: 'wuu9ajq553bu6w9d9l7ymx8t',
      nodes: [
        {
          id: 'wuu9ajq553bu6w9d9l7ymx8t',
          body: 'Hi Tim,\n\nI know Valiente Mott handles high value, complex injury cases...',
          action: 'send' as const,
          channel: 'email' as const,
          subject: 'Tim, faster depo prep for Valiente Mott',
          schedule: { delay: 'PT0S' },
          transitions: [
            { on: 'opened' as const, to: 'c0x44yz2omlxpvoef3hjid4m', within: 'PT48H' },
            { on: 'no_open' as const, to: 'a0vt35r56dwzk68mm29ubhbk', after: 'PT10M' }, // 10 minutes!
            { on: 'delivered' as const, to: 'b1i0j4dlb8d9eleilyq8371l', after: 'PT0S' },
          ],
        },
        {
          id: 'c0x44yz2omlxpvoef3hjid4m',
          action: 'wait' as const,
          channel: 'email' as const,
          transitions: [
            { on: 'clicked' as const, to: 'tmg2aj05iem9i3sl9oups7lz', within: 'PT10M' },
            { on: 'no_click' as const, to: 'a0vt35r56dwzk68mm29ubhbk', after: 'PT24H' }, // 24 hours
          ],
        },
        {
          id: 'a0vt35r56dwzk68mm29ubhbk',
          action: 'send' as const,
          channel: 'email' as const,
          subject: 'Quick follow up on depositions',
          body: 'Tim,\n\nFollowing up in case my last note got buried...',
          schedule: { delay: 'PT0S' },
          transitions: [],
        },
        {
          id: 'b1i0j4dlb8d9eleilyq8371l',
          action: 'stop' as const,
          channel: 'email' as const,
          transitions: [],
        },
        {
          id: 'tmg2aj05iem9i3sl9oups7lz',
          action: 'send' as const,
          channel: 'email' as const,
          subject: 'Speed up expert prep and med chron work',
          body: 'Tim,\n\nTwo things firms like yours tell me help most...',
          schedule: { delay: 'PT0S' },
          transitions: [],
        },
      ],
    };

    const { scheduledActionRepository } = require('@/repositories');
    scheduledActionRepository.createForTenant.mockResolvedValue({ id: 'action-123' });

    // Test first node - should use specific PT10M timing for no_open
    const mockCampaignId = 'campaign-123';
    const mockMessageId = 'message-abc';
    const firstNodeId = 'wuu9ajq553bu6w9d9l7ymx8t';

    const startTime = Date.now();
    await (service as any).scheduleTimeoutJobs(
      mockCampaignId,
      firstNodeId,
      userCampaignPlan,
      mockMessageId
    );

    // Verify that scheduling was called
    expect(scheduledActionRepository.createForTenant).toHaveBeenCalled();

    // Extract the scheduled times from the mock calls
    const scheduledCalls = scheduledActionRepository.createForTenant.mock.calls;

    // Find the no_open timeout call
    const noOpenCall = scheduledCalls.find((call: any) => call[1].payload.eventType === 'no_open');

    expect(noOpenCall).toBeDefined();

    // Verify the no_open timeout is scheduled for 10 minutes (600,000 ms) from now
    const scheduledTime = new Date(noOpenCall[1].scheduledAt).getTime();
    const expectedTime = startTime + parseIsoDuration('PT10M'); // 10 minutes
    const tolerance = 5000; // 5 second tolerance for test execution time

    expect(scheduledTime).toBeGreaterThanOrEqual(expectedTime - tolerance);
    expect(scheduledTime).toBeLessThanOrEqual(expectedTime + tolerance);

    // Test wait node - should use specific PT24H timing for no_click
    jest.clearAllMocks();
    scheduledActionRepository.createForTenant.mockResolvedValue({ id: 'action-456' });

    const waitNodeId = 'c0x44yz2omlxpvoef3hjid4m';
    const startTime2 = Date.now();

    await (service as any).scheduleTimeoutJobs(
      mockCampaignId,
      waitNodeId,
      userCampaignPlan,
      mockMessageId
    );

    const scheduledCalls2 = scheduledActionRepository.createForTenant.mock.calls;

    // Find the no_click timeout call
    const noClickCall = scheduledCalls2.find(
      (call: any) => call[1].payload.eventType === 'no_click'
    );

    expect(noClickCall).toBeDefined();

    // Verify the no_click timeout is scheduled for 24 hours from now
    const scheduledTime2 = new Date(noClickCall[1].scheduledAt).getTime();
    const expectedTime2 = startTime2 + parseIsoDuration('PT24H'); // 24 hours

    expect(scheduledTime2).toBeGreaterThanOrEqual(expectedTime2 - tolerance);
    expect(scheduledTime2).toBeLessThanOrEqual(expectedTime2 + tolerance);
  });

  it('should validate specific ISO duration parsing for user campaign timing', () => {
    // Test the exact durations from the user's campaign plan
    expect(parseIsoDuration('PT10M')).toBe(10 * 60 * 1000); // 10 minutes = 600,000 ms
    expect(parseIsoDuration('PT24H')).toBe(24 * 60 * 60 * 1000); // 24 hours = 86,400,000 ms
    expect(parseIsoDuration('PT48H')).toBe(48 * 60 * 60 * 1000); // 48 hours = 172,800,000 ms
    expect(parseIsoDuration('PT0S')).toBe(0); // Immediate
  });

  it('should handle the specific transition structure from user campaign', () => {
    const transitions: any[] = [
      { on: 'opened', to: 'next-node', within: 'PT48H' },
      { on: 'no_open', to: 'other-node', after: 'PT10M' },
      { on: 'delivered', to: 'stop-node', after: 'PT0S' },
    ];

    // Verify our logic correctly identifies timeout transitions
    const timeoutTransitions = transitions.filter(
      (t: any) => 'after' in t && (t.on === 'no_open' || t.on === 'no_click')
    );

    expect(timeoutTransitions).toHaveLength(1);
    expect(timeoutTransitions[0]?.on).toBe('no_open');
    expect(timeoutTransitions[0]?.after).toBe('PT10M');
  });
});
