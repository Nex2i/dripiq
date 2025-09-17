import { gmail_v1, google } from 'googleapis';
import { logger } from '@/libs/logger';
import {
  GmailPubSubPayload,
  GmailHistoryData,
  GmailThreadInfo,
  EmailThreadLog,
  EmailReplyWebhookError,
  WebhookProcessingResult,
} from './email-reply.types';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID) {
  logger.error('Missing Google Client ID for Gmail reply service');
  throw new Error('Missing Google Client ID');
}

if (!CLIENT_SECRET) {
  logger.error('Missing Google Client Secret for Gmail reply service');
  throw new Error('Missing Google Client Secret');
}

export class GmailReplyService {
  private gmail: gmail_v1.Gmail;

  constructor(refreshToken: string) {
    const googleAuth = new google.auth.OAuth2({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
    googleAuth.setCredentials({ refresh_token: refreshToken });
    this.gmail = google.gmail({ version: 'v1', auth: googleAuth });
  }

  /**
   * Process Gmail Pub/Sub webhook notification
   * @param payload - Pub/Sub payload from webhook
   * @returns Processing result
   */
  async processGmailWebhook(payload: GmailPubSubPayload): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    const webhookReceivedAt = new Date().toISOString();

    try {
      logger.info('Processing Gmail Pub/Sub webhook', {
        messageId: payload.message.messageId,
        subscription: payload.subscription,
        publishTime: payload.message.publishTime,
      });

      // Decode the Pub/Sub message data
      const historyData = this.decodePubSubMessage(payload.message.data);

      logger.info('Decoded Gmail history data', {
        emailAddress: historyData.emailAddress,
        historyId: historyData.historyId,
      });

      // Get recent history to find new messages
      const newMessages = await this.getRecentMessages(historyData);

      if (newMessages.length === 0) {
        logger.info('No new messages found in Gmail history', {
          historyId: historyData.historyId,
        });

        return {
          success: true,
          provider: 'gmail',
          threadsProcessed: 0,
          errors: [],
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Process each message and log thread information
      const processedThreads = new Set<string>();
      const errors: string[] = [];

      for (const message of newMessages) {
        try {
          if (!processedThreads.has(message.threadId)) {
            await this.processMessageThread(message.threadId, webhookReceivedAt);
            processedThreads.add(message.threadId);
          }
        } catch (error) {
          const errorMsg = `Failed to process thread ${message.threadId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          errors.push(errorMsg);
          logger.error('Error processing Gmail thread', {
            threadId: message.threadId,
            messageId: message.id,
            error: errorMsg,
          });
        }
      }

      const result: WebhookProcessingResult = {
        success: errors.length === 0,
        provider: 'gmail',
        threadsProcessed: processedThreads.size,
        errors,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info('Gmail webhook processing completed', result);
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Gmail webhook processing failed', {
        error: errorMessage,
        processingTimeMs: processingTime,
        payload: {
          messageId: payload.message.messageId,
          subscription: payload.subscription,
        },
      });

      if (error instanceof EmailReplyWebhookError) {
        throw error;
      }

      throw new EmailReplyWebhookError(
        `Gmail webhook processing failed: ${errorMessage}`,
        'GMAIL_PROCESSING_FAILED',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Decode base64 Pub/Sub message data
   * @param data - Base64 encoded data
   * @returns Decoded history data
   */
  private decodePubSubMessage(data: string): GmailHistoryData {
    try {
      const decoded = Buffer.from(data, 'base64').toString('utf-8');
      const historyData = JSON.parse(decoded);

      if (!historyData.emailAddress || !historyData.historyId) {
        throw new EmailReplyWebhookError(
          'Invalid Pub/Sub message format - missing emailAddress or historyId',
          'INVALID_PUBSUB_FORMAT',
          400
        );
      }

      return historyData;
    } catch (error) {
      if (error instanceof EmailReplyWebhookError) {
        throw error;
      }
      throw new EmailReplyWebhookError(
        'Failed to decode Pub/Sub message data',
        'PUBSUB_DECODE_FAILED',
        400,
        { originalError: error }
      );
    }
  }

  /**
   * Get recent messages from Gmail history
   * @param historyData - History data from Pub/Sub
   * @returns Array of new messages
   */
  private async getRecentMessages(historyData: GmailHistoryData) {
    try {
      const response = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyData.historyId,
        historyTypes: ['messageAdded'],
      });

      const messages: Array<{ id: string; threadId: string }> = [];

      if (response.data.history) {
        for (const historyRecord of response.data.history) {
          if (historyRecord.messagesAdded) {
            for (const messageAdded of historyRecord.messagesAdded) {
              if (messageAdded.message?.id && messageAdded.message?.threadId) {
                messages.push({
                  id: messageAdded.message.id,
                  threadId: messageAdded.message.threadId,
                });
              }
            }
          }
        }
      }

      logger.debug('Retrieved Gmail history messages', {
        historyId: historyData.historyId,
        messageCount: messages.length,
      });

      return messages;
    } catch (error) {
      logger.error('Failed to get Gmail history', {
        historyId: historyData.historyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new EmailReplyWebhookError(
        'Failed to retrieve Gmail history',
        'GMAIL_HISTORY_FAILED',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Process a Gmail thread and log thread information
   * @param threadId - Gmail thread ID
   * @param webhookReceivedAt - When webhook was received
   */
  private async processMessageThread(threadId: string, webhookReceivedAt: string): Promise<void> {
    try {
      // Get full thread details
      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      const thread = response.data as GmailThreadInfo;
      if (!thread.messages || thread.messages.length === 0) {
        logger.warn('Gmail thread has no messages', { threadId });
        return;
      }

      // Extract thread information
      const threadLog = this.extractThreadInfo(thread, webhookReceivedAt);

      // Log the thread information
      logger.info('Gmail email thread processed', threadLog);
    } catch (error) {
      logger.error('Failed to process Gmail thread', {
        threadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Extract thread information for logging
   * @param thread - Gmail thread data
   * @param webhookReceivedAt - When webhook was received
   * @returns Thread log data
   */
  private extractThreadInfo(thread: GmailThreadInfo, webhookReceivedAt: string): EmailThreadLog {
    const messages = thread.messages || [];
    const lastMessage = messages[messages.length - 1];

    // Extract participants from all messages
    const participants = new Set<string>();
    let subject = '';
    let isReply = false;
    let originalSender: string | undefined;

    for (const message of messages) {
      const headers = message.payload.headers || [];

      // Get subject from first message
      if (!subject) {
        const subjectHeader = headers.find((h) => h.name.toLowerCase() === 'subject');
        subject = subjectHeader?.value || '';
      }

      // Get participants
      const fromHeader = headers.find((h) => h.name.toLowerCase() === 'from');
      const toHeader = headers.find((h) => h.name.toLowerCase() === 'to');
      const ccHeader = headers.find((h) => h.name.toLowerCase() === 'cc');

      if (fromHeader?.value) {
        participants.add(this.extractEmailAddress(fromHeader.value));
      }
      if (toHeader?.value) {
        toHeader.value.split(',').forEach((email) => {
          participants.add(this.extractEmailAddress(email.trim()));
        });
      }
      if (ccHeader?.value) {
        ccHeader.value.split(',').forEach((email) => {
          participants.add(this.extractEmailAddress(email.trim()));
        });
      }
    }

    // Check if this is a reply (more than one message in thread)
    isReply = messages.length > 1;

    // Try to identify original sender (first message sender)
    if (messages.length > 0) {
      const firstMessage = messages[0];
      if (firstMessage) {
        const fromHeader = firstMessage.payload.headers?.find((h) => h.name.toLowerCase() === 'from');
        if (fromHeader?.value) {
          originalSender = this.extractEmailAddress(fromHeader.value);
        }
      }
    }

    return {
      provider: 'gmail',
      threadId: thread.id,
      messageId: lastMessage?.id || '',
      subject,
      participants: Array.from(participants),
      replyCount: messages.length,
      lastMessageAt: lastMessage?.internalDate
        ? new Date(parseInt(lastMessage.internalDate)).toISOString()
        : new Date().toISOString(),
      threadSnippet: lastMessage?.snippet || '',
      isReply,
      originalSender,
      webhookReceivedAt,
    };
  }

  /**
   * Extract email address from header value (handles "Name <email>" format)
   * @param headerValue - Email header value
   * @returns Clean email address
   */
  private extractEmailAddress(headerValue: string): string {
    const emailMatch = headerValue.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      return emailMatch[1];
    }
    return headerValue.trim();
  }

  /**
   * Create service instance from refresh token
   * @param refreshToken - Gmail refresh token
   * @returns Service instance
   */
  static fromRefreshToken(refreshToken: string): GmailReplyService {
    return new GmailReplyService(refreshToken);
  }
}
