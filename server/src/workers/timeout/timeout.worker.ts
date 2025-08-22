import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { logger } from '@/libs/logger';
import { QUEUE_NAMES } from '@/constants/queues';
import { messageEventRepository, contactCampaignRepository } from '@/repositories';
import { campaignPlanExecutionService } from '@/modules/campaign/campaignPlanExecution.service';
import type { TimeoutJobParams } from '@/types/timeout.types';

export interface TimeoutJobResult {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  syntheticEventId?: string;
}

export async function processTimeout(job: Job<TimeoutJobParams>): Promise<TimeoutJobResult> {
  const { tenantId, campaignId, nodeId, messageId, eventType, scheduledAt } = job.data;

  logger.info('[TimeoutWorker] Processing timeout job', {
    jobId: job.id,
    tenantId,
    campaignId,
    nodeId,
    messageId,
    eventType,
    scheduledAt,
  });

  try {
    // Check if real event already happened (e.g., open for no_open, click for no_click)
    const realEventType = eventType.replace('no_', '');
    const realEventExists = await messageEventRepository.findByMessageAndTypeForTenant(
      tenantId,
      messageId,
      realEventType
    );

    if (realEventExists) {
      logger.info('[TimeoutWorker] Real event found, skipping synthetic event', {
        jobId: job.id,
        tenantId,
        messageId,
        eventType,
        realEventId: realEventExists.id,
      });
      return { skipped: true, reason: 'real_event_exists' };
    }

    // Generate synthetic event
    const now = new Date();
    const syntheticEvent = await messageEventRepository.createForTenant(tenantId, {
      messageId,
      type: eventType,
      eventAt: now,
      data: {
        synthetic: true,
        triggeredBy: 'timeout',
        originalJobId: job.id,
        scheduledAt,
        actualFiredAt: now.toISOString(),
      },
    } as any);

    logger.info('[TimeoutWorker] Created synthetic event', {
      jobId: job.id,
      tenantId,
      eventId: syntheticEvent.id,
      eventType,
      messageId,
    });

    // Load campaign plan to process transition
    const campaign = await contactCampaignRepository.findByIdForTenant(campaignId, tenantId);
    if (!campaign || !campaign.planJson) {
      const reason = `Campaign or plan not found for campaignId=${campaignId}`;
      logger.error('[TimeoutWorker] Cannot process transition - missing campaign/plan', {
        jobId: job.id,
        tenantId,
        campaignId,
      });
      throw new Error(reason);
    }

    await campaignPlanExecutionService.processTransition({
      tenantId,
      campaignId,
      eventType,
      currentNodeId: nodeId,
      plan: campaign.planJson as any,
      eventRef: syntheticEvent.id,
    });

    logger.info('[TimeoutWorker] Timeout processed and transition triggered', {
      jobId: job.id,
      tenantId,
      campaignId,
      nodeId,
      eventType,
      syntheticEventId: syntheticEvent.id,
    });

    return { success: true, syntheticEventId: syntheticEvent.id };
  } catch (error) {
    logger.error('[TimeoutWorker] Timeout processing failed', {
      jobId: job.id,
      tenantId,
      campaignId,
      nodeId,
      messageId,
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

const timeoutWorker = getWorker<TimeoutJobParams, TimeoutJobResult>(
  QUEUE_NAMES.campaign_execution,
  async (job) => {
    if (job.name === 'timeout') {
      return await processTimeout(job);
    }
    throw new Error(`Unknown job type for TimeoutWorker: ${job.name}`);
  }
);

export default timeoutWorker;
