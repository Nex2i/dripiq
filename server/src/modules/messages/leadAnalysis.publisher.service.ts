import { getQueue } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';

export type LeadAnalysisJobPayload = {
  tenantId: string;
  leadId: string;
  metadata?: Record<string, unknown>;
};

export class LeadAnalysisPublisher {
  private static queue = getQueue(QUEUE_NAMES.lead_analysis);

  static async publish(payload: LeadAnalysisJobPayload) {
    try {
      logger.info('Publishing lead analysis job', {
        tenantId: payload.tenantId,
        leadId: payload.leadId,
      });

      return this.queue.add(JOB_NAMES.lead_analysis.process, payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 10,
        removeOnFail: 5,
      });
    } catch (error) {
      logger.error('Failed to publish lead analysis job', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload,
      });
      throw error;
    }
  }
}