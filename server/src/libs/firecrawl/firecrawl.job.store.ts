// src/libs/firecrawl/firecrawl.job.store.ts
import { logger } from '../logger';

const JOB_TIMEOUT_MS = 2500;
const MAX_WAIT_MS = 1000 * 60 * 3; // 3 minutes

const jobs: Record<string, JobData> = {};

interface JobData {
  pages: Set<string>;
  completed: boolean;
  timeout: any | null;
  _completionPromise?: Promise<void>;
}

function receivePage(jobId: string, pageId: string) {
  if (!jobs[jobId]) {
    jobs[jobId] = {
      pages: new Set(),
      completed: false,
      timeout: null,
    };
  }
  jobs[jobId].pages.add(pageId);
}

function completePage(jobId: string, pageId: string) {
  const job = jobs[jobId];
  if (!job) return;
  job.pages.delete(pageId);
  if (job.pages.size === 0 && job.completed) {
    cleanupJob(jobId);
  }
}

function markComplete(jobId: string): Promise<void> {
  const job = jobs[jobId];
  if (!job) return Promise.resolve();

  job.completed = true;

  if (job._completionPromise) {
    return job._completionPromise;
  }

  const startTime = Date.now();

  job._completionPromise = new Promise((resolve) => {
    const poll = () => {
      const elapsed = Date.now() - startTime;
      if (job.pages.size === 0) {
        cleanupJob(jobId);
        resolve();
        return;
      }
      if (elapsed >= MAX_WAIT_MS) {
        logger.warn(
          `Timeout reached for job ${jobId}. Forcing completion with ${job.pages.size} pages left.`
        );
        cleanupJob(jobId);
        resolve();
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
  }
}

export const firecrawlJobStore = {
  receivePage,
  completePage,
  markComplete,
  // Testing Only
  jobs,
  cleanupJob,
};
