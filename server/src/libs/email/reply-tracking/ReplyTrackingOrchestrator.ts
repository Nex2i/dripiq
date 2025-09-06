import { logger } from '@/libs/logger';
import { emailOrchestrator } from '@/libs/email/email.orchestrator';
import { emailReplyTracker } from './EmailReplyTracker';
import { GmailReplyTracker } from './GmailReplyTracker';
import { OutlookReplyTracker } from './OutlookReplyTracker';
import { EmailSendBase, ProviderIds } from '@/libs/email/email.types';
import { db } from '@/db';
import { mailAccounts, oauthTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export interface ReplyTrackingEmailSend extends Partial<EmailSendBase> {
  // Additional fields for reply tracking
  enableReplyTracking?: boolean;
  customMessageId?: string; // Custom Message-ID for better tracking
}

export class ReplyTrackingOrchestrator {
  /**
   * Send an email with reply tracking enabled
   */
  async sendEmailWithReplyTracking(
    userId: string,
    email: ReplyTrackingEmailSend
  ): Promise<ProviderIds & { threadId?: string }> {
    try {
      logger.info('[ReplyTrackingOrchestrator] Sending email with reply tracking', {
        userId,
        to: email.to,
        subject: email.subject,
        enableReplyTracking: email.enableReplyTracking,
      });

      // Generate a custom Message-ID if not provided and reply tracking is enabled
      let customMessageId = email.customMessageId;
      if (email.enableReplyTracking && !customMessageId) {
        customMessageId = `<${email.outboundMessageId || createId()}.${Date.now()}@${process.env.DOMAIN || 'localhost'}>`;
      }

      // Add custom headers for better tracking
      const enhancedEmail: Partial<EmailSendBase> = {
        ...email,
        headers: {
          ...email.headers,
          ...(customMessageId && { 'Message-ID': customMessageId }),
          // Add custom tracking headers
          'X-Campaign-ID': email.campaignId,
          'X-Outbound-Message-ID': email.outboundMessageId,
          'X-Tenant-ID': email.tenantId,
        },
      };

      // Send the email through the regular orchestrator
      const providerIds = await emailOrchestrator.sendEmail(userId, enhancedEmail);

      let threadId: string | undefined;

      // If reply tracking is enabled, create an email thread
      if (email.enableReplyTracking && email.tenantId && email.campaignId && email.outboundMessageId) {
        try {
          // Extract contact ID from the email or use a placeholder
          const contactId = this.extractContactId(email);
          
          if (contactId) {
            threadId = await emailReplyTracker.createEmailThread(
              email.tenantId,
              email.campaignId,
              contactId,
              email.outboundMessageId,
              customMessageId || providerIds.providerMessageId || '',
              providerIds.providerMessageId // Use provider message ID as thread ID for Gmail
            );

            // Set up push notifications if not already active
            await this.ensurePushNotificationsActive(userId);
          }
        } catch (trackingError) {
          logger.error('[ReplyTrackingOrchestrator] Failed to set up reply tracking', {
            error: trackingError instanceof Error ? trackingError.message : 'Unknown error',
            email: {
              tenantId: email.tenantId,
              campaignId: email.campaignId,
              outboundMessageId: email.outboundMessageId,
            },
          });
          // Don't fail the email send if tracking setup fails
        }
      }

      logger.info('[ReplyTrackingOrchestrator] Email sent successfully with reply tracking', {
        userId,
        providerMessageId: providerIds.providerMessageId,
        threadId,
        responseStatus: providerIds.responseStatus,
      });

      return {
        ...providerIds,
        threadId,
      };
    } catch (error) {
      logger.error('[ReplyTrackingOrchestrator] Failed to send email with reply tracking', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        email: {
          to: email.to,
          subject: email.subject,
          tenantId: email.tenantId,
          campaignId: email.campaignId,
        },
      });
      throw error;
    }
  }

  /**
   * Ensure push notifications are active for the user's mail accounts
   */
  private async ensurePushNotificationsActive(userId: string): Promise<void> {
    try {
      // Get all active mail accounts for the user
      const userMailAccounts = await db
        .select({
          id: mailAccounts.id,
          provider: mailAccounts.provider,
        })
        .from(mailAccounts)
        .where(eq(mailAccounts.userId, userId));

      for (const mailAccount of userMailAccounts) {
        try {
          // Get the refresh token for this mail account
          const tokenRecord = await db
            .select({ refreshToken: oauthTokens.refreshToken })
            .from(oauthTokens)
            .where(and(
              eq(oauthTokens.mailAccountId, mailAccount.id),
              eq(oauthTokens.status, 'active')
            ))
            .limit(1);

          if (tokenRecord.length === 0) {
            logger.warn('[ReplyTrackingOrchestrator] No active refresh token found', {
              mailAccountId: mailAccount.id,
            });
            continue;
          }

          // Set up push notifications based on provider
          if (mailAccount.provider === 'google') {
            const gmailTracker = new GmailReplyTracker(tokenRecord[0].refreshToken);
            await gmailTracker.setupPushNotifications(userId, mailAccount.id);
          } else if (mailAccount.provider === 'microsoft') {
            const outlookTracker = new OutlookReplyTracker(tokenRecord[0].refreshToken);
            await outlookTracker.setupChangeNotifications(userId, mailAccount.id);
          }
        } catch (setupError) {
          logger.error('[ReplyTrackingOrchestrator] Failed to setup push notifications for mail account', {
            error: setupError instanceof Error ? setupError.message : 'Unknown error',
            mailAccountId: mailAccount.id,
            provider: mailAccount.provider,
          });
          // Continue with other accounts
        }
      }
    } catch (error) {
      logger.error('[ReplyTrackingOrchestrator] Failed to ensure push notifications active', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      // Don't throw error as this is a background operation
    }
  }

  /**
   * Extract contact ID from email data
   * This is a simplified implementation - you might need to enhance based on your data structure
   */
  private extractContactId(email: ReplyTrackingEmailSend): string | null {
    // Try to extract from the email object
    if (email.to) {
      // This is a simplified approach - you might want to look up the contact
      // in your database based on the email address
      return email.to; // Using email as contact ID for now
    }
    return null;
  }

  /**
   * Set up push notifications for a specific user and provider
   */
  async setupPushNotifications(userId: string, provider: 'google' | 'microsoft'): Promise<void> {
    try {
      logger.info('[ReplyTrackingOrchestrator] Setting up push notifications', { userId, provider });

      // Get the mail account for this provider
      const mailAccount = await db
        .select({ id: mailAccounts.id })
        .from(mailAccounts)
        .where(and(
          eq(mailAccounts.userId, userId),
          eq(mailAccounts.provider, provider)
        ))
        .limit(1);

      if (mailAccount.length === 0) {
        throw new Error(`No ${provider} mail account found for user`);
      }

      // Get the refresh token
      const tokenRecord = await db
        .select({ refreshToken: oauthTokens.refreshToken })
        .from(oauthTokens)
        .where(and(
          eq(oauthTokens.mailAccountId, mailAccount[0].id),
          eq(oauthTokens.status, 'active')
        ))
        .limit(1);

      if (tokenRecord.length === 0) {
        throw new Error('No active refresh token found');
      }

      // Set up push notifications
      if (provider === 'google') {
        const gmailTracker = new GmailReplyTracker(tokenRecord[0].refreshToken);
        await gmailTracker.setupPushNotifications(userId, mailAccount[0].id);
      } else if (provider === 'microsoft') {
        const outlookTracker = new OutlookReplyTracker(tokenRecord[0].refreshToken);
        await outlookTracker.setupChangeNotifications(userId, mailAccount[0].id);
      }

      logger.info('[ReplyTrackingOrchestrator] Push notifications setup completed', { userId, provider });
    } catch (error) {
      logger.error('[ReplyTrackingOrchestrator] Failed to setup push notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        provider,
      });
      throw error;
    }
  }

  /**
   * Cancel push notifications for a specific user and provider
   */
  async cancelPushNotifications(userId: string, provider: 'google' | 'microsoft'): Promise<void> {
    try {
      logger.info('[ReplyTrackingOrchestrator] Cancelling push notifications', { userId, provider });

      // Get the mail account for this provider
      const mailAccount = await db
        .select({ id: mailAccounts.id })
        .from(mailAccounts)
        .where(and(
          eq(mailAccounts.userId, userId),
          eq(mailAccounts.provider, provider)
        ))
        .limit(1);

      if (mailAccount.length === 0) {
        logger.warn('[ReplyTrackingOrchestrator] No mail account found for cancellation', { userId, provider });
        return;
      }

      // Get the refresh token
      const tokenRecord = await db
        .select({ refreshToken: oauthTokens.refreshToken })
        .from(oauthTokens)
        .where(and(
          eq(oauthTokens.mailAccountId, mailAccount[0].id),
          eq(oauthTokens.status, 'active')
        ))
        .limit(1);

      if (tokenRecord.length === 0) {
        logger.warn('[ReplyTrackingOrchestrator] No active refresh token found for cancellation', {
          mailAccountId: mailAccount[0].id,
        });
        return;
      }

      // Cancel push notifications
      if (provider === 'google') {
        const gmailTracker = new GmailReplyTracker(tokenRecord[0].refreshToken);
        await gmailTracker.cancelPushNotifications(mailAccount[0].id);
      } else if (provider === 'microsoft') {
        const outlookTracker = new OutlookReplyTracker(tokenRecord[0].refreshToken);
        await outlookTracker.cancelChangeNotifications(mailAccount[0].id);
      }

      logger.info('[ReplyTrackingOrchestrator] Push notifications cancelled successfully', { userId, provider });
    } catch (error) {
      logger.error('[ReplyTrackingOrchestrator] Failed to cancel push notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        provider,
      });
      throw error;
    }
  }
}

export const replyTrackingOrchestrator = new ReplyTrackingOrchestrator();