import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';

export type ProcessMessageJob = {
  tenantId: string;
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
};

// TODO - Remove, testing logic only
function logTestMessage(job: Job<ProcessMessageJob>) {
  console.log(`[Worker] Test message received:`, {
    id: job.id,
    name: job.name,
    data: job.data,
  });
}

const worker = getWorker<ProcessMessageJob, { ok: boolean }>(
  QUEUE_NAMES.messages,
  async (job: Job<ProcessMessageJob>) => {
    if (job.name !== JOB_NAMES.messages.process) {
      logger.warn('Skipping unexpected job name', { jobId: job.id, jobName: job.name });
      return { ok: true };
    }

    logTestMessage(job);

    return { ok: true };
  },
  { concurrency: 5 }
);

export default worker;
