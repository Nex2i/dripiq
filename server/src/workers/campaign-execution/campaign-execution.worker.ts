import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';
import {
  contactCampaignRepository,
  leadPointOfContactRepository,
  messageEventRepository,
} from '@/repositories';
import type { CampaignExecutionJobPayload } from '@/modules/messages/campaignExecution.publisher.service';
import type { TimeoutJobPayload } from '@/types/timeout.types';
import { campaignPlanExecutionService } from '@/modules/campaign/campaignPlanExecution.service';
import { EmailExecutionService } from './email-execution.service';

export type CampaignExecutionJobResult = {
  success: boolean;
  nodeId: string;
  campaignId: string;
  contactId: string;
  actionType: string;
  error?: string;
};

export interface TimeoutJobResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  syntheticEventId?: string;
}

async function processCampaignExecution(
  job: Job<CampaignExecutionJobPayload>
): Promise<CampaignExecutionJobResult> {
  const { tenantId, campaignId, contactId, nodeId, actionType, metadata } = job.data;

  try {
    // Initialize email execution service with tenantId
    const emailExecutionService = new EmailExecutionService(tenantId);
    logger.info('[CampaignExecutionWorker] Processing campaign node execution', {
      jobId: job.id,
      tenantId,
      campaignId,
      contactId,
      nodeId,
      actionType,
      triggeredBy: metadata?.triggeredBy,
    });

    // Fetch campaign data to get the plan and node details
    const campaign = await contactCampaignRepository.findByIdForTenant(campaignId, tenantId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const campaignPlan = campaign.planJson as any;
    if (!campaignPlan) {
      throw new Error(`Campaign plan not found for campaign: ${campaignId}`);
    }

    // Find the specific node in the plan
    const node = campaignPlan.nodes?.find((n: any) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found in campaign plan: ${nodeId}`);
    }

    // Fetch contact information if needed
    const contact = await leadPointOfContactRepository.findById(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    // Log the fetched node data for verification
    logger.info('[CampaignExecutionWorker] Node data fetched', {
      jobId: job.id,
      nodeId,
      actionType,
      nodeDetails: {
        action: node.action,
        subject: node.subject,
        body: node.body ? `${node.body.substring(0, 100)}...` : undefined, // Log truncated body
        channel: node.channel,
        schedule: node.schedule,
      },
      contactEmail: contact.email,
      contactName: contact.name,
    });

    // Process based on action type with fetched data
    switch (actionType) {
      case 'send':
        if (node.channel === 'email') {
          logger.info('[CampaignExecutionWorker] Executing email send', {
            jobId: job.id,
            nodeId,
            subject: node.subject,
            contactEmail: contact.email,
            contactName: contact.name,
          });

          const emailResult = await emailExecutionService.executeEmailSend({
            tenantId,
            campaignId,
            contactId,
            nodeId,
            node,
            contact,
            campaign,
            planJson: campaignPlan,
          });

          if (!emailResult.success) {
            throw new Error(`Email send failed: ${emailResult.error}`);
          }

          logger.info('[CampaignExecutionWorker] Email sent successfully', {
            jobId: job.id,
            nodeId,
            outboundMessageId: emailResult.outboundMessageId,
            providerMessageId: emailResult.providerMessageId,
          });
        } else {
          logger.info('[CampaignExecutionWorker] Would send message (non-email channel)', {
            jobId: job.id,
            nodeId,
            channel: node.channel,
            contactEmail: contact.email,
            contactName: contact.name,
          });
        }
        break;

      case 'wait':
        logger.info('[CampaignExecutionWorker] Would wait for event', {
          jobId: job.id,
          nodeId,
          eventTypes: node.transitions?.map((t: any) => t.on) || [],
          contactId,
        });
        break;

      case 'timeout':
        logger.info('[CampaignExecutionWorker] Would process timeout', {
          jobId: job.id,
          nodeId,
          timeoutTransitions: node.transitions?.filter((t: any) => t.on.startsWith('no_')) || [],
          contactId,
        });
        break;

      default:
        logger.warn('[CampaignExecutionWorker] Unknown action type', {
          jobId: job.id,
          nodeId,
          actionType,
        });
    }

    logger.info('[CampaignExecutionWorker] Node execution completed successfully', {
      jobId: job.id,
      tenantId,
      campaignId,
      contactId,
      nodeId,
      actionType,
    });

    return {
      success: true,
      nodeId,
      campaignId,
      contactId,
      actionType,
    };
  } catch (error) {
    logger.error('[CampaignExecutionWorker] Node execution failed', {
      jobId: job.id,
      tenantId,
      campaignId,
      contactId,
      nodeId,
      actionType,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      nodeId,
      campaignId,
      contactId,
      actionType,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function processTimeout(job: Job<TimeoutJobPayload>): Promise<TimeoutJobResult> {
  const { campaignId, nodeId, messageId, eventType, tenantId } = job.data;

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
    // Get the campaign to access the plan and current node
    const campaign = await contactCampaignRepository.findByIdForTenant(campaignId, tenantId);

    if (campaign && campaign.planJson && campaign.currentNodeId) {
      const campaignPlan = campaign.planJson as any;

      await campaignPlanExecutionService.processTransition({
        tenantId,
        campaignId,
        eventType,
        currentNodeId: campaign.currentNodeId,
        plan: campaignPlan,
        eventRef: syntheticEvent.id,
      });

      logger.info('[CampaignExecutionWorker] Campaign transition processed successfully', {
        tenantId,
        campaignId,
        eventType,
        currentNodeId: campaign.currentNodeId,
        messageEventId: syntheticEvent.id,
        jobId: job.id,
      });
    } else {
      logger.warn(
        '[CampaignExecutionWorker] Could not process campaign transition - missing campaign data',
        {
          tenantId,
          campaignId,
          campaignExists: !!campaign,
          hasPlan: !!campaign?.planJson,
          hasCurrentNode: !!campaign?.currentNodeId,
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

const campaignExecutionWorker = getWorker<
  CampaignExecutionJobPayload | TimeoutJobPayload,
  CampaignExecutionJobResult | TimeoutJobResult
>(
  QUEUE_NAMES.campaign_execution,
  async (job: Job<CampaignExecutionJobPayload | TimeoutJobPayload>) => {
    if (job.name === JOB_NAMES.campaign_execution.initialize) {
      return processCampaignExecution(job as Job<CampaignExecutionJobPayload>);
    } else if (job.name === JOB_NAMES.campaign_execution.timeout) {
      return processTimeout(job as Job<TimeoutJobPayload>);
    } else {
      logger.warn('[CampaignExecutionWorker] Skipping unexpected job name', {
        jobId: job.id,
        jobName: job.name,
        expectedNames: [
          JOB_NAMES.campaign_execution.initialize,
          JOB_NAMES.campaign_execution.timeout,
        ],
      });
      return {
        success: false,
        error: `Unexpected job name: ${job.name}`,
      };
    }
  }
);

export default campaignExecutionWorker;
