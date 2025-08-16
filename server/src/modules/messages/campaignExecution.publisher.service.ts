import { getQueue } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';

export type CampaignExecutionJobPayload = {
  tenantId: string;
  campaignId: string;
  contactId: string;
  plan: CampaignPlanOutput;
  userId?: string;
  metadata?: Record<string, unknown>;
};

export class CampaignExecutionPublisher {
  private static queue = getQueue(QUEUE_NAMES.campaign_execution);

  static async publish(payload: CampaignExecutionJobPayload) {
    try {
      logger.info('Publishing campaign execution job', {
        tenantId: payload.tenantId,
        campaignId: payload.campaignId,
        contactId: payload.contactId,
      });

      return this.queue.add(JOB_NAMES.campaign_execution.initialize, payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 10,
        removeOnFail: 5,
        delay: Math.random() * 2000, // Random delay 0-2 seconds
      });
    } catch (error) {
      logger.error('Failed to publish campaign execution job', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: {
          tenantId: payload.tenantId,
          campaignId: payload.campaignId,
          contactId: payload.contactId,
        },
      });
      throw error;
    }
  }

  static async publishBatch(payloads: CampaignExecutionJobPayload[]) {
    try {
      logger.info('Publishing batch of campaign execution jobs', {
        count: payloads.length,
        tenantId: payloads[0]?.tenantId,
      });

      const jobs = payloads.map((payload, index) => ({
        name: JOB_NAMES.campaign_execution.initialize,
        data: payload,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 10,
          removeOnFail: 5,
          delay: index * 500, // 500ms between each job
        },
      }));

      return this.queue.addBulk(jobs);
    } catch (error) {
      logger.error('Failed to publish batch of campaign execution jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: payloads.length,
      });
      throw error;
    }
  }
}
