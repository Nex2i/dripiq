import { createHash } from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import { logger } from '@/libs/logger';
import { sendgridClient } from '@/libs/email/sendgrid.client';
import {
  emailSenderIdentityRepository,
  outboundMessageRepository,
  scheduledActionRepository,
} from '@/repositories';
import { unsubscribeService } from '@/modules/unsubscribe';
import { getQueue } from '@/libs/bullmq';
import { parseIsoDuration } from '@/modules/campaign/scheduleUtils';
import type { SendBase } from '@/libs/email/sendgrid.types';
import type { ContactCampaign, LeadPointOfContact } from '@/db/schema';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';
import type { TimeoutJobParams } from '@/types/timeout.types';

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

      // Fetch and validate sender identity
      const senderIdentity = await this.getSenderIdentityByLeadId(tenantId, contact.leadId);

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

      // Create outbound message record
      const outboundMessageId = createId();
      await outboundMessageRepository.createForTenant(tenantId, {
        id: outboundMessageId,
        campaignId,
        contactId,
        channel: 'email',
        senderIdentityId: senderIdentity.id,
        dedupeKey,
        content: {
          subject: node.subject,
          body: node.body,
          to: contact.email,
          toName: contact.name,
        },
        state: 'queued',
        scheduledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Prepare SendGrid payload
      const sendPayload: SendBase = {
        tenantId,
        campaignId,
        nodeId,
        outboundMessageId,
        dedupeKey,
        from: {
          email: senderIdentity.fromEmail,
          name: senderIdentity.fromName,
        },
        to: contact.email,
        subject: node.subject,
        html: node.body,
        categories: ['campaign', `tenant:${tenantId}`],
      };

      // Send email via SendGrid
      logger.info('[EmailExecutionService] Sending email via SendGrid', {
        tenantId,
        campaignId,
        contactId,
        nodeId,
        outboundMessageId,
        subject: node.subject,
        to: contact.email,
        from: senderIdentity.fromEmail,
      });

      const providerIds = await sendgridClient.sendEmail(sendPayload);

      // Update outbound message with success
      await outboundMessageRepository.updateByIdForTenant(outboundMessageId, tenantId, {
        state: 'sent',
        providerMessageId: providerIds.providerMessageId,
        sentAt: new Date(),
        updatedAt: new Date(),
      });

      logger.info('[EmailExecutionService] Email sent successfully', {
        tenantId,
        campaignId,
        contactId,
        nodeId,
        outboundMessageId,
        providerMessageId: providerIds.providerMessageId,
        responseStatus: providerIds.responseStatus,
      });

      // Schedule timeout jobs after successful send
      if (params.planJson) {
        try {
          await this.scheduleTimeoutJobs(campaignId, nodeId, params.planJson, outboundMessageId);
          logger.info('[EmailExecutionService] Timeout jobs scheduled successfully', {
            tenantId,
            campaignId,
            nodeId,
            outboundMessageId,
          });
        } catch (timeoutError) {
          logger.error('[EmailExecutionService] Failed to schedule timeout jobs', {
            tenantId,
            campaignId,
            nodeId,
            outboundMessageId,
            error: timeoutError instanceof Error ? timeoutError.message : 'Unknown error',
          });
          // Don't fail the email send if timeout scheduling fails
        }
      }

      return {
        success: true,
        outboundMessageId,
        providerMessageId: providerIds.providerMessageId,
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

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async getSenderIdentityByLeadId(tenantId: string, leadId?: string) {
    if (!leadId) {
      throw new Error('No sender identity configured for campaign');
    }

    const senderIdentity = await emailSenderIdentityRepository.findByLeadIdForTenant(
      leadId,
      tenantId
    );

    if (!senderIdentity) {
      throw new Error(`Sender identity not found: ${leadId}`);
    }

    if (senderIdentity.validationStatus !== 'verified') {
      throw new Error(
        `Sender identity not verified: ${senderIdentity.fromEmail} (status: ${senderIdentity.validationStatus})`
      );
    }

    return senderIdentity;
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
      'timeout',
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
    const defaults = plan.defaults?.timers;

    // Schedule no_open timeout (default 72h)
    const noOpenDelay = defaults?.no_open_after || 'PT72H';
    const noOpenDelayMs = parseIsoDuration(noOpenDelay);
    await this.scheduleTimeoutJob({
      campaignId,
      nodeId,
      messageId,
      eventType: 'no_open',
      scheduledAt: new Date(Date.now() + noOpenDelayMs),
    });

    // Schedule no_click timeout (default 24h)
    const noClickDelay = defaults?.no_click_after || 'PT24H';
    const noClickDelayMs = parseIsoDuration(noClickDelay);
    await this.scheduleTimeoutJob({
      campaignId,
      nodeId,
      messageId,
      eventType: 'no_click',
      scheduledAt: new Date(Date.now() + noClickDelayMs),
    });
  }

  private async scheduleTimeoutJob(params: TimeoutJobParams): Promise<void> {
    // Create scheduled_action record
    const scheduledAction = await scheduledActionRepository.createForTenant(this.tenantId, {
      campaignId: params.campaignId,
      actionType: 'timeout',
      scheduledAt: params.scheduledAt,
      payload: {
        nodeId: params.nodeId,
        messageId: params.messageId,
        eventType: params.eventType,
      },
    });

    // Enqueue BullMQ job
    const timeoutQueue = getQueue('campaign_execution');
    const jobId = this.generateTimeoutJobId(params);
    const delayMs = Math.max(0, params.scheduledAt.getTime() - Date.now());

    if (delayMs <= 0) {
      logger.warn('[EmailExecutionService] Timeout job scheduled with negative delay', {
        tenantId: this.tenantId,
        campaignId: params.campaignId,
        nodeId: params.nodeId,
        messageId: params.messageId,
        eventType: params.eventType,
      });
      return;
    }

    await timeoutQueue.add('timeout', params, {
      delay: delayMs,
      jobId,
      removeOnComplete: { age: 60 * 60, count: 100 }, // Keep completed timeout jobs for 1 hour
      removeOnFail: { age: 24 * 60 * 60, count: 50 }, // Keep failed timeout jobs for 24 hours
    });

    // Update scheduled action with BullMQ job ID
    await scheduledActionRepository.updateByIdForTenant(scheduledAction.id, this.tenantId, {
      bullmqJobId: jobId,
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
  }
}
