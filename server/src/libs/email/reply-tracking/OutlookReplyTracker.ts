import { Client } from '@microsoft/microsoft-graph-client';
import { getMicrosoftOAuth2Client } from '@/libs/thirdPartyAuth/MicrosoftAuth';
import { logger } from '@/libs/logger';
import { emailReplyTracker, InboundEmailData } from './EmailReplyTracker';
import { db } from '@/db';
import { webhookSubscriptions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';

interface OutlookChangeNotification {
  subscriptionId: string;
  clientState?: string;
  changeType: string;
  resource: string;
  resourceData?: {
    '@odata.type': string;
    '@odata.id': string;
    id: string;
  };
  subscriptionExpirationDateTime: string;
  tenantId: string;
}

interface OutlookMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  from: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
  }>;
  receivedDateTime: string;
  internetMessageId: string;
  internetMessageHeaders: Array<{
    name: string;
    value: string;
  }>;
}

export class OutlookReplyTracker {
  private graphClient: Client;
  private refreshToken: string;

  constructor(refreshToken: string) {
    this.refreshToken = refreshToken;
    this.graphClient = this.createGraphClient();
  }

  private createGraphClient(): Client {
    return Client.init({
      authProvider: async (done) => {
        try {
          const oauth2Client = getMicrosoftOAuth2Client();
          const tokenResponse = await oauth2Client.refreshToken(this.refreshToken);
          done(null, tokenResponse.access_token);
        } catch (error) {
          logger.error('Failed to refresh Microsoft access token:', error);
          done(error, null);
        }
      },
    });
  }

