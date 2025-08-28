import { LeadInitialProcessingPublisher } from './leadInitialProcessing.publisher.service';
import type { LeadInitialProcessingJobPayload } from '@/workers/lead-initial-processing/lead-initial-processing.types';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';

// Mock the queue
const mockQueue = {
  add: jest.fn(),
  addBulk: jest.fn(),
  getWaiting: jest.fn(),
  getActive: jest.fn(),
  getCompleted: jest.fn(),
  getFailed: jest.fn(),
  getDelayed: jest.fn(),
};

jest.mock('@/libs/bullmq', () => ({
  getQueue: jest.fn(() => mockQueue),
}));

jest.mock('@/libs/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('LeadInitialProcessingPublisher', () => {
  const mockPayload: LeadInitialProcessingJobPayload = {
    tenantId: 'test-tenant-id',
    leadId: 'test-lead-id',
    leadUrl: 'https://example.com',
    metadata: {
      createdBy: 'test-user-id',
      createdAt: new Date().toISOString(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('publish', () => {
    it('should publish a job successfully', async () => {
      const mockJobId = 'test-job-id';
      mockQueue.add.mockResolvedValue({ id: mockJobId });

      const result = await LeadInitialProcessingPublisher.publish(mockPayload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        JOB_NAMES.lead_initial_processing.process,
        mockPayload,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 10,
          removeOnFail: 5,
        }
      );
      expect(result).toBe(mockJobId);
    });

    it('should handle job without id', async () => {
      mockQueue.add.mockResolvedValue({});

      const result = await LeadInitialProcessingPublisher.publish(mockPayload);

      expect(result).toBe('unknown');
    });

    it('should handle errors when publishing', async () => {
      const error = new Error('Queue error');
      mockQueue.add.mockRejectedValue(error);

      await expect(LeadInitialProcessingPublisher.publish(mockPayload)).rejects.toThrow('Queue error');
    });
  });

  describe('publishBatch', () => {
    it('should publish multiple jobs successfully', async () => {
      const payloads = [mockPayload, { ...mockPayload, leadId: 'test-lead-id-2' }];
      const mockJobs = [{ id: 'job-1' }, { id: 'job-2' }];
      mockQueue.addBulk.mockResolvedValue(mockJobs);

      const result = await LeadInitialProcessingPublisher.publishBatch(payloads);

      expect(mockQueue.addBulk).toHaveBeenCalledWith(
        payloads.map((payload) => ({
          name: JOB_NAMES.lead_initial_processing.process,
          data: payload,
          opts: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: 10,
            removeOnFail: 5,
          },
        }))
      );
      expect(result).toEqual(['job-1', 'job-2']);
    });

    it('should handle jobs without ids', async () => {
      const payloads = [mockPayload];
      const mockJobs = [{}];
      mockQueue.addBulk.mockResolvedValue(mockJobs);

      const result = await LeadInitialProcessingPublisher.publishBatch(payloads);

      expect(result).toEqual(['unknown']);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      mockQueue.getWaiting.mockResolvedValue([1, 2]);
      mockQueue.getActive.mockResolvedValue([1]);
      mockQueue.getCompleted.mockResolvedValue([1, 2, 3]);
      mockQueue.getFailed.mockResolvedValue([]);
      mockQueue.getDelayed.mockResolvedValue([1]);

      const stats = await LeadInitialProcessingPublisher.getQueueStats();

      expect(stats).toEqual({
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 0,
        delayed: 1,
      });
    });

    it('should handle errors when getting queue stats', async () => {
      const error = new Error('Queue stats error');
      mockQueue.getWaiting.mockRejectedValue(error);

      await expect(LeadInitialProcessingPublisher.getQueueStats()).rejects.toThrow('Queue stats error');
    });
  });

  describe('Queue Configuration', () => {
    it('should use correct queue name and job name', () => {
      expect(QUEUE_NAMES.lead_initial_processing).toBe('lead_initial_processing');
      expect(JOB_NAMES.lead_initial_processing.process).toBe('lead_initial_processing.process');
    });

    it('should publish with correct job options', async () => {
      const mockJobId = 'test-job-id';
      mockQueue.add.mockResolvedValue({ id: mockJobId });

      await LeadInitialProcessingPublisher.publish(mockPayload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        JOB_NAMES.lead_initial_processing.process,
        mockPayload,
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 10,
          removeOnFail: 5,
        })
      );
    });
  });
});