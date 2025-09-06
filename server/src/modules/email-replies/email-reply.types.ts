/**
 * Email Reply Webhook Types and Interfaces
 * For handling Gmail Pub/Sub and Outlook webhook notifications
 */

// Base email thread information for logging
export interface EmailThreadLog {
  provider: 'gmail' | 'outlook';
  threadId: string;
  messageId: string;
  subject: string;
  participants: string[];
  replyCount: number;
  lastMessageAt: string;
  threadSnippet: string;
  isReply: boolean;
  originalSender?: string; // From our outbound messages
  webhookReceivedAt: string;
}

// Gmail Pub/Sub message structure
export interface GmailPubSubMessage {
  data: string; // base64 encoded
  messageId: string;
  message_id: string;
  publishTime: string;
  publish_time: string;
}

// Gmail Pub/Sub push notification payload
export interface GmailPubSubPayload {
  message: GmailPubSubMessage;
  subscription: string;
}

// Decoded Gmail Pub/Sub data
export interface GmailHistoryData {
  emailAddress: string;
  historyId: string;
}

// Gmail thread information from API
export interface GmailThreadInfo {
  id: string;
  historyId: string;
  messages: Array<{
    id: string;
    threadId: string;
    labelIds: string[];
    snippet: string;
    historyId: string;
    internalDate: string;
    payload: {
      headers: Array<{
        name: string;
        value: string;
      }>;
      body?: {
        data?: string;
      };
      parts?: Array<{
        mimeType: string;
        body?: {
          data?: string;
        };
      }>;
    };
  }>;
}

// Outlook webhook notification structure
export interface OutlookWebhookNotification {
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  tenantId: string;
  clientState?: string;
  changeType: string;
  resource: string;
  resourceData: {
    '@odata.type': string;
    '@odata.id': string;
    '@odata.etag': string;
    id: string;
  };
}

// Outlook webhook payload (array of notifications)
export interface OutlookWebhookPayload {
  value: OutlookWebhookNotification[];
}

// Outlook conversation/message information from Graph API
export interface OutlookConversationInfo {
  id: string;
  topic: string;
  hasAttachments: boolean;
  lastDeliveredDateTime: string;
  uniqueSenders: string[];
  preview: string;
  messages?: Array<{
    id: string;
    conversationId: string;
    subject: string;
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
    bodyPreview: string;
    isRead: boolean;
  }>;
}

// Error types for webhook processing
export class EmailReplyWebhookError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, code: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'EmailReplyWebhookError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Webhook processing result
export interface WebhookProcessingResult {
  success: boolean;
  provider: 'gmail' | 'outlook';
  threadsProcessed: number;
  errors: string[];
  processingTimeMs: number;
}
