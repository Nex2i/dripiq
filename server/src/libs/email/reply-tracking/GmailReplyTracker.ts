import { gmail_v1, google } from 'googleapis';
import { logger } from '@/libs/logger';
import { emailReplyTracker, InboundEmailData } from './EmailReplyTracker';
import { db } from '@/db';
import { webhookSubscriptions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';

interface GmailPushNotification {
  message: {
    data: string; // Base64 encoded JSON
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailHistoryChange {
  id: string;
  messagesAdded?: gmail_v1.Schema$Message[];
  messagesDeleted?: gmail_v1.Schema$Message[];
  labelsAdded?: any[];
  labelsRemoved?: any[];
}

export class GmailReplyTracker {
  private gmail: gmail_v1.Gmail;
  
  constructor(private refreshToken: string) {
    const googleAuth = new google.auth.OAuth2({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
    googleAuth.setCredentials({ refresh_token: refreshToken });
    this.gmail = google.gmail({ version: 'v1', auth: googleAuth });
  }

  /**
   * Set up Gmail push notifications for the user's mailbox
   */
  async setupPushNotifications(userId: string, mailAccountId: string): Promise<{
    subscriptionId: string;
    historyId: string;
    expiresAt: Date;
  }> {
    try {
      logger.info('[GmailReplyTracker] Setting up push notifications', { userId, mailAccountId });

      // First, get the current history ID
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      const historyId = profile.data.historyId!;

      // Set up the watch request
      const topicName = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`;
      const watchResponse = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName,
          labelIds: ['INBOX'], // Only watch for inbox messages
          labelFilterAction: 'include',
        },
      });

      const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
      const subscriptionId = `gmail-${mailAccountId}-${Date.now()}`;

      // Store the subscription in the database
      await db.insert(webhookSubscriptions).values({
        id: createId(),
        userId,
        mailAccountId,
        provider: 'google',
        subscriptionId,
        resourceId: historyId,
        webhookUrl: `${WEBHOOK_BASE_URL}/api/webhooks/gmail/notifications`,
        expiresAt,
        status: 'active',
      });

      logger.info('[GmailReplyTracker] Push notifications setup complete', {
        userId,
        mailAccountId,
        subscriptionId,
        historyId,
        expiresAt,
      });

      return {
        subscriptionId,
        historyId,
        expiresAt,
      };
    } catch (error) {
      logger.error('[GmailReplyTracker] Failed to setup push notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        mailAccountId,
      });
      throw error;
    }
  }

  /**
   * Process Gmail push notification
   */
  async processPushNotification(notification: GmailPushNotification, mailAccountId: string): Promise<void> {
    try {
      logger.info('[GmailReplyTracker] Processing Gmail push notification', {
        messageId: notification.message.messageId,
        mailAccountId,
      });

      // Decode the notification data
      const notificationData = JSON.parse(
        Buffer.from(notification.message.data, 'base64').toString('utf-8')
      );

      const { historyId } = notificationData;

      // Get the stored subscription to find the last processed history ID
      const subscription = await db
        .select()
        .from(webhookSubscriptions)
        .where(and(
          eq(webhookSubscriptions.mailAccountId, mailAccountId),
          eq(webhookSubscriptions.provider, 'google'),
          eq(webhookSubscriptions.status, 'active')
        ))
        .limit(1);

      if (subscription.length === 0) {
        logger.warn('[GmailReplyTracker] No active subscription found for notification', { mailAccountId });
        return;
      }

      const lastHistoryId = subscription[0].resourceId;

      // Get history changes since the last processed history ID
      const historyResponse = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
      });

      const history = historyResponse.data.history || [];

      // Process each history change
      for (const historyItem of history) {
        if (historyItem.messagesAdded) {
          for (const messageInfo of historyItem.messagesAdded) {
            if (messageInfo.message?.id) {
              await this.processNewMessage(messageInfo.message.id);
            }
          }
        }
      }

      // Update the stored history ID
      await db
        .update(webhookSubscriptions)
        .set({
          resourceId: historyId,
          updatedAt: new Date(),
        })
        .where(eq(webhookSubscriptions.id, subscription[0].id));

      logger.info('[GmailReplyTracker] Push notification processed successfully', {
        mailAccountId,
        historyId,
        changesProcessed: history.length,
      });
    } catch (error) {
      logger.error('[GmailReplyTracker] Failed to process push notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        mailAccountId,
        notification,
      });
      throw error;
    }
  }

  /**
   * Process a new Gmail message to check if it's a reply
   */
  private async processNewMessage(messageId: string): Promise<void> {
    try {
      // Get the full message details
      const messageResponse = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = messageResponse.data;
      if (!message.payload) {
        logger.warn('[GmailReplyTracker] Message has no payload', { messageId });
        return;
      }

      // Extract email headers
      const headers = message.payload.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

      const fromEmail = getHeader('From');
      const toEmail = getHeader('To');
      const subject = getHeader('Subject');
      const messageIdHeader = getHeader('Message-ID');
      const inReplyTo = getHeader('In-Reply-To');
      const references = getHeader('References');
      const dateHeader = getHeader('Date');

      if (!fromEmail || !toEmail || !subject) {
        logger.warn('[GmailReplyTracker] Message missing required headers', { messageId, fromEmail, toEmail, subject });
        return;
      }

      // Extract message body
      const { bodyText, bodyHtml } = this.extractMessageBody(message.payload);

      // Create inbound email data
      const inboundEmailData: InboundEmailData = {
        providerMessageId: messageId,
        fromEmail: this.extractEmailAddress(fromEmail),
        toEmail: this.extractEmailAddress(toEmail),
        subject,
        bodyText,
        bodyHtml,
        messageId: messageIdHeader,
        inReplyTo,
        references,
        threadId: message.threadId,
        receivedAt: dateHeader ? new Date(dateHeader) : new Date(),
        raw: {
          gmailMessage: message,
        },
      };

      // Process the inbound email through the reply tracker
      const result = await emailReplyTracker.processInboundEmail(inboundEmailData);

      logger.info('[GmailReplyTracker] New message processed', {
        messageId,
        isReply: result.threadMatch.isReply,
        matchMethod: result.threadMatch.matchMethod,
        confidence: result.threadMatch.confidence,
      });
    } catch (error) {
      logger.error('[GmailReplyTracker] Failed to process new message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId,
      });
    }
  }

  /**
   * Extract message body from Gmail payload
   */
  private extractMessageBody(payload: gmail_v1.Schema$MessagePart): { bodyText?: string; bodyHtml?: string } {
    let bodyText: string | undefined;
    let bodyHtml: string | undefined;

    const extractFromPart = (part: gmail_v1.Schema$MessagePart) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    if (payload.body?.data) {
      // Simple message with body data
      if (payload.mimeType === 'text/plain') {
        bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } else if (payload.mimeType === 'text/html') {
        bodyHtml = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      }
    } else if (payload.parts) {
      // Multipart message
      payload.parts.forEach(extractFromPart);
    }

    return { bodyText, bodyHtml };
  }

  /**
   * Extract email address from header value (e.g., "John Doe <john@example.com>" -> "john@example.com")
   */
  private extractEmailAddress(headerValue: string): string {
    const match = headerValue.match(/<([^>]+)>/);
    return match ? match[1] : headerValue.trim();
  }

  /**
   * Renew Gmail push notifications before they expire
   */
  async renewPushNotifications(userId: string, mailAccountId: string): Promise<void> {
    try {
      logger.info('[GmailReplyTracker] Renewing push notifications', { userId, mailAccountId });

      // Cancel existing subscription (if any)
      await this.gmail.users.stop({ userId: 'me' });

      // Set up new subscription
      await this.setupPushNotifications(userId, mailAccountId);

      // Update the subscription status
      await db
        .update(webhookSubscriptions)
        .set({
          lastRenewalAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(webhookSubscriptions.mailAccountId, mailAccountId),
          eq(webhookSubscriptions.provider, 'google')
        ));

      logger.info('[GmailReplyTracker] Push notifications renewed successfully', { userId, mailAccountId });
    } catch (error) {
      logger.error('[GmailReplyTracker] Failed to renew push notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        mailAccountId,
      });
      throw error;
    }
  }

  /**
   * Cancel Gmail push notifications
   */
  async cancelPushNotifications(mailAccountId: string): Promise<void> {
    try {
      logger.info('[GmailReplyTracker] Cancelling push notifications', { mailAccountId });

      // Stop Gmail watch
      await this.gmail.users.stop({ userId: 'me' });

      // Update subscription status
      await db
        .update(webhookSubscriptions)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(and(
          eq(webhookSubscriptions.mailAccountId, mailAccountId),
          eq(webhookSubscriptions.provider, 'google')
        ));

      logger.info('[GmailReplyTracker] Push notifications cancelled successfully', { mailAccountId });
    } catch (error) {
      logger.error('[GmailReplyTracker] Failed to cancel push notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        mailAccountId,
      });
      throw error;
    }
  }
}