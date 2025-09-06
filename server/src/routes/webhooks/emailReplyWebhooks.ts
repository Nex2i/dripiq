import { Request, Response } from 'express';
import { logger } from '@/libs/logger';
import { GmailReplyTracker } from '@/libs/email/reply-tracking/GmailReplyTracker';
import { OutlookReplyTracker } from '@/libs/email/reply-tracking/OutlookReplyTracker';
import { db } from '@/db';
import { webhookSubscriptions, mailAccounts, oauthTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Gmail Push Notification Webhook
 * Handles notifications from Google Cloud Pub/Sub when new emails arrive
 */
export async function handleGmailNotification(req: Request, res: Response): Promise<void> {
  try {
    logger.info('[EmailReplyWebhooks] Received Gmail notification', {
      headers: req.headers,
      body: req.body,
    });

    // Verify this is a valid Pub/Sub message
    if (!req.body.message) {
      logger.warn('[EmailReplyWebhooks] Invalid Gmail notification - no message');
      res.status(400).json({ error: 'Invalid notification format' });
      return;
    }

    const { message } = req.body;
    
    // Decode the message data to get the email address
    let emailAddress: string;
    try {
      const decodedData = JSON.parse(Buffer.from(message.data, 'base64').toString('utf-8'));
      emailAddress = decodedData.emailAddress;
    } catch (error) {
      logger.error('[EmailReplyWebhooks] Failed to decode Gmail notification data', { error });
      res.status(400).json({ error: 'Invalid message data' });
      return;
    }

    // Find the mail account for this email address
    const mailAccount = await db
      .select({
        id: mailAccounts.id,
        userId: mailAccounts.userId,
      })
      .from(mailAccounts)
      .where(and(
        eq(mailAccounts.primaryEmail, emailAddress),
        eq(mailAccounts.provider, 'google')
      ))
      .limit(1);

    if (mailAccount.length === 0) {
      logger.warn('[EmailReplyWebhooks] No mail account found for Gmail notification', { emailAddress });
      res.status(404).json({ error: 'Mail account not found' });
      return;
    }

    // Get the refresh token for this mail account
    const tokenRecord = await db
      .select({ refreshToken: oauthTokens.refreshToken })
      .from(oauthTokens)
      .where(and(
        eq(oauthTokens.mailAccountId, mailAccount[0].id),
        eq(oauthTokens.status, 'active')
      ))
      .limit(1);

    if (tokenRecord.length === 0) {
      logger.error('[EmailReplyWebhooks] No active refresh token found for mail account', {
        mailAccountId: mailAccount[0].id,
      });
      res.status(500).json({ error: 'No active token found' });
      return;
    }

    // Process the notification
    const gmailTracker = new GmailReplyTracker(tokenRecord[0].refreshToken);
    await gmailTracker.processPushNotification(req.body, mailAccount[0].id);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('[EmailReplyWebhooks] Failed to handle Gmail notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Outlook/Microsoft Graph Change Notification Webhook
 * Handles change notifications from Microsoft Graph when new emails arrive
 */
export async function handleOutlookNotification(req: Request, res: Response): Promise<void> {
  try {
    logger.info('[EmailReplyWebhooks] Received Outlook notification', {
      headers: req.headers,
      body: req.body,
    });

    // Handle validation request from Microsoft Graph
    if (req.query.validationToken) {
      logger.info('[EmailReplyWebhooks] Responding to Outlook webhook validation');
      res.status(200).send(req.query.validationToken);
      return;
    }

    // Process change notifications
    if (!req.body.value || !Array.isArray(req.body.value)) {
      logger.warn('[EmailReplyWebhooks] Invalid Outlook notification format');
      res.status(400).json({ error: 'Invalid notification format' });
      return;
    }

    const notifications = req.body.value;

    for (const notification of notifications) {
      try {
        // Validate the notification structure
        if (!OutlookReplyTracker.validateWebhookNotification(notification)) {
          logger.warn('[EmailReplyWebhooks] Invalid Outlook notification structure', { notification });
          continue;
        }

        // Find the mail account for this subscription
        const subscription = await db
          .select({
            mailAccountId: webhookSubscriptions.mailAccountId,
            userId: webhookSubscriptions.userId,
          })
          .from(webhookSubscriptions)
          .where(and(
            eq(webhookSubscriptions.subscriptionId, notification.subscriptionId),
            eq(webhookSubscriptions.provider, 'microsoft'),
            eq(webhookSubscriptions.status, 'active')
          ))
          .limit(1);

        if (subscription.length === 0) {
          logger.warn('[EmailReplyWebhooks] No active subscription found for Outlook notification', {
            subscriptionId: notification.subscriptionId,
          });
          continue;
        }

        // Get the refresh token for this mail account
        const tokenRecord = await db
          .select({ refreshToken: oauthTokens.refreshToken })
          .from(oauthTokens)
          .where(and(
            eq(oauthTokens.mailAccountId, subscription[0].mailAccountId),
            eq(oauthTokens.status, 'active')
          ))
          .limit(1);

        if (tokenRecord.length === 0) {
          logger.error('[EmailReplyWebhooks] No active refresh token found for mail account', {
            mailAccountId: subscription[0].mailAccountId,
          });
          continue;
        }

        // Process the notification
        const outlookTracker = new OutlookReplyTracker(tokenRecord[0].refreshToken);
        await outlookTracker.processChangeNotification(notification, subscription[0].mailAccountId);
      } catch (notificationError) {
        logger.error('[EmailReplyWebhooks] Failed to process individual Outlook notification', {
          error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
          notification,
        });
        // Continue processing other notifications
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('[EmailReplyWebhooks] Failed to handle Outlook notifications', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Generic email reply webhook for testing or custom integrations
 */
export async function handleGenericEmailReply(req: Request, res: Response): Promise<void> {
  try {
    logger.info('[EmailReplyWebhooks] Received generic email reply', {
      headers: req.headers,
      body: req.body,
    });

    // This endpoint can be used for testing or custom email integrations
    // Expected format matches InboundEmailData interface
    const {
      providerMessageId,
      fromEmail,
      toEmail,
      subject,
      bodyText,
      bodyHtml,
      messageId,
      inReplyTo,
      references,
      conversationId,
      threadId,
      receivedAt,
    } = req.body;

    if (!providerMessageId || !fromEmail || !toEmail || !subject) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Import here to avoid circular dependency
    const { emailReplyTracker } = await import('@/libs/email/reply-tracking/EmailReplyTracker');

    const result = await emailReplyTracker.processInboundEmail({
      providerMessageId,
      fromEmail,
      toEmail,
      subject,
      bodyText,
      bodyHtml,
      messageId,
      inReplyTo,
      references,
      conversationId,
      threadId,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      raw: req.body,
    });

    res.status(200).json({
      success: true,
      inboundMessageId: result.inboundMessageId,
      isReply: result.threadMatch.isReply,
      matchMethod: result.threadMatch.matchMethod,
      confidence: result.threadMatch.confidence,
    });
  } catch (error) {
    logger.error('[EmailReplyWebhooks] Failed to handle generic email reply', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}