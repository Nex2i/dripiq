// src/libs/firecrawl/firecrawl.job.store.ts
import { logger } from '../logger';

const JOB_TIMEOUT_MS = 2500;
const MAX_WAIT_MS = 1000 * 60 * 3; // 3 minutes

const jobs: Record<string, JobData> = {};

interface JobData {
  // Track pages that have been received but not yet processed
  receivedPages: Set<string>;
  // Track pages currently being processed
  processingPages: Set<string>;
  completed: boolean;
  timeout: any | null;
  _completionPromise?: Promise<void>;
  _completionResolve?: () => void;
}

function receivePage(jobId: string, pageId: string) {
  if (!jobs[jobId]) {
    jobs[jobId] = {
      receivedPages: new Set(),
      processingPages: new Set(),
      completed: false,
      timeout: null,
    };
  }
  
  const job = jobs[jobId];
  job.receivedPages.add(pageId);
  job.processingPages.add(pageId);
  
  logger.debug(`Job ${jobId}: Received page ${pageId}. Received: ${job.receivedPages.size}, Processing: ${job.processingPages.size}`);
}

function completePage(jobId: string, pageId: string) {
  const job = jobs[jobId];
  if (!job) return;
  
  job.processingPages.delete(pageId);
  
  logger.debug(`Job ${jobId}: Completed page ${pageId}. Received: ${job.receivedPages.size}, Processing: ${job.processingPages.size}`);
  
  // Only cleanup if job is marked complete AND all pages are done processing
  if (job.completed && job.processingPages.size === 0) {
    // If there's a completion promise waiting, resolve it immediately
    if (job._completionResolve) {
      logger.debug(`Job ${jobId}: Resolving completion promise via completePage`);
      const resolve = job._completionResolve;
      cleanupJob(jobId);
      resolve();
    } else {
      cleanupJob(jobId);
    }
  }
}

function markComplete(jobId: string): Promise<void> {
  const job = jobs[jobId];
  if (!job) return Promise.resolve();

  job.completed = true;
  
  logger.debug(`Job ${jobId}: Marked complete. Received: ${job.receivedPages.size}, Processing: ${job.processingPages.size}`);

  if (job._completionPromise) {
    return job._completionPromise;
  }

  const startTime = Date.now();

  job._completionPromise = new Promise((resolve) => {
    job._completionResolve = resolve;
    
    const poll = () => {
      // Check if job was deleted (resolved externally)
      if (!jobs[jobId]) {
        return;
      }
      
      const elapsed = Date.now() - startTime;
      
      // Job is complete when all processing pages are done
      if (job.processingPages.size === 0) {
        logger.debug(`Job ${jobId}: All pages completed. Cleaning up.`);
        const resolve = job._completionResolve;
        cleanupJob(jobId);
        if (resolve) resolve();
        return;
      }
      
      if (elapsed >= MAX_WAIT_MS) {
        logger.warn(
          `Timeout reached for job ${jobId}. Forcing completion with ${job.processingPages.size} pages still processing (${job.receivedPages.size} total received).`
        );
        const resolve = job._completionResolve;
        cleanupJob(jobId);
        if (resolve) resolve();
        return;
      }
      
      job.timeout = setTimeout(poll, JOB_TIMEOUT_MS);
    };
    poll();
  });
  return job._completionPromise;
}

function cleanupJob(jobId: string) {
  const job = jobs[jobId];
  if (job) {
    if (job.timeout) clearTimeout(job.timeout);
    delete jobs[jobId];
    logger.debug(`Job ${jobId}: Cleaned up`);
  }
}

// Additional function to get job status for debugging
function getJobStatus(jobId: string): JobData | null {
  return jobs[jobId] || null;
}

export const firecrawlJobStore = {
  receivePage,
  completePage,
  markComplete,
  getJobStatus,
  // Testing Only
  jobs,
  cleanupJob,
};
