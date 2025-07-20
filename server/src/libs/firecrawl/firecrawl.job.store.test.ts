// src/libs/firecrawl/firecrawl.job.store.test.ts
import { logger } from '../logger';
import { Guid } from '../../utils/Guid';
import { firecrawlJobStore } from './firecrawl.job.store';

const JOB_TIMEOUT_MS = 2500;

// Mock logger to check warning output
jest.mock('../logger', () => ({
  logger: { 
    warn: jest.fn(), 
    debug: jest.fn() 
  },
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
      expect(jobs[jobId]?.receivedPages.has('page1')).toBe(true);
      expect(jobs[jobId]?.processingPages.has('page1')).toBe(true);
      expect(jobs[jobId]?.completed).toBe(false);
    });

    it('adds additional pages to existing job', () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.receivePage(jobId, 'page2');
      const jobs = firecrawlJobStore.jobs;
      expect(jobs[jobId]?.receivedPages.has('page2')).toBe(true);
      expect(jobs[jobId]?.processingPages.has('page2')).toBe(true);
      expect(jobs[jobId]?.receivedPages.size).toBe(2);
      expect(jobs[jobId]?.processingPages.size).toBe(2);
    });
  });

  describe('completePage', () => {
    it('removes a page from processing but keeps it in received', () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.completePage(jobId, 'page1');
      const jobs = firecrawlJobStore.jobs;
      expect(jobs[jobId]).toBeDefined();
      expect(jobs[jobId]?.receivedPages.has('page1')).toBe(true);
      expect(jobs[jobId]?.processingPages.has('page1')).toBe(false);
      expect(jobs[jobId]?.processingPages.size).toBe(0);
    });

    it('deletes job if completed and no pages are processing', () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.jobs[jobId]!.completed = true;
      firecrawlJobStore.completePage(jobId, 'page1');
      const jobs = firecrawlJobStore.jobs;
      expect(jobs[jobId]).toBeUndefined();
    });

    it('does not delete job if completed but pages are still processing', () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.receivePage(jobId, 'page2');
      firecrawlJobStore.jobs[jobId]!.completed = true;
      firecrawlJobStore.completePage(jobId, 'page1');
      const jobs = firecrawlJobStore.jobs;
      expect(jobs[jobId]).toBeDefined();
      expect(jobs[jobId]?.processingPages.size).toBe(1);
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

    it('waits for processing pages to complete before resolving', async () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.receivePage(jobId, 'page2');
      
      // Start the completion process
      const completionPromise = firecrawlJobStore.markComplete(jobId);
      
      // Complete first page - job should still exist
      firecrawlJobStore.completePage(jobId, 'page1');
      expect(firecrawlJobStore.jobs[jobId]).toBeDefined();
      expect(firecrawlJobStore.jobs[jobId]?.processingPages.size).toBe(1);
      
      // Complete second page - job should be cleaned up immediately
      firecrawlJobStore.completePage(jobId, 'page2');
      
      // The promise should resolve on the next tick since all pages are done
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      
      await expect(completionPromise).resolves.toBeUndefined();
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

  describe('getJobStatus', () => {
    it('returns job status for existing job', () => {
      const jobId = Guid();
      firecrawlJobStore.receivePage(jobId, 'page1');
      
      const status = firecrawlJobStore.getJobStatus(jobId);
      expect(status).toBeDefined();
      expect(status?.receivedPages.size).toBe(1);
      expect(status?.processingPages.size).toBe(1);
    });

    it('returns null for non-existent job', () => {
      const status = firecrawlJobStore.getJobStatus('nonExistentJob');
      expect(status).toBeNull();
    });
  });

  describe('scaling scenarios', () => {
    it('handles 50+ pages completing in random order', async () => {
      const jobId = Guid();
      const pageCount = 55;
      const pageIds: string[] = [];
      
      // Simulate receiving 50+ pages
      for (let i = 0; i < pageCount; i++) {
        const pageId = `page-${i}`;
        pageIds.push(pageId);
        firecrawlJobStore.receivePage(jobId, pageId);
      }
      
      expect(firecrawlJobStore.jobs[jobId]?.processingPages.size).toBe(pageCount);
      
      // Mark job as complete (like the crawl.completed webhook)
      const completionPromise = firecrawlJobStore.markComplete(jobId);
      
      // Complete pages in random order (simulating concurrent async processing)
      const shuffledPages = [...pageIds].sort(() => Math.random() - 0.5);
      
             for (let i = 0; i < pageCount - 1; i++) {
         firecrawlJobStore.completePage(jobId, shuffledPages[i]!);
         // Job should still exist until all pages are done
         expect(firecrawlJobStore.jobs[jobId]).toBeDefined();
       }
       
       // Complete the last page
       firecrawlJobStore.completePage(jobId, shuffledPages[pageCount - 1]!);
      
      // Job should be cleaned up and promise resolved
      await expect(completionPromise).resolves.toBeUndefined();
      expect(firecrawlJobStore.jobs[jobId]).toBeUndefined();
    });

    it('handles completion event arriving before all page events', async () => {
      const jobId = Guid();
      
      // Add a few pages
      firecrawlJobStore.receivePage(jobId, 'page1');
      firecrawlJobStore.receivePage(jobId, 'page2');
      
      // Mark complete early (common race condition with 50+ pages)
      const completionPromise = firecrawlJobStore.markComplete(jobId);
      
      // More pages arrive after completion event
      firecrawlJobStore.receivePage(jobId, 'page3');
      firecrawlJobStore.receivePage(jobId, 'page4');
      
      // Complete all pages
      firecrawlJobStore.completePage(jobId, 'page1');
      firecrawlJobStore.completePage(jobId, 'page2');
      firecrawlJobStore.completePage(jobId, 'page3');
      firecrawlJobStore.completePage(jobId, 'page4');
      
      // Should resolve properly
      await expect(completionPromise).resolves.toBeUndefined();
      expect(firecrawlJobStore.jobs[jobId]).toBeUndefined();
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
