import { getQueue } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';

export type CampaignCreationJobPayload = {
  tenantId: string;
  leadId: string;
  contactId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

export class CampaignCreationPublisher {
  private static queue = getQueue(QUEUE_NAMES.campaign_creation);

  static async publish(payload: CampaignCreationJobPayload) {
    try {
      logger.info('Publishing campaign creation job', {
        tenantId: payload.tenantId,
        leadId: payload.leadId,
        contactId: payload.contactId,
      });

      return this.queue.add(JOB_NAMES.campaign_creation.create, payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 10,
        removeOnFail: 5,
      });
    } catch (error) {
      logger.error('Failed to publish campaign creation job', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload,
      });
      throw error;
    }
  }

  static async publishBatch(payloads: CampaignCreationJobPayload[]) {
    try {
      logger.info('Publishing batch of campaign creation jobs', {
        count: payloads.length,
        tenantId: payloads[0]?.tenantId,
        leadId: payloads[0]?.leadId,
      });

      const jobs = payloads.map((payload) => ({
        name: JOB_NAMES.campaign_creation.create,
        data: payload,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      }));

      return this.queue.addBulk(jobs);
    } catch (error) {
      logger.error('Failed to publish batch of campaign creation jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: payloads.length,
      });
      throw error;
    }
  }
}
