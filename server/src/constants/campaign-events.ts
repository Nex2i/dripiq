/**
 * Campaign Event Type Constants
 *
 * This file centralizes all event type strings used throughout the campaign system
 * to prevent typos and ensure consistency between different parts of the codebase.
 */

/**
 * SendGrid webhook event types (raw from SendGrid)
 */
export const SENDGRID_EVENT_TYPES = {
  DELIVERED: 'delivered',
  BOUNCE: 'bounce',
  DEFERRED: 'deferred',
  DROPPED: 'dropped',
  OPEN: 'open',
  CLICK: 'click',
  SPAM_REPORT: 'spam_report',
  UNSUBSCRIBE: 'unsubscribe',
  GROUP_UNSUBSCRIBE: 'group_unsubscribe',
  GROUP_RESUBSCRIBE: 'group_resubscribe',
} as const;

/**
 * Campaign plan event types (used in transitions)
 * These are the normalized event names used in campaign plan transitions
 */
export const CAMPAIGN_EVENT_TYPES = {
  // Engagement events
  OPENED: 'opened',
  CLICKED: 'clicked',

  // Delivery events
  DELIVERED: 'delivered',
  BOUNCE: 'bounce',
  DROPPED: 'dropped',
  DEFERRED: 'deferred',

  // Negative events (timeouts)
  NO_OPEN: 'no_open',
  NO_CLICK: 'no_click',

  // Other events
  SPAM: 'spam',
  UNSUBSCRIBE: 'unsubscribe',
} as const;

/**
 * Event type normalization mapping
 * Maps SendGrid webhook event types to campaign plan event types
 */
export const EVENT_TYPE_NORMALIZATION_MAP: Record<string, string> = {
  // SendGrid -> Campaign Plan mappings
  [SENDGRID_EVENT_TYPES.OPEN]: CAMPAIGN_EVENT_TYPES.OPENED,
  [SENDGRID_EVENT_TYPES.CLICK]: CAMPAIGN_EVENT_TYPES.CLICKED,
  [SENDGRID_EVENT_TYPES.DELIVERED]: CAMPAIGN_EVENT_TYPES.DELIVERED,
  [SENDGRID_EVENT_TYPES.BOUNCE]: CAMPAIGN_EVENT_TYPES.BOUNCE,
  [SENDGRID_EVENT_TYPES.DROPPED]: CAMPAIGN_EVENT_TYPES.DROPPED,
  [SENDGRID_EVENT_TYPES.DEFERRED]: CAMPAIGN_EVENT_TYPES.DEFERRED,
  [SENDGRID_EVENT_TYPES.SPAM_REPORT]: CAMPAIGN_EVENT_TYPES.SPAM,
  [SENDGRID_EVENT_TYPES.UNSUBSCRIBE]: CAMPAIGN_EVENT_TYPES.UNSUBSCRIBE,
} as const;

/**
 * Events that should not trigger campaign transitions
 * These events are processed for tracking but don't cause state changes
 */
export const IGNORED_TRANSITION_EVENTS = [
  SENDGRID_EVENT_TYPES.CLICK, // Clicks are tracked but don't trigger automatic transitions in current system
] as const;

/**
 * Timeout event types that can be generated synthetically
 */
export const TIMEOUT_EVENT_TYPES = [
  CAMPAIGN_EVENT_TYPES.NO_OPEN,
  CAMPAIGN_EVENT_TYPES.NO_CLICK,
] as const;

/**
 * Helper function to normalize event types for campaign transitions
 * @param eventType - The raw event type from webhook or other source
 * @returns The normalized event type for campaign transitions
 */
export function normalizeEventTypeForCampaign(eventType: string): string {
  return EVENT_TYPE_NORMALIZATION_MAP[eventType] || eventType;
}

/**
 * Helper function to check if an event type should trigger campaign transitions
 * @param eventType - The event type to check
 * @returns True if the event should trigger transitions
 */
export function shouldTriggerCampaignTransition(eventType: string): boolean {
  return !IGNORED_TRANSITION_EVENTS.includes(eventType as any);
}

/**
 * Helper function to check if an event type is a timeout event
 * @param eventType - The event type to check
 * @returns True if the event is a timeout event
 */
export function isTimeoutEvent(eventType: string): boolean {
  return TIMEOUT_EVENT_TYPES.includes(eventType as any);
}
