import { Client } from '@microsoft/microsoft-graph-client';
import { getMicrosoftOAuth2Client } from '@/libs/thirdPartyAuth/MicrosoftAuth';
import { logger } from '@/libs/logger';
import {
  OutlookWebhookPayload,
  OutlookWebhookNotification,
  OutlookConversationInfo,
  EmailThreadLog,
  EmailReplyWebhookError,
  WebhookProcessingResult,
} from './email-reply.types';

export class OutlookReplyService {
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
          // Get fresh access token using refresh token
          const oauth2Client = getMicrosoftOAuth2Client();
          const tokenResponse = await oauth2Client.refreshToken(this.refreshToken);

          done(null, tokenResponse.access_token);
        } catch (error) {
          logger.error('Failed to refresh Microsoft access token for reply service:', error);
          done(error, null);
        }
      },
    });
  }

  /**
   * Process Outlook webhook notification
   * @param payload - Webhook payload from Microsoft Graph
   * @returns Processing result
   */
  async processOutlookWebhook(payload: OutlookWebhookPayload): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    const webhookReceivedAt = new Date().toISOString();

    try {
      logger.info('Processing Outlook webhook notifications', {
        notificationCount: payload.value.length,
        webhookReceivedAt,
      });

      if (!payload.value || payload.value.length === 0) {
        logger.info('No notifications in Outlook webhook payload');

        return {
          success: true,
          provider: 'outlook',
          threadsProcessed: 0,
          errors: [],
          processingTimeMs: Date.now() - startTime,
        };
      }

      const processedConversations = new Set<string>();
      const errors: string[] = [];

      // Process each notification
      for (const notification of payload.value) {
        try {
          await this.processNotification(notification, webhookReceivedAt, processedConversations);
        } catch (error) {
          const errorMsg = `Failed to process notification ${notification.resourceData.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          errors.push(errorMsg);
          logger.error('Error processing Outlook notification', {
            notificationId: notification.resourceData.id,
            resource: notification.resource,
            error: errorMsg,
          });
        }
      }

      const result: WebhookProcessingResult = {
        success: errors.length === 0,
        provider: 'outlook',
        threadsProcessed: processedConversations.size,
        errors,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info('Outlook webhook processing completed', result);
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Outlook webhook processing failed', {
        error: errorMessage,
        processingTimeMs: processingTime,
        notificationCount: payload.value?.length || 0,
      });

      if (error instanceof EmailReplyWebhookError) {
        throw error;
      }

      throw new EmailReplyWebhookError(
        `Outlook webhook processing failed: ${errorMessage}`,
        'OUTLOOK_PROCESSING_FAILED',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Process individual notification
   * @param notification - Single webhook notification
   * @param webhookReceivedAt - When webhook was received
   * @param processedConversations - Set to track processed conversations
   */
  private async processNotification(
    notification: OutlookWebhookNotification,
    webhookReceivedAt: string,
    processedConversations: Set<string>
  ): Promise<void> {
    logger.debug('Processing Outlook notification', {
      subscriptionId: notification.subscriptionId,
      changeType: notification.changeType,
      resource: notification.resource,
      resourceId: notification.resourceData.id,
    });

    // Only process message-related notifications
    if (!notification.resource.includes('/messages/')) {
      logger.debug('Skipping non-message notification', {
        resource: notification.resource,
      });
      return;
    }

    try {
      // Extract message ID from resource path
      const messageId = this.extractMessageId(notification.resource);
      if (!messageId) {
        logger.warn('Could not extract message ID from resource', {
          resource: notification.resource,
        });
        return;
      }

      // Get message details to find conversation
      const message = await this.getMessage(messageId);
      if (!message || !message.conversationId) {
        logger.warn('Message not found or missing conversation ID', {
          messageId,
        });
        return;
      }

      // Skip if we've already processed this conversation
      if (processedConversations.has(message.conversationId)) {
        logger.debug('Conversation already processed', {
          conversationId: message.conversationId,
        });
        return;
      }

      // Get full conversation details and log
      await this.processConversation(message.conversationId, webhookReceivedAt);
      processedConversations.add(message.conversationId);
    } catch (error) {
      logger.error('Failed to process Outlook notification', {
        notificationId: notification.resourceData.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Extract message ID from Microsoft Graph resource path
   * @param resource - Resource path from webhook
   * @returns Message ID or null
   */
  private extractMessageId(resource: string): string | null {
    // Resource format: /users/{user-id}/messages/{message-id}
    const match = resource.match(/\/messages\/([^/]+)$/);
    return match && match[1] ? match[1] : null;
  }

  /**
   * Get message details from Microsoft Graph
   * @param messageId - Message ID
   * @returns Message data
   */
  private async getMessage(messageId: string) {
    try {
      const message = await this.graphClient
        .api(`/me/messages/${messageId}`)
        .select('id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead')
        .get();

      return message;
    } catch (error) {
      logger.error('Failed to get Outlook message', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new EmailReplyWebhookError(
        'Failed to retrieve Outlook message',
        'OUTLOOK_MESSAGE_FAILED',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Process conversation and log thread information
   * @param conversationId - Outlook conversation ID
   * @param webhookReceivedAt - When webhook was received
   */
  private async processConversation(
    conversationId: string,
    webhookReceivedAt: string
  ): Promise<void> {
    try {
      // Get conversation details
      const conversation = await this.graphClient
        .api(`/me/conversations/${conversationId}`)
        .select('id,topic,hasAttachments,lastDeliveredDateTime,uniqueSenders,preview')
        .get();

      // Get messages in the conversation
      const messagesResponse = await this.graphClient
        .api(`/me/conversations/${conversationId}/threads`)
        .expand('posts($select=id,subject,from,toRecipients,receivedDateTime,bodyPreview)')
        .get();

      // Extract conversation info
      const conversationInfo: OutlookConversationInfo = {
        ...conversation,
        messages: this.extractMessagesFromThreads(messagesResponse.value),
      };

      // Extract thread information and log
      const threadLog = this.extractThreadInfo(conversationInfo, webhookReceivedAt);

      // Log the thread information
      logger.info('Outlook email thread processed', threadLog);
    } catch (error) {
      logger.error('Failed to process Outlook conversation', {
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Extract messages from conversation threads response
   * @param threads - Threads from Graph API response
   * @returns Array of messages
   */
  private extractMessagesFromThreads(threads: any[]): any[] {
    const messages: any[] = [];

    if (threads && threads.length > 0) {
      for (const thread of threads) {
        if (thread.posts && Array.isArray(thread.posts)) {
          messages.push(...thread.posts);
        }
      }
    }

    return messages;
  }

  /**
   * Extract thread information for logging
   * @param conversation - Outlook conversation data
   * @param webhookReceivedAt - When webhook was received
   * @returns Thread log data
   */
  private extractThreadInfo(
    conversation: OutlookConversationInfo,
    webhookReceivedAt: string
  ): EmailThreadLog {
    const messages = conversation.messages || [];
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    // Extract participants
    const participants = new Set<string>();

    // Add unique senders
    if (conversation.uniqueSenders) {
      conversation.uniqueSenders.forEach((sender) => {
        participants.add(sender);
      });
    }

    // Add recipients from messages
    for (const message of messages) {
      if (message.from?.emailAddress?.address) {
        participants.add(message.from.emailAddress.address);
      }
      if (message.toRecipients) {
        message.toRecipients.forEach((recipient: any) => {
          if (recipient.emailAddress?.address) {
            participants.add(recipient.emailAddress.address);
          }
        });
      }
    }

    // Check if this is a reply (more than one message)
    const isReply = messages.length > 1;

    // Try to identify original sender (first message sender)
    let originalSender: string | undefined;
    if (messages.length > 0) {
      const firstMessage = messages[0];
      if (firstMessage?.from?.emailAddress?.address) {
        originalSender = firstMessage.from.emailAddress.address;
      }
    }

    return {
      provider: 'outlook',
      threadId: conversation.id,
      messageId: lastMessage?.id || '',
      subject: conversation.topic || '',
      participants: Array.from(participants),
      replyCount: messages.length,
      lastMessageAt: conversation.lastDeliveredDateTime || new Date().toISOString(),
      threadSnippet: conversation.preview || '',
      isReply,
      originalSender,
      webhookReceivedAt,
    };
  }

  /**
   * Validate Outlook webhook signature (if client state is configured)
   * @param payload - Raw payload string
   * @param headers - Request headers
   * @returns True if valid
   */
  static validateWebhookSignature(
    payload: string,
    _headers: Record<string, string | string[] | undefined>
  ): boolean {
    const clientState = process.env.OUTLOOK_WEBHOOK_CLIENT_STATE;

    // If no client state is configured, skip validation
    if (!clientState) {
      logger.debug('No Outlook webhook client state configured, skipping signature validation');
      return true;
    }

    try {
      const parsedPayload = JSON.parse(payload);

      // Check if any notification has the expected client state
      if (parsedPayload.value && Array.isArray(parsedPayload.value)) {
        return parsedPayload.value.some(
          (notification: any) => notification.clientState === clientState
        );
      }

      return false;
    } catch (error) {
      logger.error('Failed to validate Outlook webhook signature', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Create service instance from refresh token
   * @param refreshToken - Outlook refresh token
   * @returns Service instance
   */
  static fromRefreshToken(refreshToken: string): OutlookReplyService {
    return new OutlookReplyService(refreshToken);
  }
}
