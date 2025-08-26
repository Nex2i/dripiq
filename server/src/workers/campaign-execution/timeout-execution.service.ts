import type { Job } from 'bullmq';
import { logger } from '@/libs/logger';
import { contactCampaignRepository, messageEventRepository } from '@/repositories';
import { campaignPlanExecutionService } from '@/modules/campaign/campaignPlanExecution.service';
import type { TimeoutJobPayload } from '@/types/timeout.types';
import { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';

export interface TimeoutJobResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  syntheticEventId?: string;
}

export class TimeoutExecutionService {
  async processTimeout(job: Job<TimeoutJobPayload>): Promise<TimeoutJobResult> {
    const jobData = job.data;

    // Validate that this is actually a timeout job payload
    if (!jobData.eventType || !jobData.messageId) {
      logger.error(
        '[CampaignExecutionWorker] Invalid timeout job payload - missing required fields',
        {
          jobId: job.id,
          jobName: job.name,
          hasEventType: !!jobData.eventType,
          hasMessageId: !!jobData.messageId,
          actualFields: Object.keys(jobData),
          jobData: JSON.stringify(jobData),
        }
      );

      return {
        success: false,
        reason: `Invalid timeout job payload: missing ${!jobData.eventType ? 'eventType' : 'messageId'}`,
      };
    }

    const { campaignId, nodeId, messageId, eventType, tenantId } = jobData;

    logger.info('[CampaignExecutionWorker] Processing timeout job', {
      jobId: job.id,
      campaignId,
      nodeId,
      eventType,
      messageId,
      tenantId,
    });

    try {
      // Check if real event already happened
      const realEventType = eventType.replace('no_', ''); // no_open -> open
      const realEventExists = await messageEventRepository.findByMessageAndType(
        messageId,
        realEventType
      );

      if (realEventExists) {
        logger.info('[CampaignExecutionWorker] Real event found, skipping synthetic event', {
          messageId,
          eventType,
          realEventId: realEventExists.id,
          jobId: job.id,
        });
        return {
          success: true,
          skipped: true,
          reason: 'real_event_exists',
        };
      }

      // Generate synthetic event
      const syntheticEvent = await messageEventRepository.createForTenant(tenantId, {
        messageId,
        type: eventType, // no_open, no_click
        eventAt: new Date(),
        data: {
          synthetic: true,
          triggeredBy: 'timeout',
          originalJobId: job.id?.toString(),
          scheduledAt: job.opts?.delay
            ? new Date(Date.now() - (job.opts.delay as number))
            : new Date(),
          actualFiredAt: new Date(),
        },
      });

      logger.info('[CampaignExecutionWorker] Created synthetic event', {
        eventId: syntheticEvent.id,
        eventType,
        messageId,
        jobId: job.id,
      });

      // Trigger campaign transition processing
      // Get the campaign to access the plan
      const campaign = await contactCampaignRepository.findByIdForTenant(campaignId, tenantId);

      if (campaign && campaign.planJson) {
        const campaignPlan = campaign.planJson as CampaignPlanOutput;

        await campaignPlanExecutionService.processTransition({
          tenantId,
          campaignId,
          contactId: campaign.contactId,
          leadId: campaign.leadId,
          eventType,
          currentNodeId: nodeId, // Use the nodeId from timeout payload, not campaign state
          plan: campaignPlan,
          eventRef: syntheticEvent.id,
        });

        logger.info('[CampaignExecutionWorker] Campaign transition processed successfully', {
          tenantId,
          campaignId,
          eventType,
          currentNodeId: nodeId, // Log the actual node used for transition
        });
      } else {
        logger.warn(
          '[CampaignExecutionWorker] Could not process campaign transition - missing campaign data',
          {
            tenantId,
            campaignId,
            campaignExists: !!campaign,
            hasPlan: !!campaign?.planJson,
            nodeId, // Log the nodeId from payload
            jobId: job.id,
          }
        );
      }

      return {
        success: true,
        syntheticEventId: syntheticEvent.id,
      };
    } catch (error) {
      logger.error('[CampaignExecutionWorker] Failed to process timeout job', {
        jobId: job.id,
        campaignId,
        nodeId,
        eventType,
        messageId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
