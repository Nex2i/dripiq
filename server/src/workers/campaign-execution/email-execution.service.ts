import { createId } from '@paralleldrive/cuid2';
import { logger } from '@/libs/logger';
import { sendgridClient } from '@/libs/email/sendgrid.client';
import { emailSenderIdentityRepository, outboundMessageRepository } from '@/repositories';
import type { SendBase } from '@/libs/email/sendgrid.types';
import type { ContactCampaign, LeadPointOfContact } from '@/db/schema';

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
}

export interface EmailExecutionResult {
  success: boolean;
  outboundMessageId?: string;
  providerMessageId?: string;
  error?: string;
}

export class EmailExecutionService {
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
}
