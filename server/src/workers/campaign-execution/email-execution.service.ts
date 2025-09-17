import { createHash } from 'crypto';
import { logger } from '@/libs/logger';
import {
  mailAccountRepository,
  outboundMessageRepository,
  scheduledActionRepository,
  userRepository,
  leadRepository,
} from '@/repositories';
import { unsubscribeService } from '@/modules/unsubscribe';
import { getQueue } from '@/libs/bullmq';
import { parseIsoDuration } from '@/modules/campaign/scheduleUtils';
import { db } from '@/db';
import {
  DEFAULT_NO_OPEN_TIMEOUT,
  DEFAULT_NO_CLICK_TIMEOUT,
  TIMEOUT_JOB_OPTIONS,
} from '@/constants/timeout-jobs';
import { EmailProcessor, type CampaignEmailData } from '@/modules/email';
import type { ContactCampaign, LeadPointOfContact, MailAccount } from '@/db/schema';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';
import type { TimeoutJobParams, TimeoutJobPayload } from '@/types/timeout.types';
import { JOB_NAMES } from '@/constants/queues';
import { CAMPAIGN_EVENT_TYPES, TIMEOUT_EVENT_TYPES } from '@/constants/campaign-events';

// Type for timeout events (imported from constants)
type TimeoutEventType = (typeof TIMEOUT_EVENT_TYPES)[number];

export interface EmailExecutionParams {
  tenantId: string;
  campaignId: string;
  contactId: string;
  nodeId: string;
  node: {
    subject?: string;
    body?: string;
    channel: string;
    [key: string]: any;
  };
  contact: LeadPointOfContact;
  campaign: ContactCampaign;
  planJson?: CampaignPlanOutput;
  mailAccount?: MailAccount;
}

export interface EmailExecutionResult {
  success: boolean;
  outboundMessageId?: string;
  providerMessageId?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

export class EmailExecutionService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async executeEmailSend(params: EmailExecutionParams): Promise<EmailExecutionResult> {
    const { tenantId, campaignId, contactId, nodeId, node, contact } = params;