  /**
   * Set up Microsoft Graph change notifications for the user's mailbox
   */
  async setupChangeNotifications(userId: string, mailAccountId: string): Promise<{
    subscriptionId: string;
    expiresAt: Date;
  }> {
    try {
      logger.info('[OutlookReplyTracker] Setting up change notifications', { userId, mailAccountId });

      // Calculate expiration time (maximum 4230 minutes for mailbox resources)
      const expirationDateTime = new Date(Date.now() + (4230 * 60 * 1000)); // 4230 minutes from now

      // Create the subscription
      const subscription = await this.graphClient.api('/subscriptions').post({
        changeType: 'created',
        notificationUrl: `${WEBHOOK_BASE_URL}/api/webhooks/outlook/notifications`,
        resource: '/me/mailFolders/inbox/messages',
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: `${mailAccountId}-${Date.now()}`, // Custom state for verification
      });

      // Store the subscription in the database
      await db.insert(webhookSubscriptions).values({
        id: createId(),
        userId,
        mailAccountId,
        provider: 'microsoft',
        subscriptionId: subscription.id,
        webhookUrl: `${WEBHOOK_BASE_URL}/api/webhooks/outlook/notifications`,
        expiresAt: expirationDateTime,
        status: 'active',
      });

      logger.info('[OutlookReplyTracker] Change notifications setup complete', {
        userId,
        mailAccountId,
        subscriptionId: subscription.id,
        expiresAt: expirationDateTime,
      });

      return {
        subscriptionId: subscription.id,
        expiresAt: expirationDateTime,
      };
    } catch (error) {
      logger.error('[OutlookReplyTracker] Failed to setup change notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        mailAccountId,
      });
      throw error;
    }
  }

  /**
   * Process Microsoft Graph change notification
   */
  async processChangeNotification(notification: OutlookChangeNotification, mailAccountId: string): Promise<void> {
    try {
      logger.info('[OutlookReplyTracker] Processing Outlook change notification', {
        subscriptionId: notification.subscriptionId,
        changeType: notification.changeType,
        resource: notification.resource,
        mailAccountId,
      });

      // Verify the subscription exists and is active
      const subscription = await db
        .select()
        .from(webhookSubscriptions)
        .where(and(
          eq(webhookSubscriptions.subscriptionId, notification.subscriptionId),
          eq(webhookSubscriptions.mailAccountId, mailAccountId),
          eq(webhookSubscriptions.provider, 'microsoft'),
          eq(webhookSubscriptions.status, 'active')
        ))
        .limit(1);

      if (subscription.length === 0) {
        logger.warn('[OutlookReplyTracker] No active subscription found for notification', {
          subscriptionId: notification.subscriptionId,
          mailAccountId,
        });
        return;
      }

      // Process only 'created' notifications (new messages)
      if (notification.changeType === 'created' && notification.resourceData?.id) {
        await this.processNewMessage(notification.resourceData.id);
      }

      logger.info('[OutlookReplyTracker] Change notification processed successfully', {
        subscriptionId: notification.subscriptionId,
        mailAccountId,
      });
    } catch (error) {
      logger.error('[OutlookReplyTracker] Failed to process change notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        mailAccountId,
        notification,
      });
      throw error;
    }
  }

  /**
   * Process a new Outlook message to check if it's a reply
   */
  private async processNewMessage(messageId: string): Promise<void> {
    try {
      // Get the full message details
      const message: OutlookMessage = await this.graphClient
        .api(`/me/messages/${messageId}`)
        .select([
          'id',
          'conversationId',
          'subject',
          'bodyPreview',
          'body',
          'from',
          'toRecipients',
          'receivedDateTime',
          'internetMessageId',
          'internetMessageHeaders',
        ])
        .get();

      if (!message.from?.emailAddress?.address || !message.toRecipients?.length) {
        logger.warn('[OutlookReplyTracker] Message missing required email addresses', { messageId });
        return;
      }

      // Extract headers
      const headers = message.internetMessageHeaders || [];
      const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

      const inReplyTo = getHeader('In-Reply-To');
      const references = getHeader('References');

      // Extract message body
      const bodyText = message.body?.contentType === 'text' ? message.body.content : undefined;
      const bodyHtml = message.body?.contentType === 'html' ? message.body.content : undefined;

      // Create inbound email data
      const inboundEmailData: InboundEmailData = {
        providerMessageId: messageId,
        fromEmail: message.from.emailAddress.address,
        toEmail: message.toRecipients[0].emailAddress.address,
        subject: message.subject || '',
        bodyText,
        bodyHtml,
        messageId: message.internetMessageId,
        inReplyTo,
        references,
        conversationId: message.conversationId,
        receivedAt: new Date(message.receivedDateTime),
        raw: {
          outlookMessage: message,
        },
      };

      // Process the inbound email through the reply tracker
      const result = await emailReplyTracker.processInboundEmail(inboundEmailData);

      logger.info('[OutlookReplyTracker] New message processed', {
        messageId,
        isReply: result.threadMatch.isReply,
        matchMethod: result.threadMatch.matchMethod,
        confidence: result.threadMatch.confidence,
      });
    } catch (error) {
      logger.error('[OutlookReplyTracker] Failed to process new message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId,
      });
    }
  }

  /**
   * Renew Microsoft Graph change notifications before they expire
   */
  async renewChangeNotifications(userId: string, mailAccountId: string): Promise<void> {
    try {
      logger.info('[OutlookReplyTracker] Renewing change notifications', { userId, mailAccountId });

      // Get the current subscription
      const subscription = await db
        .select()
        .from(webhookSubscriptions)
        .where(and(
          eq(webhookSubscriptions.mailAccountId, mailAccountId),
          eq(webhookSubscriptions.provider, 'microsoft'),
          eq(webhookSubscriptions.status, 'active')
        ))
        .limit(1);

      if (subscription.length === 0) {
        logger.warn('[OutlookReplyTracker] No active subscription found for renewal', { mailAccountId });
        return;
      }

      const currentSubscription = subscription[0];

      // Calculate new expiration time
      const newExpirationDateTime = new Date(Date.now() + (4230 * 60 * 1000)); // 4230 minutes from now

      try {
        // Try to update the existing subscription
        await this.graphClient.api(`/subscriptions/${currentSubscription.subscriptionId}`).patch({
          expirationDateTime: newExpirationDateTime.toISOString(),
        });

        // Update the database record
        await db
          .update(webhookSubscriptions)
          .set({
            expiresAt: newExpirationDateTime,
            lastRenewalAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(webhookSubscriptions.id, currentSubscription.id));

        logger.info('[OutlookReplyTracker] Change notifications renewed successfully', {
          userId,
          mailAccountId,
          subscriptionId: currentSubscription.subscriptionId,
          newExpiresAt: newExpirationDateTime,
        });
      } catch (renewError) {
        logger.warn('[OutlookReplyTracker] Failed to renew existing subscription, creating new one', {
          error: renewError,
          subscriptionId: currentSubscription.subscriptionId,
        });

        // If renewal fails, create a new subscription
        await this.cancelChangeNotifications(mailAccountId);
        await this.setupChangeNotifications(userId, mailAccountId);
      }
    } catch (error) {
      logger.error('[OutlookReplyTracker] Failed to renew change notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        mailAccountId,
      });
      throw error;
    }
  }

  /**
   * Cancel Microsoft Graph change notifications
   */
  async cancelChangeNotifications(mailAccountId: string): Promise<void> {
    try {
      logger.info('[OutlookReplyTracker] Cancelling change notifications', { mailAccountId });

      // Get the current subscription
      const subscription = await db
        .select()
        .from(webhookSubscriptions)
        .where(and(
          eq(webhookSubscriptions.mailAccountId, mailAccountId),
          eq(webhookSubscriptions.provider, 'microsoft'),
          eq(webhookSubscriptions.status, 'active')
        ))
        .limit(1);

      if (subscription.length === 0) {
        logger.warn('[OutlookReplyTracker] No active subscription found for cancellation', { mailAccountId });
        return;
      }

      const currentSubscription = subscription[0];

      try {
        // Delete the subscription from Microsoft Graph
        await this.graphClient.api(`/subscriptions/${currentSubscription.subscriptionId}`).delete();
      } catch (deleteError) {
        logger.warn('[OutlookReplyTracker] Failed to delete subscription from Graph API', {
          error: deleteError,
          subscriptionId: currentSubscription.subscriptionId,
        });
        // Continue to update database status even if Graph API call fails
      }

      // Update subscription status in database
      await db
        .update(webhookSubscriptions)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(webhookSubscriptions.id, currentSubscription.id));

      logger.info('[OutlookReplyTracker] Change notifications cancelled successfully', {
        mailAccountId,
        subscriptionId: currentSubscription.subscriptionId,
      });
    } catch (error) {
      logger.error('[OutlookReplyTracker] Failed to cancel change notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        mailAccountId,
      });
      throw error;
    }
  }

  /**
   * Validate webhook notification (verify it's from Microsoft)
   */
  static validateWebhookNotification(
    notification: OutlookChangeNotification,
    expectedClientState?: string
  ): boolean {
    try {
      // Basic validation
      if (!notification.subscriptionId || !notification.changeType || !notification.resource) {
        logger.warn('[OutlookReplyTracker] Invalid notification structure', { notification });
        return false;
      }

      // Validate client state if provided
      if (expectedClientState && notification.clientState !== expectedClientState) {
        logger.warn('[OutlookReplyTracker] Client state mismatch', {
          expected: expectedClientState,
          received: notification.clientState,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('[OutlookReplyTracker] Error validating webhook notification', { error, notification });
      return false;
    }
  }

  /**
   * Test the connection to Microsoft Graph
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.graphClient.api('/me').get();
      return true;
    } catch (error) {
      logger.error('[OutlookReplyTracker] Connection test failed', { error });
      return false;
    }
  }
}