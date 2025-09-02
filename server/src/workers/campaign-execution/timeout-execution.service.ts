import type { Job } from 'bullmq';
import { logger } from '@/libs/logger';
import { contactCampaignRepository, messageEventRepository } from '@/repositories';
import { campaignPlanExecutionService } from '@/modules/campaign/campaignPlanExecution.service';
import { calendarClickValidationService } from '@/services/calendarClickValidation.service';
import { CAMPAIGN_CONSTANTS } from '@/constants/staticCampaignTemplate';
import type { TimeoutJobPayload } from '@/types/timeout.types';
import { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';

export interface TimeoutJobResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  syntheticEventId?: string;
  calendarClickId?: string;
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

      throw new Error(
        `Invalid timeout job payload: missing ${!jobData.eventType ? 'eventType' : 'messageId'}`
      );
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

      // Special handling for no_click events - check calendar clicks
      if (eventType === CAMPAIGN_CONSTANTS.EVENTS.NO_CLICK) {
        const calendarClickResult = await this.handleNoClickCalendarValidation(
          job,
          tenantId,
          campaignId,
          nodeId,
          messageId
        );
        
        if (calendarClickResult) {
          return calendarClickResult;
        }
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

      throw error;
    }
  }

  /**
   * Handle calendar click validation for no_click timeout events
   * Returns TimeoutJobResult if calendar clicks are found, null otherwise
   */
  private async handleNoClickCalendarValidation(
    job: Job<TimeoutJobPayload>,
    tenantId: string,
    campaignId: string,
    nodeId: string,
    messageId: string
  ): Promise<TimeoutJobResult | null> {
    try {
      // Get campaign details for calendar click validation
      const campaign = await contactCampaignRepository.findByIdForTenant(campaignId, tenantId);

      if (!campaign) {
        return null;
      }

      // Get the proper node start time from campaign execution service
      const nodeStartTime = await campaignPlanExecutionService.getCurrentNodeStartTime(
        tenantId,
        campaignId,
        nodeId
      );

      if (!nodeStartTime) {
        logger.warn(
          '[CampaignExecutionWorker] Could not determine node start time for calendar click validation',
          {
            tenantId,
            campaignId,
            nodeId,
            jobId: job.id,
          }
        );
        return null; // Skip calendar validation, proceed with normal no_click timeout
      }

      // Check for any calendar clicks since the node started
      const timeSinceNodeStart = new Date().getTime() - nodeStartTime.getTime();

      const calendarClickResult = await calendarClickValidationService.hasCalendarClicksInWindow({
        tenantId,
        campaignId,
        contactId: campaign.contactId,
        leadId: campaign.leadId,
        timeWindowMs: timeSinceNodeStart,
        referenceTime: new Date(),
      });

      if (!calendarClickResult.hasClicks) {
        logger.debug(
          '[CampaignExecutionWorker] No calendar clicks found, proceeding with no_click timeout',
          {
            messageId,
            campaignId,
            contactId: campaign.contactId,
            leadId: campaign.leadId,
            nodeStartTime: nodeStartTime.toISOString(),
            timeSinceNodeStart,
            jobId: job.id,
          }
        );
        return null; // No clicks found, proceed with normal no_click timeout
      }

      logger.info(
        '[CampaignExecutionWorker] Calendar clicks found, triggering click transition instead of no_click',
        {
          messageId,
          campaignId,
          contactId: campaign.contactId,
          leadId: campaign.leadId,
          clickCount: calendarClickResult.clickCount,
          latestClickId: calendarClickResult.latestClick?.id,
          jobId: job.id,
        }
      );

      // Trigger campaign transition using the actual calendar click
      if (campaign.planJson) {
        const campaignPlan = campaign.planJson as CampaignPlanOutput;

        await campaignPlanExecutionService.processTransition({
          tenantId,
          campaignId,
          contactId: campaign.contactId,
          leadId: campaign.leadId,
          eventType: 'click',
          currentNodeId: nodeId,
          plan: campaignPlan,
          eventRef: calendarClickResult.latestClick!.id, // Use actual calendar click ID
        });

        logger.info('[CampaignExecutionWorker] Campaign click transition processed successfully', {
          tenantId,
          campaignId,
          eventType: 'click',
          currentNodeId: nodeId,
          calendarClickId: calendarClickResult.latestClick!.id,
        });
      }

      return {
        success: true,
        reason: 'calendar_click_found',
        calendarClickId: calendarClickResult.latestClick!.id,
      };
    } catch (error) {
      logger.error('[CampaignExecutionWorker] Error in calendar click validation', {
        tenantId,
        campaignId,
        nodeId,
        messageId,
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null; // On error, proceed with normal no_click timeout
    }
  }
}
