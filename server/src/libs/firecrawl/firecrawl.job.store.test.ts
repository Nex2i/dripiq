// src/libs/firecrawl/firecrawl.job.store.test.ts
import { logger } from '../logger';
import { Guid } from '../../utils/Guid';
import { firecrawlJobStore } from './firecrawl.job.store';

// Mock logger to check warning output
jest.mock('../logger', () => ({
  logger: { warn: jest.fn() },
}));

// Helper: resolves all microtasks and timers
const flushPromisesAndTimers = async () => {
  jest.runOnlyPendingTimers();
  await Promise.resolve();
};

describe('firecrawlJobStore', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
    // @ts-ignore Access internal jobs
    Object.keys(require('./firecrawl.job.store').jobs || {}).forEach((jobId) => {
      delete require('./firecrawl.job.store').jobs[jobId];
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('receivePage', () => {
    it('initializes job and adds first page', () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      const jobs = firecrawlJobStore.jobs;
      expect(jobs[jobId]).toBeDefined();
      expect(jobs[jobId]?.pages.has('page1')).toBe(true);
      expect(jobs[jobId]?.completed).toBe(false);
    });

    it('adds additional pages to existing job', () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.receivePage(jobId, 'page2');
      const jobs = firecrawlJobStore.jobs;
      expect(jobs[jobId]?.pages.has('page2')).toBe(true);
      expect(jobs[jobId]?.pages.size).toBe(2);
    });
  });

  describe('completePage', () => {
    it('removes a page from a job', () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.completePage(jobId, 'page1');
      const jobs = firecrawlJobStore.jobs;
      expect(jobs[jobId]).toBeDefined();
      expect(jobs[jobId]?.pages.size).toBe(0);
    });

    it('deletes job if completed and no pages left', () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.jobs[jobId]!.completed = true;
      firecrawlJobStore.completePage(jobId, 'page1');
      const jobs = firecrawlJobStore.jobs;
      expect(jobs[jobId]).toBeUndefined();
    });

    it('does nothing if job does not exist', () => {
      expect(() => firecrawlJobStore.completePage('notAJob', 'anyPage')).not.toThrow();
    });
  });

  describe('markComplete', () => {
    it('resolves immediately if job does not exist', async () => {
      await expect(firecrawlJobStore.markComplete('notAJob')).resolves.toBeUndefined();
    });

    it('resolves if all pages already complete', async () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.completePage(jobId, 'page1');
      const p = firecrawlJobStore.markComplete(jobId);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      await expect(p).resolves.toBeUndefined();
      expect(firecrawlJobStore.jobs[jobId]).toBeUndefined();
    });

    it('resolves after timeout and logs a warning', async () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'pageA');
      const p = firecrawlJobStore.markComplete(jobId);

      jest.advanceTimersByTime(1000 * 60 * 3); // 3 minutes
      await flushPromisesAndTimers();
      await p;

      expect(firecrawlJobStore.jobs[jobId]).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Timeout reached for job ${jobId}`)
      );
    });
  });

  describe('cleanupJob', () => {
    it('clears timeout and deletes job', () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.jobs[jobId]!.timeout = setTimeout(() => {}, 10000);
      firecrawlJobStore.cleanupJob(jobId);
      expect(firecrawlJobStore.jobs[jobId]).toBeUndefined();
    });

    it('handles missing job gracefully', () => {
      expect(() => firecrawlJobStore.cleanupJob('notAJob')).not.toThrow();
    });
  });
});
