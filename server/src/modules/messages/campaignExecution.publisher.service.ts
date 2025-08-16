import { getQueue } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';

export type CampaignExecutionJobPayload = {
  tenantId: string;
  campaignId: string;
  contactId: string;
  nodeId: string;
  actionType: 'send' | 'wait' | 'timeout';
  nodeData?: {
    subject?: string;
    body?: string;
    channel?: string;
    eventType?: string;
    targetNodeId?: string;
  };
  metadata?: {
    triggeredBy?: string;
    leadId?: string;
    [key: string]: unknown;
  };
};

export class CampaignExecutionPublisher {
  private static queue = getQueue(QUEUE_NAMES.campaign_execution);

  static async publish(payload: CampaignExecutionJobPayload) {
    try {
      logger.info('Publishing campaign execution job', {
        tenantId: payload.tenantId,
        campaignId: payload.campaignId,
        contactId: payload.contactId,
        nodeId: payload.nodeId,
        actionType: payload.actionType,
      });

      const job = await this.queue.add(JOB_NAMES.campaign_execution.initialize, payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 10,
        removeOnFail: 5,
        delay: Math.random() * 2000, // Random delay 0-2 seconds
      });

      logger.info('Campaign execution job published successfully', {
        tenantId: payload.tenantId,
        campaignId: payload.campaignId,
        nodeId: payload.nodeId,
        jobId: job.id,
      });

      return job;
    } catch (error) {
      logger.error('Failed to publish campaign execution job', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: {
          tenantId: payload.tenantId,
          campaignId: payload.campaignId,
          contactId: payload.contactId,
          nodeId: payload.nodeId,
          actionType: payload.actionType,
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

      const createdJobs = await this.queue.addBulk(jobs);

      logger.info('Campaign execution jobs published successfully', {
        count: createdJobs.length,
        jobIds: createdJobs.map((job) => job.id),
      });

      return createdJobs;
    } catch (error) {
      logger.error('Failed to publish batch of campaign execution jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: payloads.length,
      });
      throw error;
    }
  }
}
