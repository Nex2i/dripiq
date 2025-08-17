import { logger } from '@/libs/logger';
import {
  scheduledActionRepository,
  contactCampaignRepository,
  campaignTransitionRepository,
} from '@/repositories';
import type { ContactCampaign } from '@/db/schema';
import { CampaignExecutionPublisher } from '@/modules/messages';
import type {
  CampaignPlanOutput,
  CampaignPlanNode,
} from '../ai/schemas/contactCampaignStrategySchema';
import { calculateScheduleTime } from './scheduleUtils';

export interface CampaignExecutionContext {
  tenantId: string;
  campaignId: string;
  contactId: string;
  plan: CampaignPlanOutput;
}

export interface ScheduleActionParams {
  tenantId: string;
  campaignId: string;
  nodeId: string;
  actionType: 'send' | 'timeout' | 'wait';
  scheduledAt: Date;
  payload?: Record<string, any>;
}

export interface ProcessTransitionParams {
  tenantId: string;
  campaignId: string;
  eventType: string;
  currentNodeId: string;
  plan: CampaignPlanOutput;
  eventRef?: string;
}

/**
 * Service responsible for materializing campaign plans into executable database records.
 * Bridges the gap between AI-generated JSON plans and the BullMQ execution workflow.
 */
export class CampaignPlanExecutionService {
  /**
   * Handles campaign execution when a contact is manually reviewed.
   * Checks for existing campaigns and initializes execution if appropriate.
   */
  async handleManuallyReviewedExecution(
    tenantId: string,
    contactId: string,
    leadId: string
  ): Promise<void> {
    try {
      logger.info('Processing manually reviewed contact for campaign execution', {
        tenantId,
        contactId,
        leadId,
      });

      // Check if there's an existing campaign for this contact (default to email channel)
      const existingCampaign = await contactCampaignRepository.findByContactAndChannelForTenant(
        tenantId,
        contactId,
        'email'
      );

      if (!existingCampaign || !existingCampaign.planJson) {
        logger.info('No existing campaign found for manually reviewed contact', {
          tenantId,
          leadId,
          contactId,
        });
        return;
      }

      // Check if campaign is already active to prevent duplicate execution
      if (existingCampaign.status !== 'draft') {
        logger.info('Campaign already initialized, skipping execution', {
          tenantId,
          leadId,
          contactId,
          campaignId: existingCampaign.id,
          currentStatus: existingCampaign.status,
        });
        return;
      }

      logger.info('Found existing campaign for manually reviewed contact, initializing execution', {
        tenantId,
        leadId,
        contactId,
        campaignId: existingCampaign.id,
        status: existingCampaign.status,
      });

      const campaignPlan = existingCampaign.planJson as any; // Cast from jsonb to CampaignPlanOutput

      // Initialize campaign execution using the service
      await this.initializeCampaignExecution({
        tenantId,
        campaignId: existingCampaign.id,
        contactId,
        plan: campaignPlan,
      });

      // Find the start node to publish specific execution message
      const startNode = campaignPlan.nodes.find(
        (node: any) => node.id === campaignPlan.startNodeId
      );
      if (startNode && startNode.action === 'send') {
        // Publish queue message for the specific start node execution
        const job = await CampaignExecutionPublisher.publish({
          tenantId,
          campaignId: existingCampaign.id,
          contactId,
          nodeId: startNode.id,
          actionType: 'send',
          metadata: {
            triggeredBy: 'manual_review',
            leadId,
          },
        });

        // TODO: Update the corresponding scheduled action with the job ID
        // This will be implemented once we have the scheduled action ID available
        logger.info('Node execution job queued', {
          tenantId,
          campaignId: existingCampaign.id,
          nodeId: startNode.id,
          jobId: job.id,
        });
      }

      logger.info('Campaign execution initialized and node job published', {
        tenantId,
        leadId,
        contactId,
        campaignId: existingCampaign.id,
      });
    } catch (error) {
      logger.error('Failed to handle manually reviewed campaign execution', {
        tenantId,
        contactId,
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Re-throw the error so the calling service can handle it appropriately
      throw error;
    }
  }

  /**
   * Initializes a campaign for execution by creating the first scheduled action
   * and updating campaign status to active.
   */
  async initializeCampaignExecution(context: CampaignExecutionContext): Promise<void> {
    const { tenantId, campaignId, plan } = context;

    try {
      logger.info('Initializing campaign execution', {
        tenantId,
        campaignId,
        startNodeId: plan.startNodeId,
      });

      // Find the start node
      const startNode = plan.nodes.find((node) => node.id === plan.startNodeId);
      if (!startNode) {
        throw new Error(`Start node ${plan.startNodeId} not found in campaign plan`);
      }

      // Only initialize if the start node is a send action
      if (startNode.action === 'send') {
        const scheduledAt = calculateScheduleTime(
          startNode.schedule?.delay || 'PT0S',
          plan.timezone,
          plan.quietHours
        );

        // Create initial scheduled action
        await this.scheduleAction({
          tenantId,
          campaignId,
          nodeId: startNode.id,
          actionType: 'send',
          scheduledAt,
          payload: {
            subject: startNode.subject,
            body: startNode.body,
            channel: startNode.channel,
          },
        });

        // Update campaign status to active
        await contactCampaignRepository.updateByIdForTenant(campaignId, tenantId, {
          status: 'active',
          startedAt: new Date(),
        });

        // Schedule timeout actions for this node if needed
        await this.scheduleNodeTimeouts(tenantId, campaignId, startNode, plan);

        logger.info('Campaign execution initialized successfully', {
          tenantId,
          campaignId,
          startNodeId: startNode.id,
          scheduledAt,
        });
      } else if (startNode.action === 'wait') {
        // For wait nodes, just update status and schedule timeouts
        await contactCampaignRepository.updateByIdForTenant(campaignId, tenantId, {
          status: 'active',
          startedAt: new Date(),
        });

        await this.scheduleNodeTimeouts(tenantId, campaignId, startNode, plan);

        logger.info('Campaign initialized with wait node', {
          tenantId,
          campaignId,
          startNodeId: startNode.id,
        });
      } else {
        logger.warn('Campaign start node is not actionable', {
          tenantId,
          campaignId,
          startNodeId: startNode.id,
          action: startNode.action,
        });
      }
    } catch (error) {
      logger.error('Failed to initialize campaign execution', {
        tenantId,
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Creates a scheduled action record for later execution by workers
   */
  async scheduleAction(params: ScheduleActionParams): Promise<void> {
    const { tenantId, campaignId, nodeId, actionType, scheduledAt, payload } = params;

    try {
      await scheduledActionRepository.createForTenant(tenantId, {
        campaignId,
        actionType,
        scheduledAt,
        status: 'pending',
        payload: {
          nodeId,
          ...payload,
        },
      });

      logger.debug('Scheduled action created', {
        tenantId,
        campaignId,
        nodeId,
        actionType,
        scheduledAt,
      });
    } catch (error) {
      logger.error('Failed to schedule action', {
        tenantId,
        campaignId,
        nodeId,
        actionType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Processes an event-driven transition in the campaign plan
   */
  async processTransition(params: ProcessTransitionParams): Promise<void> {
    const { tenantId, campaignId, eventType, currentNodeId, plan } = params;

    try {
      logger.info('Processing campaign transition', {
        tenantId,
        campaignId,
        eventType,
        currentNodeId,
      });

      // Find current node and matching transition
      const currentNode = plan.nodes.find((node) => node.id === currentNodeId);
      if (!currentNode) {
        logger.warn('Current node not found in plan', {
          tenantId,
          campaignId,
          currentNodeId,
        });
        return;
      }

      // Find matching transition for this event
      const transition = currentNode.transitions?.find((t) => t.on === eventType);
      if (!transition) {
        logger.debug('No transition found for event', {
          tenantId,
          campaignId,
          currentNodeId,
          eventType,
        });
        return;
      }

      // Find target node
      const targetNode = plan.nodes.find((node) => node.id === transition.to);
      if (!targetNode) {
        logger.error('Target node not found in plan', {
          tenantId,
          campaignId,
          targetNodeId: transition.to,
        });
        return;
      }

      // Record the transition
      await campaignTransitionRepository.createForTenant(tenantId, {
        campaignId,
        fromStatus: null, // We could map node IDs to statuses if needed
        toStatus: targetNode.action === 'stop' ? 'completed' : 'active',
        reason: `Event: ${eventType}`,
        occurredAt: new Date(),
      });

      // Update campaign current node
      await contactCampaignRepository.updateByIdForTenant(campaignId, tenantId, {
        currentNodeId: targetNode.id,
        ...(targetNode.action === 'stop' && {
          status: 'completed',
          completedAt: new Date(),
        }),
      });

      // Schedule next action if target node requires it
      if (targetNode.action === 'send') {
        const scheduledAt = calculateScheduleTime(
          targetNode.schedule?.delay || 'PT0S',
          plan.timezone,
          plan.quietHours
        );

        await this.scheduleAction({
          tenantId,
          campaignId,
          nodeId: targetNode.id,
          actionType: 'send',
          scheduledAt,
          payload: {
            subject: targetNode.subject,
            body: targetNode.body,
            channel: targetNode.channel,
          },
        });

        // Schedule timeouts for the new node
        await this.scheduleNodeTimeouts(tenantId, campaignId, targetNode, plan);
      } else if (targetNode.action === 'wait') {
        // Schedule timeouts for wait node
        await this.scheduleNodeTimeouts(tenantId, campaignId, targetNode, plan);
      }

      logger.info('Campaign transition processed successfully', {
        tenantId,
        campaignId,
        fromNode: currentNodeId,
        toNode: targetNode.id,
        eventType,
      });
    } catch (error) {
      logger.error('Failed to process campaign transition', {
        tenantId,
        campaignId,
        eventType,
        currentNodeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Schedules timeout actions for a node based on its transitions
   */
  private async scheduleNodeTimeouts(
    tenantId: string,
    campaignId: string,
    node: CampaignPlanNode,
    plan: CampaignPlanOutput
  ): Promise<void> {
    if (!node.transitions) return;

    for (const transition of node.transitions) {
      // Schedule synthetic timeout events (no_open, no_click, etc.)
      if (transition.on.startsWith('no_')) {
        const delay = 'after' in transition ? transition.after : transition.within;
        const scheduledAt = calculateScheduleTime(delay, plan.timezone, plan.quietHours);

        await this.scheduleAction({
          tenantId,
          campaignId,
          nodeId: node.id,
          actionType: 'timeout',
          scheduledAt,
          payload: {
            eventType: transition.on,
            targetNodeId: transition.to,
          },
        });
      }
    }
  }

  /**
   * Cancels all pending scheduled actions for a campaign
   */
  async cancelCampaignActions(tenantId: string, campaignId: string): Promise<void> {
    try {
      // This would require a method to find pending actions by campaign
      // and update their status to 'canceled'
      logger.info('Canceling campaign actions', { tenantId, campaignId });

      await scheduledActionRepository.cancelByCampaignForTenant(tenantId, campaignId);
    } catch (error) {
      logger.error('Failed to cancel campaign actions', {
        tenantId,
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Gets campaign execution status with current state
   */
  async getCampaignExecutionStatus(
    tenantId: string,
    campaignId: string
  ): Promise<{
    campaign: ContactCampaign | undefined;
    pendingActions: number;
    sentMessages: number;
    lastTransition?: Date;
  }> {
    try {
      const campaign = await contactCampaignRepository.findByIdForTenant(campaignId, tenantId);

      // TODO: Add methods to count related records
      // const pendingActions = await scheduledActionRepository.countPendingByCampaign(tenantId, campaignId);
      // const sentMessages = await outboundMessageRepository.countByCampaign(tenantId, campaignId);

      return {
        campaign,
        pendingActions: 0, // TODO: Implement count
        sentMessages: 0, // TODO: Implement count
        lastTransition: undefined, // TODO: Get from transitions
      };
    } catch (error) {
      logger.error('Failed to get campaign execution status', {
        tenantId,
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export const campaignPlanExecutionService = new CampaignPlanExecutionService();
