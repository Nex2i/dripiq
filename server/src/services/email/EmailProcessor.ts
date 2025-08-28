import { createId } from '@paralleldrive/cuid2';
import { logger } from '@/libs/logger';
import { sendgridClient } from '@/libs/email/sendgrid.client';
import { calendarUrlWrapper } from '@/libs/calendar/calendarUrlWrapper';
import {
  formatEmailBodyForHtml,
  formatEmailBodyForText,
  containsHtml,
} from '@/utils/emailFormatting';
import { outboundMessageRepository } from '@/repositories';
import type { SendBase } from '@/libs/email/sendgrid.types';
import { EmailSenderIdentity } from '@/db';

export interface CampaignEmailData {
  // Core email data
  tenantId: string;
  campaignId: string;
  contactId: string;
  nodeId: string;

  // Email content
  subject: string;
  body: string;
  recipientEmail: string;
  recipientName: string;

  // Sender info (pre-fetched, pre-validated)
  senderIdentity: EmailSenderIdentity;

  // Calendar info (optional, pre-fetched)
  calendarInfo?: {
    calendarLink: string;
    calendarTieIn: string;
    leadId: string;
  };

  // Processing options
  skipMessageRecord?: boolean; // For test emails
  skipTimeoutScheduling?: boolean; // For test emails
  categories?: string[];

  // Optional dedupe key (will be generated if not provided)
  dedupeKey?: string;
}

export interface EmailProcessorResult {
  success: boolean;
  outboundMessageId?: string;
  providerMessageId?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Pure email processing class that handles core email sending logic
 * without database dependencies. Assumes all data has been pre-fetched
 * and unsubscribe checks have been performed.
 */
export class EmailProcessor {
  /**
   * Sends a campaign email with the provided data
   * @param data Complete email data with all dependencies resolved
   * @returns Result of the email sending operation
   */
  static async sendCampaignEmail(data: CampaignEmailData): Promise<EmailProcessorResult> {
    const {
      tenantId,
      campaignId,
      contactId,
      nodeId,
      subject,
      body,
      recipientEmail,
      recipientName,
      senderIdentity,
      calendarInfo,
      skipMessageRecord = false,
      categories = ['campaign'],
    } = data;

    try {
      // Validate email content
      if (!subject || !subject.trim()) {
        throw new Error('Email subject is required');
      }

      if (!body || !body.trim()) {
        throw new Error('Email body is required');
      }

      if (!recipientEmail || !recipientEmail.trim()) {
        throw new Error('Recipient email is required');
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        throw new Error('Invalid recipient email format');
      }

      // Generate dedupe key if not provided
      const dedupeKey = data.dedupeKey || `${tenantId}:${campaignId}:${contactId}:${nodeId}:email`;

      // Create outbound message ID (used for tracking even if not recording)
      const outboundMessageId = createId();

      // Prepare email body with signature and calendar information
      let emailBody = body;

      if (calendarInfo?.calendarLink && calendarInfo?.calendarTieIn) {
        try {
          const trackedCalendarUrl = calendarUrlWrapper.generateTrackedCalendarUrl({
            tenantId,
            leadId: calendarInfo.leadId,
            contactId,
            campaignId,
            nodeId,
            outboundMessageId,
          });

          const calendarMessage = calendarUrlWrapper.createCalendarMessage(
            calendarInfo.calendarTieIn,
            trackedCalendarUrl
          );

          // Append calendar message to email body
          // Check if the current email body contains HTML to determine formatting
          if (containsHtml(emailBody)) {
            // HTML mode: convert calendar message newlines to <br> if needed
            const htmlCalendarMessage = containsHtml(calendarMessage)
              ? calendarMessage
              : calendarMessage.replace(/\n/g, '<br>');
            emailBody = `${emailBody}<br><br>${htmlCalendarMessage}`;
          } else {
            // Plain text mode: use simple newlines
            emailBody = `${emailBody}\n\n${calendarMessage}`;
          }

          logger.info('[EmailProcessor] Calendar message appended to email', {
            tenantId,
            campaignId,
            contactId,
            nodeId,
            calendarTieIn: calendarInfo.calendarTieIn,
            trackedUrl: trackedCalendarUrl,
          });
        } catch (calendarError) {
          logger.error('[EmailProcessor] Failed to append calendar information', {
            tenantId,
            campaignId,
            contactId,
            nodeId,
            error: calendarError instanceof Error ? calendarError.message : 'Unknown error',
          });
          // Continue without calendar info - don't fail the email send
        }
      }

      // Create outbound message record if not skipping
      if (!skipMessageRecord) {
        await outboundMessageRepository.createForTenant(tenantId, {
          id: outboundMessageId,
          campaignId,
          contactId,
          channel: 'email',
          senderIdentityId: senderIdentity.id,
          dedupeKey,
          content: {
            subject,
            body,
            to: recipientEmail,
            toName: recipientName,
          },
          state: 'queued',
          scheduledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Append email signature if available
      if (senderIdentity.emailSignature?.trim()) {
        const signature = senderIdentity.emailSignature.trim();

        // Check if either the body or signature contains HTML
        const bodyHasHtml = containsHtml(emailBody);
        const signatureHasHtml = containsHtml(signature);

        if (bodyHasHtml || signatureHasHtml) {
          // HTML mode: convert plain text parts to HTML for consistency
          const htmlBody = bodyHasHtml ? emailBody : emailBody.replace(/\n/g, '<br>');
          const htmlSignature = signatureHasHtml ? signature : signature.replace(/\n/g, '<br>');
          emailBody = `${htmlBody}<br><br>${htmlSignature}`;
        } else {
          // Plain text mode: use simple newlines
          emailBody = `${emailBody}\n\n${signature}`;
        }

        logger.info('[EmailProcessor] Email signature appended', {
          tenantId,
          campaignId,
          contactId,
          nodeId,
          senderIdentityId: senderIdentity.id,
          signatureLength: signature.length,
          signatureIsHtml: signatureHasHtml,
          bodyIsHtml: bodyHasHtml,
        });
      }

      // Prepare SendGrid payload with both HTML and plain text versions
      const htmlBody = formatEmailBodyForHtml(emailBody);
      const textBody = formatEmailBodyForText(emailBody);

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
        to: recipientEmail,
        subject,
        html: htmlBody,
        text: textBody,
        categories: [...categories, `tenant:${tenantId}`],
      };

      // Send email via SendGrid
      logger.info('[EmailProcessor] Sending email via SendGrid', {
        tenantId,
        campaignId,
        contactId,
        nodeId,
        outboundMessageId,
        subject,
        to: recipientEmail,
        from: senderIdentity.fromEmail,
        skipMessageRecord,
      });

      const providerIds = await sendgridClient.sendEmail(sendPayload);

      // Update outbound message with success if not skipping
      if (!skipMessageRecord) {
        await outboundMessageRepository.updateByIdForTenant(outboundMessageId, tenantId, {
          state: 'sent',
          providerMessageId: providerIds.providerMessageId,
          sentAt: new Date(),
          updatedAt: new Date(),
        });
      }

      logger.info('[EmailProcessor] Email sent successfully', {
        tenantId,
        campaignId,
        contactId,
        nodeId,
        outboundMessageId,
        providerMessageId: providerIds.providerMessageId,
        responseStatus: providerIds.responseStatus,
        skipMessageRecord,
      });

      return {
        success: true,
        outboundMessageId,
        providerMessageId: providerIds.providerMessageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('[EmailProcessor] Email send failed', {
        tenantId,
        campaignId,
        contactId,
        nodeId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
