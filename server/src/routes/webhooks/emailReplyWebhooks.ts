import { Request, Response } from 'express';
import { logger } from '@/libs/logger';

/**
 * Gmail Push Notification Webhook
 * Handles notifications from Google Cloud Pub/Sub when new emails arrive
 */
export async function handleGmailNotification(req: Request, res: Response): Promise<void> {
  try {
    logger.info('[Gmail Webhook] Received notification', {
      headers: req.headers,
      body: req.body,
    });

    // Log the decoded message data if available
    if (req.body.message?.data) {
      try {
        const decodedData = JSON.parse(Buffer.from(req.body.message.data, 'base64').toString('utf-8'));
        logger.info('[Gmail Webhook] Decoded notification data', decodedData);
      } catch (decodeError) {
        logger.warn('[Gmail Webhook] Failed to decode message data', { error: decodeError });
      }
    }

    // For now, just acknowledge receipt
    res.status(200).json({ 
      success: true, 
      message: 'Gmail notification received and logged',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[Gmail Webhook] Failed to handle notification', {
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
    logger.info('[Outlook Webhook] Received notification', {
      headers: req.headers,
      body: req.body,
    });

    // Handle validation request from Microsoft Graph
    if (req.query.validationToken) {
      logger.info('[Outlook Webhook] Responding to validation request', {
        validationToken: req.query.validationToken,
      });
      res.status(200).send(req.query.validationToken);
      return;
    }

    // Process change notifications
    if (req.body.value && Array.isArray(req.body.value)) {
      logger.info('[Outlook Webhook] Processing change notifications', {
        notificationCount: req.body.value.length,
        notifications: req.body.value,
      });

      // Log each notification
      req.body.value.forEach((notification: any, index: number) => {
        logger.info(`[Outlook Webhook] Notification ${index + 1}`, {
          subscriptionId: notification.subscriptionId,
          changeType: notification.changeType,
          resource: notification.resource,
          resourceData: notification.resourceData,
          clientState: notification.clientState,
        });
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Outlook notification received and logged',
      processedCount: req.body.value?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[Outlook Webhook] Failed to handle notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Generic email reply webhook for testing
 */
export async function handleGenericEmailReply(req: Request, res: Response): Promise<void> {
  try {
    logger.info('[Generic Email Webhook] Received email data', {
      headers: req.headers,
      body: req.body,
    });

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

    // Log structured email data
    logger.info('[Generic Email Webhook] Email details', {
      providerMessageId,
      fromEmail,
      toEmail,
      subject,
      messageId,
      inReplyTo,
      references,
      conversationId,
      threadId,
      receivedAt,
      hasBodyText: !!bodyText,
      hasBodyHtml: !!bodyHtml,
      bodyTextLength: bodyText?.length || 0,
      bodyHtmlLength: bodyHtml?.length || 0,
    });

    // Analyze if this looks like a reply
    const isLikelyReply = !!(inReplyTo || references || subject?.toLowerCase().includes('re:'));
    
    logger.info('[Generic Email Webhook] Reply analysis', {
      isLikelyReply,
      hasInReplyTo: !!inReplyTo,
      hasReferences: !!references,
      subjectHasRe: subject?.toLowerCase().includes('re:') || false,
    });

    res.status(200).json({
      success: true,
      message: 'Generic email received and logged',
      analysis: {
        isLikelyReply,
        hasInReplyTo: !!inReplyTo,
        hasReferences: !!references,
        subjectHasRe: subject?.toLowerCase().includes('re:') || false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Generic Email Webhook] Failed to handle email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}