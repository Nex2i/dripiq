import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';
import type { Job } from 'bullmq';

export type ProcessMessageJob = {
  tenantId: string;
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
};

// TODO - Remove, testing logic only
function logTestMessage(job: Job<ProcessMessageJob>) {
  // eslint-disable-next-line no-console
  console.log(`[Worker] Test message received:`, {
    id: job.id,
    name: job.name,
    data: job.data,
  });
}

const worker = getWorker<ProcessMessageJob, { ok: boolean }>(
  QUEUE_NAMES.messages,
  async (job: Job<ProcessMessageJob>) => {
    const data = job.data;

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