    try {
      // Validate that this is an email channel
      if (node.channel !== 'email') {
        throw new Error(`Invalid channel for email execution: ${node.channel}`);
      }

      // Validate required email content
      if (!node.subject || !node.body) {
        throw new Error('Email subject and body are required');
      }

      if (!contact.email) {
        throw new Error('Contact email is required');
      }

      // CHECK UNSUBSCRIBE STATUS FIRST
      const isUnsubscribed = await unsubscribeService.isChannelUnsubscribed(
        tenantId,
        'email',
        contact.email.toLowerCase()
      );

      if (isUnsubscribed) {
        logger.info('[EmailExecutionService] Skipping email send - contact unsubscribed', {
          tenantId,
          campaignId,
          contactId,
          nodeId,
          email: contact.email,
        });

        return {
          success: false,
          error: 'Contact has unsubscribed from emails',
          skipped: true,
          skipReason: 'unsubscribed',
        };
      }

      const lead = await leadRepository.findByIdForTenant(contact.leadId, tenantId);

      if (!lead.ownerId) {
        logger.error('[EmailExecutionService] User ID not found for campaign execution', {
          tenantId,
          campaignId,
          contactId,
          nodeId,
          leadId: contact.leadId,
        });
        throw new Error('User ID not found for campaign execution');
      }
      const mailAccount =
        params.mailAccount || (await this.getActiveMailAccountByLeadId(tenantId, contact.leadId));
      const senderEmail = mailAccount.primaryEmail;
      const senderName = mailAccount.displayName || undefined;
      logger.info('[EmailExecutionService] Using primary mail account for send', {
        tenantId,
        campaignId,
        contactId,
        nodeId,
        mailAccountId: mailAccount.id,
        senderEmail,
      });

      // Generate dedupe key
      const dedupeKey = this.buildDedupeKey(params);

      // Check if message already exists (idempotency)
      const existingMessage = await outboundMessageRepository.findByDedupeKeyForTenant(
        tenantId,
        dedupeKey
      );

      if (existingMessage) {
        logger.info('[EmailExecutionService] Message already exists, skipping send', {
          tenantId,
          campaignId,
          contactId,
          nodeId,
          existingMessageId: existingMessage.id,
          dedupeKey,
        });

        return {
          success: existingMessage.state === 'sent',
          outboundMessageId: existingMessage.id,
          providerMessageId: existingMessage.providerMessageId || undefined,
          error:
            existingMessage.state === 'failed'
              ? existingMessage.lastError || 'Send failed'
              : undefined,
        };
      }

      // Fetch calendar information if available
      let calendarInfo: CampaignEmailData['calendarInfo'];
      const userId = lead.ownerId;

      const user = await userRepository.findById(lead.ownerId);
      if (userId) {
        if (user?.calendarLink && user?.calendarTieIn) {
          calendarInfo = {
            calendarLink: user.calendarLink,
            calendarTieIn: user.calendarTieIn,
            leadId: lead.id,
          };
        }
      }

      // Prepare data for EmailProcessor
      const emailData: CampaignEmailData = {
        tenantId,
        campaignId,
        contactId,
        nodeId,
        subject: node.subject,
        body: node.body,
        recipientEmail: contact.email,
        recipientName: contact.name,
        senderEmail,
        senderName,
        calendarInfo,
        dedupeKey,
        categories: ['campaign'],
        skipMessageRecord: false,
        skipTimeoutScheduling: false,
      };

      // Send email using EmailProcessor
      const result = await EmailProcessor.sendCampaignEmail(userId, emailData);

      if (!result.success) {
        throw new Error(result.error);
      }

      logger.info('[EmailExecutionService] Email sent successfully via EmailProcessor', {
        tenantId,
        campaignId,
        contactId,
        nodeId,
        outboundMessageId: result.outboundMessageId,
        providerMessageId: result.providerMessageId,
      });

      // Schedule timeout jobs after successful send
      if (params.planJson && result.outboundMessageId) {
        try {
          await this.scheduleTimeoutJobs(
            campaignId,
            nodeId,
            params.planJson,
            result.outboundMessageId
          );
          logger.info('[EmailExecutionService] Timeout jobs scheduled successfully', {
            tenantId,
            campaignId,
            nodeId,
            outboundMessageId: result.outboundMessageId,
          });
        } catch (timeoutError) {
          logger.error('[EmailExecutionService] Failed to schedule timeout jobs', {
            tenantId,
            campaignId,
            nodeId,
            outboundMessageId: result.outboundMessageId,
            error: timeoutError instanceof Error ? timeoutError.message : 'Unknown error',
          });
          // Don't fail the email send if timeout scheduling fails
        }
      }

      return {
        success: true,
        outboundMessageId: result.outboundMessageId,
        providerMessageId: result.providerMessageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('[EmailExecutionService] Email send failed', {
        tenantId,
        campaignId,
        contactId,
        nodeId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Try to update outbound message with failure if it was created
      try {
        const dedupeKey = this.buildDedupeKey(params);
        const existingMessage = await outboundMessageRepository.findByDedupeKeyForTenant(
          tenantId,
          dedupeKey
        );

        if (existingMessage && existingMessage.state === 'queued') {
          await outboundMessageRepository.updateByIdForTenant(existingMessage.id, tenantId, {
            state: 'failed',
            lastError: errorMessage,
            errorAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } catch (updateError) {
        logger.error('[EmailExecutionService] Failed to update outbound message state', {
          tenantId,
          campaignId,
          contactId,
          nodeId,
          updateError: updateError instanceof Error ? updateError.message : 'Unknown error',
        });
      }

      throw error;
    }
  }

  private async getActiveMailAccountByLeadId(
    tenantId: string,
    leadId?: string
  ): Promise<MailAccount> {
    if (!leadId) {
      throw new Error('No lead associated with campaign for mail account lookup');
    }

    const lead = await leadRepository.findByIdForTenant(leadId, tenantId);
    if (!lead.ownerId) {
      throw new Error('Cannot send campaign email without an assigned owner');
    }

    const mailAccount = await mailAccountRepository.findActivePrimaryForTenant(
      lead.ownerId,
      tenantId
    );

    if (!mailAccount) {
      throw new Error('No connected primary mail account configured for campaign');
    }

    return mailAccount;
  }

  private buildDedupeKey(params: EmailExecutionParams) {
    return `${params.tenantId}:${params.campaignId}:${params.contactId}:${params.nodeId}:email`;
  }

  /**
   * Generates a robust job ID for timeout jobs that handles special characters
   * and prevents conflicts by using cryptographic hashing
   */
  private generateTimeoutJobId(params: TimeoutJobParams): string {
    // Create a deterministic string from the parameters
    const components = [
      JOB_NAMES.campaign_execution.timeout,
      params.campaignId,
      params.nodeId,
      params.eventType,
      params.messageId,
    ];

    // Sanitize each component by replacing problematic characters
    const sanitizedComponents = components.map((component) =>
      component.replace(/[^a-zA-Z0-9_-]/g, '_')
    );

    // Create base job ID with sanitized components
    const baseJobId = sanitizedComponents.join('_');

    // For extra safety, create a hash of the original components
    // to ensure uniqueness even if sanitization causes collisions
    const originalString = components.join('|');
    const hash = createHash('sha256').update(originalString).digest('hex').substring(0, 8);

    return `${baseJobId}_${hash}`;
  }

  private async scheduleTimeoutJobs(
    campaignId: string,
    nodeId: string,
    plan: CampaignPlanOutput,
    messageId: string
  ): Promise<void> {
    // Find the current node in the plan
    const currentNode = plan.nodes.find((node) => node.id === nodeId);
    if (!currentNode || !currentNode.transitions) {
      logger.warn('[EmailExecutionService] No node or transitions found for timeout scheduling', {
        tenantId: this.tenantId,
        campaignId,
        nodeId,
        messageId,
      });
      return;
    }

    const defaults = plan.defaults?.timers;
    const scheduledTimeouts = new Set<string>(); // Track which timeout types we've scheduled

    // Find which timeout event types are actually used in this node's transitions
    const timeoutEventTypesInTransitions = new Set<string>();
    for (const transition of currentNode.transitions) {
      if (
        'after' in transition &&
        TIMEOUT_EVENT_TYPES.includes(transition.on as TimeoutEventType)
      ) {
        timeoutEventTypesInTransitions.add(transition.on);
      }
    }

    // Schedule timeout jobs based on specific node transitions
    for (const transition of currentNode.transitions) {
      // Type guard to check if this is a TransitionAfter (has 'after' property)
      if ('after' in transition) {
        // Only schedule timeout jobs for timeout event types
        const eventType = transition.on;
        if (!TIMEOUT_EVENT_TYPES.includes(eventType as TimeoutEventType)) {
          continue; // Skip non-timeout event types
        }

        if (scheduledTimeouts.has(eventType)) {
          // Skip if we've already scheduled this timeout type for this node
          continue;
        }

        try {
          const afterDelayMs = parseIsoDuration(transition.after);
          await this.scheduleTimeoutJob({
            campaignId,
            nodeId,
            messageId,
            eventType: eventType as TimeoutEventType,
            scheduledAt: new Date(Date.now() + afterDelayMs),
          });

          scheduledTimeouts.add(eventType);

          logger.info('[EmailExecutionService] Scheduled timeout job from node transition', {
            tenantId: this.tenantId,
            campaignId,
            nodeId,
            messageId,
            eventType,
            after: transition.after,
            scheduledAt: new Date(Date.now() + afterDelayMs).toISOString(),
          });
        } catch (error) {
          logger.error(
            '[EmailExecutionService] Failed to parse transition timing, skipping timeout job',
            {
              tenantId: this.tenantId,
              campaignId,
              nodeId,
              messageId,
              eventType: eventType as TimeoutEventType,
              after: transition.after,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          );
          // Continue to next transition instead of failing completely
        }
      }
    }

    // Only schedule default timeout jobs for event types that actually have transitions in the plan
    // This prevents scheduling no_click timeouts when the plan only has no_open transitions
    if (
      !scheduledTimeouts.has(CAMPAIGN_EVENT_TYPES.NO_OPEN) &&
      timeoutEventTypesInTransitions.has(CAMPAIGN_EVENT_TYPES.NO_OPEN)
    ) {
      const noOpenDelay = defaults?.no_open_after || DEFAULT_NO_OPEN_TIMEOUT;
      try {
        const noOpenDelayMs = parseIsoDuration(noOpenDelay);
        await this.scheduleTimeoutJob({
          campaignId,
          nodeId,
          messageId,
          eventType: CAMPAIGN_EVENT_TYPES.NO_OPEN,
          scheduledAt: new Date(Date.now() + noOpenDelayMs),
        });

        logger.info('[EmailExecutionService] Scheduled default no_open timeout', {
          tenantId: this.tenantId,
          campaignId,
          nodeId,
          messageId,
          delay: noOpenDelay,
          scheduledAt: new Date(Date.now() + noOpenDelayMs).toISOString(),
        });
      } catch (error) {
        logger.error('[EmailExecutionService] Failed to parse default no_open timing', {
          tenantId: this.tenantId,
          campaignId,
          nodeId,
          messageId,
          delay: noOpenDelay,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (
      !scheduledTimeouts.has(CAMPAIGN_EVENT_TYPES.NO_CLICK) &&
      timeoutEventTypesInTransitions.has(CAMPAIGN_EVENT_TYPES.NO_CLICK)
    ) {
      const noClickDelay = defaults?.no_click_after || DEFAULT_NO_CLICK_TIMEOUT;
      try {
        const noClickDelayMs = parseIsoDuration(noClickDelay);
        await this.scheduleTimeoutJob({
          campaignId,
          nodeId,
          messageId,
          eventType: CAMPAIGN_EVENT_TYPES.NO_CLICK,
          scheduledAt: new Date(Date.now() + noClickDelayMs),
        });

        logger.info('[EmailExecutionService] Scheduled default no_click timeout', {
          tenantId: this.tenantId,
          campaignId,
          nodeId,
          messageId,
          delay: noClickDelay,
          scheduledAt: new Date(Date.now() + noClickDelayMs).toISOString(),
        });
      } catch (error) {
        logger.error('[EmailExecutionService] Failed to parse default no_click timing', {
          tenantId: this.tenantId,
          campaignId,
          nodeId,
          messageId,
          delay: noClickDelay,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private async scheduleTimeoutJob(params: TimeoutJobParams): Promise<void> {
    // Validate delay BEFORE creating any database records
    const jobId = this.generateTimeoutJobId(params);
    const delayMs = Math.max(0, params.scheduledAt.getTime() - Date.now());

    if (delayMs <= 0) {
      logger.warn('[EmailExecutionService] Timeout job scheduled with negative delay, skipping', {
        tenantId: this.tenantId,
        campaignId: params.campaignId,
        nodeId: params.nodeId,
        messageId: params.messageId,
        eventType: params.eventType,
        scheduledAt: params.scheduledAt,
        currentTime: new Date(),
      });
      return;
    }

    // Use transaction to ensure atomicity between database record and BullMQ job
    await db.transaction(async (_tx) => {
      // Create scheduled_action record within transaction with job ID already set
      const scheduledAction = await scheduledActionRepository.createForTenant(this.tenantId, {
        campaignId: params.campaignId,
        actionType: JOB_NAMES.campaign_execution.timeout,
        scheduledAt: params.scheduledAt,
        payload: {
          nodeId: params.nodeId,
          messageId: params.messageId,
          eventType: params.eventType,
        },
        bullmqJobId: jobId, // Set job ID immediately to avoid orphaned records
      });

      try {
        // Enqueue BullMQ job
        const timeoutQueue = getQueue('campaign_execution');
        const timeoutJobPayload: TimeoutJobPayload = {
          tenantId: this.tenantId,
          ...params,
        };
        await timeoutQueue.add(JOB_NAMES.campaign_execution.timeout, timeoutJobPayload, {
          delay: delayMs,
          jobId,
          ...TIMEOUT_JOB_OPTIONS,
        });

        logger.info('[EmailExecutionService] Timeout job scheduled', {
          tenantId: this.tenantId,
          campaignId: params.campaignId,
          nodeId: params.nodeId,
          messageId: params.messageId,
          eventType: params.eventType,
          scheduledAt: params.scheduledAt,
          delayMs,
          jobId,
          scheduledActionId: scheduledAction.id,
        });
      } catch (bullmqError) {
        // If BullMQ job creation fails, the transaction will be rolled back
        logger.error(
          '[EmailExecutionService] BullMQ job creation failed, rolling back transaction',
          {
            tenantId: this.tenantId,
            campaignId: params.campaignId,
            nodeId: params.nodeId,
            messageId: params.messageId,
            eventType: params.eventType,
            jobId,
            error: bullmqError instanceof Error ? bullmqError.message : 'Unknown error',
          }
        );
        throw bullmqError; // Re-throw to trigger transaction rollback
      }
    });
  }
}
