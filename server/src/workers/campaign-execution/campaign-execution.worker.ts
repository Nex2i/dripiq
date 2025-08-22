import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';
import { contactCampaignRepository, leadPointOfContactRepository } from '@/repositories';
import type { CampaignExecutionJobPayload } from '@/modules/messages/campaignExecution.publisher.service';
import type { TimeoutJobParams } from '@/types/timeout.types';
import { processTimeout } from '@/workers/timeout/timeout.worker';
import { EmailExecutionService } from './email-execution.service';

export type CampaignExecutionJobResult = {
  success: boolean;
  nodeId: string;
  campaignId: string;
  contactId: string;
  actionType: string;
  error?: string;
};

async function processJob(job: Job<any>): Promise<any> {
  // Route timeout jobs
  if (job.name === 'timeout') {
    return await processTimeout(job as Job<TimeoutJobParams>);
  }

  // Route initialize/execute jobs
  if (job.name === JOB_NAMES.campaign_execution.initialize) {
    return await processCampaignExecution(job as Job<CampaignExecutionJobPayload>);
  }

  logger.warn('[CampaignExecutionWorker] Skipping unexpected job name', {
    jobId: job.id,
    jobName: job.name,
  });
  return {
    success: false,
    nodeId: (job.data && job.data.nodeId) || 'unknown',
    campaignId: (job.data && job.data.campaignId) || 'unknown',
    contactId: (job.data && job.data.contactId) || 'unknown',
    actionType: (job.data && job.data.actionType) || 'unknown',
    error: 'Unexpected job name',
  };
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

const campaignExecutionWorker = getWorker<CampaignExecutionJobPayload, CampaignExecutionJobResult>(
  QUEUE_NAMES.campaign_execution,
  async (job: Job<any>) => processJob(job)
);

export default campaignExecutionWorker;
