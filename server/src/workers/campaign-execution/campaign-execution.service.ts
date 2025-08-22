import type { Job } from 'bullmq';
import { logger } from '@/libs/logger';
import { contactCampaignRepository, leadPointOfContactRepository } from '@/repositories';
import type { CampaignExecutionJobPayload } from '@/modules/messages/campaignExecution.publisher.service';
import {
  CampaignPlanNode,
  CampaignPlanOutput,
} from '@/modules/ai/schemas/contactCampaignStrategySchema';
import { EmailExecutionService } from './email-execution.service';

export type CampaignExecutionJobResult = {
  success: boolean;
  nodeId: string;
  campaignId: string;
  contactId: string;
  actionType: string;
  error?: string;
};

export class CampaignExecutionService {
  async processCampaignExecution(
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

      const campaignPlan = campaign.planJson as CampaignPlanOutput;
      if (!campaignPlan) {
        throw new Error(`Campaign plan not found for campaign: ${campaignId}`);
      }

      // Find the specific node in the plan
      const node = campaignPlan.nodes?.find(
        (n: CampaignPlanNode) => n.id === nodeId
      ) as CampaignPlanNode;
      if (!node) {
        throw new Error(`Node not found in campaign plan: ${nodeId}`);
      }

      // Fetch contact information if needed
      const contact = await leadPointOfContactRepository.findById(contactId);
      if (!contact) {
        throw new Error(`Contact not found: ${contactId}`);
      }

      // Log the fetched node data for verification
      const nodeDetails =
        node.action === 'send'
          ? {
              action: node.action,
              channel: node.channel,
              subject: node.subject ?? undefined,
              body: node.body ? `${node.body.substring(0, 100)}...` : undefined,
              schedule: node.schedule, // always present on send (after .catch default)
            }
          : {
              action: node.action,
              channel: node.channel,
            };

      logger.info('[CampaignExecutionWorker] Node data fetched', {
        jobId: job.id,
        nodeId,
        actionType,
        nodeDetails,
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
              subject: nodeDetails.subject,
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
}
