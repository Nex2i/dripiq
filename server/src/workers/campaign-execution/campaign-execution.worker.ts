import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';
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
  const { tenantId, campaignId, contactId, nodeId, actionType, nodeData, metadata } = job.data;

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

    // Log the node data received for verification
    logger.info('[CampaignExecutionWorker] Node data received', {
      jobId: job.id,
      nodeId,
      actionType,
      nodeData: {
        subject: nodeData?.subject,
        body: nodeData?.body ? `${nodeData.body.substring(0, 100)}...` : undefined, // Log truncated body
        channel: nodeData?.channel,
        eventType: nodeData?.eventType,
        targetNodeId: nodeData?.targetNodeId,
      },
      metadata,
    });

    // For now, just log the execution based on action type
    switch (actionType) {
      case 'send':
        logger.info('[CampaignExecutionWorker] Would send message', {
          jobId: job.id,
          nodeId,
          subject: nodeData?.subject,
          channel: nodeData?.channel,
          contactId,
        });
        break;

      case 'wait':
        logger.info('[CampaignExecutionWorker] Would wait for event', {
          jobId: job.id,
          nodeId,
          eventType: nodeData?.eventType,
          contactId,
        });
        break;

      case 'timeout':
        logger.info('[CampaignExecutionWorker] Would process timeout', {
          jobId: job.id,
          nodeId,
          eventType: nodeData?.eventType,
          targetNodeId: nodeData?.targetNodeId,
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
