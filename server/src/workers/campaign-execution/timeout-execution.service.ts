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
        // Get campaign details for calendar click validation
        const campaign = await contactCampaignRepository.findByIdForTenant(campaignId, tenantId);

        if (campaign) {
          // Check for calendar clicks since this node started
          // Use the campaign execution service to get the proper node start time
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
            // If we can't determine when the node started, skip calendar validation
            // and proceed with normal no_click timeout
          } else {
            // Check for any calendar clicks since the node started
            const timeSinceNodeStart = new Date().getTime() - nodeStartTime.getTime();

            const calendarClickResult =
              await calendarClickValidationService.hasCalendarClicksInWindow({
                tenantId,
                campaignId,
                contactId: campaign.contactId,
                leadId: campaign.leadId,
                timeWindowMs: timeSinceNodeStart,
                referenceTime: new Date(),
              });

            if (calendarClickResult.hasClicks) {
              logger.info(
                '[CampaignExecutionWorker] Calendar clicks found, triggering click transition instead of no_click',
                {
                  messageId,
                  eventType,
                  campaignId,
                  contactId: campaign.contactId,
                  leadId: campaign.leadId,
                  clickCount: calendarClickResult.clickCount,
                  latestClickId: calendarClickResult.latestClick?.id,
                  jobId: job.id,
                }
              );

              // Create a synthetic click event instead of no_click
              const syntheticClickEvent = await messageEventRepository.createForTenant(tenantId, {
                messageId,
                type: 'click',
                eventAt: new Date(),
                data: {
                  synthetic: true,
                  triggeredBy: 'calendar_click_validation',
                  originalJobId: job.id?.toString(),
                  calendarClickId: calendarClickResult.latestClick?.id,
                  calendarClickCount: calendarClickResult.clickCount,
                  scheduledAt: job.opts?.delay
                    ? new Date(Date.now() - (job.opts.delay as number))
                    : new Date(),
                  actualFiredAt: new Date(),
                },
              });

              logger.info(
                '[CampaignExecutionWorker] Created synthetic click event from calendar validation',
                {
                  eventId: syntheticClickEvent.id,
                  eventType: 'click',
                  messageId,
                  calendarClickId: calendarClickResult.latestClick?.id,
                  jobId: job.id,
                }
              );

              // Trigger campaign transition with click event instead of no_click
              if (campaign.planJson) {
                const campaignPlan = campaign.planJson as CampaignPlanOutput;

                await campaignPlanExecutionService.processTransition({
                  tenantId,
                  campaignId,
                  contactId: campaign.contactId,
                  leadId: campaign.leadId,
                  eventType: 'click', // Use click instead of no_click
                  currentNodeId: nodeId,
                  plan: campaignPlan,
                  eventRef: syntheticClickEvent.id,
                });

                logger.info(
                  '[CampaignExecutionWorker] Campaign click transition processed successfully',
                  {
                    tenantId,
                    campaignId,
                    eventType: 'click',
                    currentNodeId: nodeId,
                  }
                );
              }

              return {
                success: true,
                syntheticEventId: syntheticClickEvent.id,
                reason: 'calendar_click_found',
              };
            } else {
              logger.debug(
                '[CampaignExecutionWorker] No calendar clicks found, proceeding with no_click timeout',
                {
                  messageId,
                  eventType,
                  campaignId,
                  contactId: campaign.contactId,
                  leadId: campaign.leadId,
                  nodeStartTime: nodeStartTime.toISOString(),
                  timeSinceNodeStart,
                  jobId: job.id,
                }
              );
            }
          }
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
}
