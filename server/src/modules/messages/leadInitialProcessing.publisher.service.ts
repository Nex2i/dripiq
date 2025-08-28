import { getQueue } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';
import type { LeadInitialProcessingJobPayload } from '@/workers/lead-initial-processing/lead-initial-processing.types';

export type { LeadInitialProcessingJobPayload };

export class LeadInitialProcessingPublisher {
  private static queue = getQueue(QUEUE_NAMES.lead_initial_processing);

  /**
   * Publishes a lead initial processing job to the queue
   */
  static async publish(payload: LeadInitialProcessingJobPayload): Promise<string> {
    try {
      const job = await this.queue.add(JOB_NAMES.lead_initial_processing.process, payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10, // Keep last 10 completed jobs for monitoring
        removeOnFail: 5, // Keep last 5 failed jobs for debugging
      });

      logger.info('[LeadInitialProcessingPublisher] Job published', {
        jobId: job.id,
        tenantId: payload.tenantId,
        leadId: payload.leadId,
        leadUrl: payload.leadUrl,
      });

      return job.id || 'unknown';
    } catch (error) {
      logger.error('[LeadInitialProcessingPublisher] Failed to publish job', {
        tenantId: payload.tenantId,
        leadId: payload.leadId,
        leadUrl: payload.leadUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Publishes multiple lead initial processing jobs in batch
   */
  static async publishBatch(payloads: LeadInitialProcessingJobPayload[]): Promise<string[]> {
    try {
      const jobs = await this.queue.addBulk(
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

      const jobIds = jobs.map((job) => job.id || 'unknown');

      logger.info('[LeadInitialProcessingPublisher] Batch jobs published', {
        jobCount: jobs.length,
        jobIds,
        leadIds: payloads.map((p) => p.leadId),
      });

      return jobIds;
    } catch (error) {
      logger.error('[LeadInitialProcessingPublisher] Failed to publish batch jobs', {
        jobCount: payloads.length,
        leadIds: payloads.map((p) => p.leadId),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Gets queue statistics for monitoring
   */
  static async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      logger.error('[LeadInitialProcessingPublisher] Failed to get queue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
