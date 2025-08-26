/**
 * SendGrid Webhook Event Types and Interfaces
 * Based on SendGrid Event Webhook API v3
 * https://docs.sendgrid.com/for-developers/tracking-events/event
 */

// SendGrid Event Types
export type SendGridEventType =
  | 'delivered'
  | 'bounce'
  | 'deferred'
  | 'dropped'
  | 'open'
  | 'click'
  | 'spam_report'
  | 'unsubscribe'
  | 'group_unsubscribe'
  | 'group_resubscribe';

// SendGrid Bounce Types
export type SendGridBounceType = 'hard' | 'soft';

// SendGrid Drop Reasons
export type SendGridDropReason =
  | 'Invalid SMTPAPI header'
  | 'Spam Content (if spam checker app enabled)'
  | 'Unsubscribed Address'
  | 'Bounced Address'
  | 'Spam Reporting Address'
  | 'Invalid'
  | 'Recipient List over Package Quota';

// Base SendGrid Event Interface
export interface SendGridEventBase {
  email: string;
  timestamp: number;
  'smtp-id'?: string; // Optional - not always present in all event types (especially opens/clicks)
  event: SendGridEventType;
  category?: string[];
  sg_event_id: string;
  sg_message_id: string;
  useragent?: string;
  ip?: string;

  // Custom arguments (our internal tracking data)
  tenant_id?: string;
  campaign_id?: string;
  node_id?: string;
  outbound_message_id?: string;
  dedupe_key?: string;
}

// Delivery Event
export interface SendGridDeliveredEvent extends SendGridEventBase {
  event: 'delivered';
  response: string;
}

// Bounce Event
export interface SendGridBounceEvent extends SendGridEventBase {
  event: 'bounce';
  reason: string;
  status: string;
  type: SendGridBounceType;
}

// Deferred Event
export interface SendGridDeferredEvent extends SendGridEventBase {
  event: 'deferred';
  response: string;
  attempt: string;
}

// Dropped Event
export interface SendGridDroppedEvent extends SendGridEventBase {
  event: 'dropped';
  reason: SendGridDropReason;
}

// Open Event
export interface SendGridOpenEvent extends SendGridEventBase {
  event: 'open';
  useragent: string;
  ip: string;
}

// Click Event
export interface SendGridClickEvent extends SendGridEventBase {
  event: 'click';
  url: string;
  useragent: string;
  ip: string;
}

// Spam Report Event
export interface SendGridSpamReportEvent extends SendGridEventBase {
  event: 'spam_report';
}

// Unsubscribe Event
export interface SendGridUnsubscribeEvent extends SendGridEventBase {
  event: 'unsubscribe';
}

// Group Unsubscribe Event
export interface SendGridGroupUnsubscribeEvent extends SendGridEventBase {
  event: 'group_unsubscribe';
  asm_group_id: number;
}

// Group Resubscribe Event
export interface SendGridGroupResubscribeEvent extends SendGridEventBase {
  event: 'group_resubscribe';
  asm_group_id: number;
}

// Union type for all SendGrid events
export type SendGridEvent =
  | SendGridDeliveredEvent
  | SendGridBounceEvent
  | SendGridDeferredEvent
  | SendGridDroppedEvent
  | SendGridOpenEvent
  | SendGridClickEvent
  | SendGridSpamReportEvent
  | SendGridUnsubscribeEvent
  | SendGridGroupUnsubscribeEvent
  | SendGridGroupResubscribeEvent;

// SendGrid Webhook Payload (array of events)
export interface SendGridWebhookPayload extends Array<SendGridEvent> {}

// Webhook Request Headers
export interface SendGridWebhookHeaders {
  'x-twilio-email-event-webhook-signature': string;
  'x-twilio-email-event-webhook-timestamp': string;
  'content-type': 'application/json';
  'user-agent': string;
}

// Signature Verification Data
export interface SendGridSignatureVerification {
  signature: string;
  timestamp: string;
  payload: string;
  isValid: boolean;
  error?: string;
}

// Processed Event Result
export interface ProcessedEventResult {
  success: boolean;
  eventId: string;
  eventType: SendGridEventType;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

// Webhook Processing Result
export interface WebhookProcessingResult {
  success: boolean;
  webhookDeliveryId: string;
  processedEvents: ProcessedEventResult[];
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  skippedEvents: number;
  errors: string[];
}

// Event Normalization Mapping
export interface EventNormalizationMapping {
  sendgridType: SendGridEventType;
  normalizedType: string; // Maps to messageEvents.type
  shouldCreateMessageEvent: boolean;
  priority: number; // For handling duplicate events
}

// Configuration
export interface SendGridWebhookConfig {
  enabled: boolean;
  webhookSecret: string;
  maxTimestampAge: number; // in seconds
  allowedIPs?: string[];
  maxPayloadSize: number; // in bytes
  enableDuplicateDetection: boolean;
  batchProcessing: boolean;
}

// Error types
export class SendGridWebhookError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, code: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'SendGridWebhookError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Validation schemas
export const SENDGRID_EVENT_TYPES: SendGridEventType[] = [
  'delivered',
  'bounce',
  'deferred',
  'dropped',
  'open',
  'click',
  'spam_report',
  'unsubscribe',
  'group_unsubscribe',
  'group_resubscribe',
];

// Known SendGrid events that we don't record but should not trigger warnings
export const KNOWN_SENDGRID_EVENTS_NOT_RECORDED: string[] = [
  'processed', // Email received by SendGrid and queued for delivery
];

// All known SendGrid events (recorded + non-recorded) for validation
export const ALL_KNOWN_SENDGRID_EVENTS: string[] = [
  ...SENDGRID_EVENT_TYPES,
  ...KNOWN_SENDGRID_EVENTS_NOT_RECORDED,
];

export const EVENT_NORMALIZATION_MAP: Record<SendGridEventType, EventNormalizationMapping> = {
  delivered: {
    sendgridType: 'delivered',
    normalizedType: 'delivered',
    shouldCreateMessageEvent: true,
    priority: 1,
  },
  bounce: {
    sendgridType: 'bounce',
    normalizedType: 'bounce',
    shouldCreateMessageEvent: true,
    priority: 2,
  },
  deferred: {
    sendgridType: 'deferred',
    normalizedType: 'deferred',
    shouldCreateMessageEvent: false, // Don't create events for temporary deferrals
    priority: 0,
  },
  dropped: {
    sendgridType: 'dropped',
    normalizedType: 'dropped',
    shouldCreateMessageEvent: true,
    priority: 3,
  },
  open: {
    sendgridType: 'open',
    normalizedType: 'open',
    shouldCreateMessageEvent: true,
    priority: 1,
  },
  click: {
    sendgridType: 'click',
    normalizedType: 'click',
    shouldCreateMessageEvent: true,
    priority: 1,
  },
  spam_report: {
    sendgridType: 'spam_report',
    normalizedType: 'spam',
    shouldCreateMessageEvent: true,
    priority: 2,
  },
  unsubscribe: {
    sendgridType: 'unsubscribe',
    normalizedType: 'unsubscribe',
    shouldCreateMessageEvent: true,
    priority: 2,
  },
  group_unsubscribe: {
    sendgridType: 'group_unsubscribe',
    normalizedType: 'unsubscribe',
    shouldCreateMessageEvent: true,
    priority: 2,
  },
  group_resubscribe: {
    sendgridType: 'group_resubscribe',
    normalizedType: 'resubscribe',
    shouldCreateMessageEvent: true,
    priority: 1,
  },
};
