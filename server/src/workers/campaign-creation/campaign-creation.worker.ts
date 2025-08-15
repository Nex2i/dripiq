import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';
import { generateContactStrategy } from '@/modules/ai/contactStrategy.service';
import type { CampaignCreationJobPayload } from '@/modules/messages/campaignCreation.publisher.service';

export type CampaignCreationJobResult = {
  success: boolean;
  campaignId?: string;
  contactId: string;
  leadId: string;
  error?: string;
  cached?: boolean;
};

async function processCampaignCreation(
  job: Job<CampaignCreationJobPayload>
): Promise<CampaignCreationJobResult> {
  const { tenantId, leadId, contactId, userId, metadata } = job.data;

  try {
    logger.info('[CampaignCreationWorker] Processing campaign creation', {
      jobId: job.id,
      tenantId,
      leadId,
      contactId,
      automated: metadata?.automatedCreation,
    });

    // Generate contact strategy and create campaign
    const strategyResult = await generateContactStrategy({
      tenantId,
      leadId,
      contactId,
      userId,
    });

    logger.info('[CampaignCreationWorker] Campaign creation completed', {
      jobId: job.id,
      tenantId,
      leadId,
      contactId,
      totalIterations: strategyResult.totalIterations,
      functionCalls: strategyResult.functionCalls?.length || 0,
    });

    return {
      success: true,
      contactId,
      leadId,
      // Note: The campaignId is created internally by contactCampaignPlanService.persistPlan
      // We could potentially return it if needed by modifying the generateContactStrategy service
    };
  } catch (error) {
    logger.error('[CampaignCreationWorker] Campaign creation failed', {
      jobId: job.id,
      tenantId,
      leadId,
      contactId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Don't retry if it's a validation or configuration error
    const isRetryableError =
      !(error instanceof Error) ||
      (!error.message.includes('not found') &&
        !error.message.includes('invalid') &&
        !error.message.includes('access denied'));

    if (!isRetryableError) {
      logger.warn('[CampaignCreationWorker] Non-retryable error, marking as failed', {
        jobId: job.id,
        tenantId,
        leadId,
        contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      success: false,
      contactId,
      leadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

const campaignCreationWorker = getWorker<CampaignCreationJobPayload, CampaignCreationJobResult>(
  QUEUE_NAMES.campaign_creation,
  async (job: Job<CampaignCreationJobPayload>) => {
    if (job.name !== JOB_NAMES.campaign_creation.create) {
      logger.warn('[CampaignCreationWorker] Skipping unexpected job name', {
        jobId: job.id,
        jobName: job.name,
      });
      return {
        success: false,
        contactId: job.data.contactId,
        leadId: job.data.leadId,
        error: 'Unexpected job name',
      };
    }

    return processCampaignCreation(job);
  }
);

export default campaignCreationWorker;
