import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';
import { contactCampaignRepository, leadPointOfContactRepository } from '@/repositories';
import type { CampaignExecutionJobPayload } from '@/modules/messages/campaignExecution.publisher.service';

export type CampaignExecutionJobResult = {
  success: boolean;
  nodeId: string;
  campaignId: string;
  contactId: string;
  actionType: string;
  error?: string;
};

async function processCampaignExecution(
  job: Job<CampaignExecutionJobPayload>
): Promise<CampaignExecutionJobResult> {
  const { tenantId, campaignId, contactId, nodeId, actionType, metadata } = job.data;

  try {
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
        logger.info('[CampaignExecutionWorker] Would send message', {
          jobId: job.id,
          nodeId,
          subject: node.subject,
          channel: node.channel,
          contactEmail: contact.email,
          contactName: contact.name,
        });
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

const campaignExecutionWorker = getWorker<CampaignExecutionJobPayload, CampaignExecutionJobResult>(
  QUEUE_NAMES.campaign_execution,
  async (job: Job<CampaignExecutionJobPayload>) => {
    if (job.name !== JOB_NAMES.campaign_execution.initialize) {
      logger.warn('[CampaignExecutionWorker] Skipping unexpected job name', {
        jobId: job.id,
        jobName: job.name,
        expectedName: JOB_NAMES.campaign_execution.initialize,
      });
      return {
        success: false,
        nodeId: job.data.nodeId,
        campaignId: job.data.campaignId,
        contactId: job.data.contactId,
        actionType: job.data.actionType,
        error: 'Unexpected job name',
      };
    }

    return processCampaignExecution(job);
  }
);

export default campaignExecutionWorker;
