import { logger } from '@/libs/logger';
import {
  scheduledActionRepository,
  contactCampaignRepository,
  campaignTransitionRepository,
} from '@/repositories';
import type { ContactCampaign } from '@/db/schema';
import { CampaignExecutionPublisher } from '@/modules/messages';
import type { ScheduledAction } from '@/db/schema';
import { getQueue } from '@/libs/bullmq';
import type {
  ProcessTransitionParams,
  TransitionResult,
  NextActionResult,
} from '@/types/campaign-transition.types';
import type {
  CampaignPlanOutput,
  CampaignPlanNode,
} from '../ai/schemas/contactCampaignStrategySchema';
import { calculateScheduleTime, parseIsoDuration, applyQuietHours } from './scheduleUtils';

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

      const campaignPlan = existingCampaign.planJson as CampaignPlanOutput;

      // Initialize campaign execution using the service
      const scheduledActionId = await this.initializeCampaignExecution({
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

        // Update the corresponding scheduled action with the job ID
        if (scheduledActionId) {
          try {
            await scheduledActionRepository.updateByIdForTenant(scheduledActionId, tenantId, {
              bullmqJobId: job.id,
            });

            logger.info('Scheduled action updated with job ID', {
              tenantId,
              scheduledActionId,
              jobId: job.id,
              campaignId: existingCampaign.id,
              nodeId: startNode.id,
            });
          } catch (updateError) {
            logger.error('Failed to update scheduled action with job ID', {
              tenantId,
              scheduledActionId,
              jobId: job.id,
              error: updateError instanceof Error ? updateError.message : 'Unknown error',
            });
            // Don't throw here - the job was published successfully, just log the update failure
          }
        }

        logger.info('Node execution job queued', {
          tenantId,
          campaignId: existingCampaign.id,
          nodeId: startNode.id,
          jobId: job.id,
          scheduledActionId,
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
   * @returns The ID of the created scheduled action, or null if no action was scheduled
   */
  async initializeCampaignExecution(context: CampaignExecutionContext): Promise<string | null> {
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

      let scheduledActionId: string | null = null;

      // Only initialize if the start node is a send action
      if (startNode.action === 'send') {
        const scheduledAt = calculateScheduleTime(
          startNode.schedule?.delay || 'PT0S',
          plan.timezone,
          plan.quietHours
        );

        // Create initial scheduled action
        const scheduledAction = await this.scheduleAction({
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

        scheduledActionId = scheduledAction.id;

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
          scheduledActionId,
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

      return scheduledActionId;
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
  async scheduleAction(params: ScheduleActionParams): Promise<ScheduledAction> {
    const { tenantId, campaignId, nodeId, actionType, scheduledAt, payload } = params;

    try {
      const scheduledAction = await scheduledActionRepository.createForTenant(tenantId, {
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
        scheduledActionId: scheduledAction.id,
      });

      return scheduledAction;
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
  async processTransition(params: ProcessTransitionParams): Promise<TransitionResult> {
    const { tenantId, campaignId, eventType, currentNodeId, plan, eventRef } = params;

    logger.info('Processing campaign transition', {
      tenantId,
      campaignId,
      eventType,
      currentNodeId,
    });

    // Find current node in plan
    const currentNode = plan.nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) {
      throw new Error(`Current node not found in plan: ${currentNodeId}`);
    }

    // Find matching transitions by event type first
    const candidateTransitions = currentNode.transitions?.filter((t) => t.on === eventType) || [];

    if (candidateTransitions.length === 0) {
      logger.debug('No transitions found for event type', {
        currentNodeId,
        eventType,
        availableTransitions: currentNode.transitions?.map((t) => ({ on: t.on, to: t.to })),
      });
      return {
        success: false,
        reason: 'no_matching_transition',
        availableTransitions: currentNode.transitions?.length || 0,
      };
    }

    // Validate timing constraints for each candidate transition
    let transition = null;
    for (const candidate of candidateTransitions) {
      const isValid = await this.isTransitionValid(
        candidate,
        tenantId,
        campaignId,
        currentNodeId,
        new Date(),
        eventRef
      );

      if (isValid) {
        transition = candidate;
        break; // Use first valid transition
      }
    }

    if (!transition) {
      logger.debug('No valid transitions found (timing constraints not met)', {
        currentNodeId,
        eventType,
        candidateCount: candidateTransitions.length,
        availableTransitions: currentNode.transitions?.map((t) => ({ on: t.on, to: t.to })),
      });
      return {
        success: false,
        reason: 'timing_constraints_not_met',
        availableTransitions: candidateTransitions.length,
      };
    }

    logger.info('Found matching transition', {
      from: currentNodeId,
      to: transition.to,
      trigger: eventType,
    });

    // Update campaign state
    await contactCampaignRepository.updateByIdForTenant(campaignId, tenantId, {
      currentNodeId: transition.to,
      updatedAt: new Date(),
    });

    // Record transition for audit
    const transitionRecord = await campaignTransitionRepository.createForTenant(tenantId, {
      campaignId,
      fromStatus: null, // Node IDs are not campaign statuses
      toStatus: 'active', // Assume active unless it's a stop action
      reason: `Event: ${eventType} - transition from ${currentNodeId} to ${transition.to}`,
      occurredAt: new Date(),
    });

    // Schedule next action if target node requires it
    const nextActionResult = await this.scheduleNextAction(
      tenantId,
      campaignId,
      transition.to,
      plan
    );

    const result: TransitionResult = {
      success: true,
      fromNodeId: currentNodeId,
      toNodeId: transition.to,
      eventType,
      transitionId: transitionRecord.id,
      nextAction: nextActionResult,
    };

    logger.info('Campaign transition completed successfully', result);
    return result;
  }

  /**
   * Schedules the next action based on the target node
   */
  private async scheduleNextAction(
    tenantId: string,
    campaignId: string,
    nodeId: string,
    plan: CampaignPlanOutput
  ): Promise<NextActionResult> {
    const node = plan.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return { scheduled: false, reason: 'node_not_found' };
    }

    logger.debug('Evaluating next action for node', {
      nodeId,
      action: node.action,
      channel: node.channel,
    });

    if (node.action === 'send') {
      return await this.scheduleSendAction(tenantId, campaignId, nodeId, node, plan);
    } else if (node.action === 'wait') {
      return await this.scheduleWaitAction(tenantId, campaignId, nodeId, node, plan);
    } else if (node.action === 'stop') {
      // Mark campaign as completed
      await contactCampaignRepository.updateByIdForTenant(campaignId, tenantId, {
        status: 'completed',
        completedAt: new Date(),
      });
      return { scheduled: false, reason: 'campaign_completed' };
    }

    return { scheduled: false, reason: 'unknown_action_type' };
  }

  /**
   * Schedules a send action
   */
  private async scheduleSendAction(
    tenantId: string,
    campaignId: string,
    nodeId: string,
    node: CampaignPlanNode,
    plan: CampaignPlanOutput
  ): Promise<NextActionResult> {
    // Type guard to ensure this is a send node
    if (node.action !== 'send') {
      throw new Error(`Expected send node, got ${node.action}`);
    }

    // Calculate delay from node schedule
    const delay = this.calculateDelay(node.schedule?.delay || 'PT0S');
    const scheduledAt = new Date(Date.now() + delay);

    // Apply quiet hours if configured
    const adjustedTime = this.applyQuietHours(scheduledAt, plan.timezone, plan.quietHours);

    // Create scheduled action
    const scheduledAction = await scheduledActionRepository.createForTenant(tenantId, {
      campaignId,
      actionType: 'send',
      scheduledAt: adjustedTime,
      status: 'pending',
      payload: {
        nodeId,
        subject: node.subject,
        body: node.body,
        channel: node.channel,
      },
    });

    // Enqueue execution job
    const executionQueue = getQueue('campaign_execution');
    await executionQueue.add(
      'execute',
      {
        tenantId,
        campaignId,
        nodeId,
        actionType: 'send',
        metadata: {
          triggeredBy: 'transition',
          originalScheduledAt: scheduledAt.toISOString(),
          adjustedScheduledAt: adjustedTime.toISOString(),
        },
      },
      {
        delay: Math.max(0, adjustedTime.getTime() - Date.now()),
        jobId: `send:${campaignId}:${nodeId}:${Date.now()}`,
      }
    );

    logger.info('Send action scheduled', {
      campaignId,
      nodeId,
      scheduledAt: adjustedTime.toISOString(),
      delay: delay,
    });

    return {
      scheduled: true,
      actionType: 'send',
      scheduledAt: adjustedTime,
      scheduledActionId: scheduledAction.id,
    };
  }

  /**
   * Schedules a wait action
   */
  private async scheduleWaitAction(
    tenantId: string,
    campaignId: string,
    nodeId: string,
    node: CampaignPlanNode,
    plan: CampaignPlanOutput
  ): Promise<NextActionResult> {
    // Wait nodes don't schedule immediate actions
    // They rely on future events (timeouts or real events) to trigger transitions
    logger.info('Entered wait state', { campaignId, nodeId });

    // Schedule timeout actions for this node
    await this.scheduleNodeTimeouts(tenantId, campaignId, node, plan);

    return {
      scheduled: false,
      reason: 'wait_state',
      nodeId,
    };
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
   * Gets the start time of the current node by finding the most recent transition to it
   */
  private async getCurrentNodeStartTime(
    tenantId: string,
    campaignId: string,
    nodeId: string
  ): Promise<Date | null> {
    try {
      // Get the most recent transition that resulted in entering this node
      const transitions = await campaignTransitionRepository.listByCampaignForTenant(
        tenantId,
        campaignId
      );

      // Find the most recent transition where the reason indicates entering this node
      // or if this is the start node, use the campaign start time
      const nodeEntryTransition = transitions.find((t) => t.reason?.includes(`to ${nodeId}`));

      if (nodeEntryTransition) {
        return nodeEntryTransition.occurredAt;
      }

      // If no transition found, this might be the start node
      // Get campaign start time as fallback
      const campaign = await contactCampaignRepository.findByIdForTenant(campaignId, tenantId);
      return campaign?.startedAt || null;
    } catch (error) {
      logger.error('Failed to get current node start time', {
        tenantId,
        campaignId,
        nodeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Validates if a transition is valid based on timing constraints
   */
  private async isTransitionValid(
    transition: any,
    tenantId: string,
    campaignId: string,
    currentNodeId: string,
    eventTime: Date = new Date(),
    _eventRef?: string
  ): Promise<boolean> {
    try {
      // Get when the current node was entered
      const nodeStartTime = await this.getCurrentNodeStartTime(tenantId, campaignId, currentNodeId);

      if (!nodeStartTime) {
        logger.warn('Could not determine node start time, allowing transition', {
          tenantId,
          campaignId,
          currentNodeId,
        });
        return true; // Allow transition if we can't determine start time
      }

      const timeSinceNodeStart = eventTime.getTime() - nodeStartTime.getTime();

      // Check 'within' constraint - event must happen within specified timeframe
      if (transition.within) {
        const withinMs = this.calculateDelay(transition.within);
        if (timeSinceNodeStart > withinMs) {
          logger.debug('Transition rejected: outside within constraint', {
            currentNodeId,
            within: transition.within,
            timeSinceNodeStart,
            withinMs,
            nodeStartTime: nodeStartTime.toISOString(),
            eventTime: eventTime.toISOString(),
          });
          return false;
        }
        logger.debug('Transition within constraint satisfied', {
          within: transition.within,
          timeSinceNodeStart,
          withinMs,
        });
      }

      // Check 'after' constraint - event must happen after specified delay
      if (transition.after) {
        const afterMs = this.calculateDelay(transition.after);
        if (timeSinceNodeStart < afterMs) {
          logger.debug('Transition rejected: before after constraint', {
            currentNodeId,
            after: transition.after,
            timeSinceNodeStart,
            afterMs,
            nodeStartTime: nodeStartTime.toISOString(),
            eventTime: eventTime.toISOString(),
          });
          return false;
        }
        logger.debug('Transition after constraint satisfied', {
          after: transition.after,
          timeSinceNodeStart,
          afterMs,
        });
      }

      return true;
    } catch (error) {
      logger.error('Error validating transition timing', {
        tenantId,
        campaignId,
        currentNodeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return true; // Allow transition on validation error to prevent system lockup
    }
  }

  /**
   * Calculates delay in milliseconds from ISO 8601 duration
   */
  private calculateDelay(duration: string): number {
    // Parse ISO 8601 duration (PT0S, PT1H, PT24H, etc.)
    return parseIsoDuration(duration);
  }

  /**
   * Applies quiet hours to a scheduled time
   */
  private applyQuietHours(
    scheduledAt: Date,
    timezone?: string,
    quietHours?: { start: string; end: string }
  ): Date {
    if (!quietHours || !timezone) {
      return scheduledAt;
    }

    // Use the existing utility function
    return applyQuietHours(scheduledAt, timezone, quietHours);
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
