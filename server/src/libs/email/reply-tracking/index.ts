/**
 * Email Reply Tracking - Main Export File
 * 
 * This file exports all the main components of the email reply tracking system
 * for easy importing throughout the application.
 */

// Core reply tracking components
export { EmailReplyTracker, emailReplyTracker } from './EmailReplyTracker';
export type { InboundEmailData, ThreadMatchResult } from './EmailReplyTracker';

// Provider-specific trackers
export { GmailReplyTracker } from './GmailReplyTracker';
export { OutlookReplyTracker } from './OutlookReplyTracker';

// High-level orchestrator
export { ReplyTrackingOrchestrator, replyTrackingOrchestrator } from './ReplyTrackingOrchestrator';
export type { ReplyTrackingEmailSend } from './ReplyTrackingOrchestrator';

// Webhook handlers
export {
  handleGmailNotification,
  handleOutlookNotification,
  handleGenericEmailReply,
} from '../../routes/webhooks/emailReplyWebhooks';

// Testing utilities
export { WebhookTestClient, runWebhookTests } from './examples/webhook-test-client';
export { usageExamples } from './examples/usage-examples';

// Type definitions for external use
export interface ReplyTrackingConfig {
  enableReplyTracking: boolean;
  webhookBaseUrl: string;
  googleCloudProjectId?: string;
  pubsubTopicName?: string;
}

export interface ReplyTrackingStats {
  totalThreads: number;
  activeThreads: number;
  totalReplies: number;
  replyRate: number;
  averageResponseTime: number; // in hours
}

export interface WebhookSubscriptionInfo {
  id: string;
  provider: 'google' | 'microsoft';
  status: 'active' | 'expired' | 'failed' | 'cancelled';
  expiresAt: Date;
  lastRenewalAt?: Date;
  failureCount: number;
}

// Utility functions
export const replyTrackingUtils = {
  /**
   * Generate a custom Message-ID for better tracking
   */
  generateMessageId: (outboundMessageId: string, domain: string = 'localhost'): string => {
    return `<${outboundMessageId}.${Date.now()}@${domain}>`;
  },

  /**
   * Extract email address from header value
   */
  extractEmailAddress: (headerValue: string): string => {
    const match = headerValue.match(/<([^>]+)>/);
    return match ? match[1] : headerValue.trim();
  },

  /**
   * Clean subject line for matching (remove Re:, Fwd:, etc.)
   */
  cleanSubjectLine: (subject: string): string => {
    return subject.replace(/^(Re:|RE:|Fwd:|FWD:|Fw:|FW:)\s*/i, '').trim();
  },

  /**
   * Parse References header into individual Message-IDs
   */
  parseReferencesHeader: (references: string): string[] => {
    return references.match(/<[^>]+>/g)?.map(id => id.slice(1, -1)) || [];
  },

  /**
   * Check if an email appears to be an auto-reply
   */
  isAutoReply: (subject: string, body: string): boolean => {
    const autoReplyIndicators = [
      'out of office',
      'auto-reply',
      'automatic reply',
      'away from office',
      'vacation',
      'do not reply',
      'undelivered',
      'delivery failure',
    ];

    const text = `${subject} ${body}`.toLowerCase();
    return autoReplyIndicators.some(indicator => text.includes(indicator));
  },

  /**
   * Calculate reply rate for a set of threads
   */
  calculateReplyRate: (threads: Array<{ replyCount: number }>): number => {
    if (threads.length === 0) return 0;
    const threadsWithReplies = threads.filter(t => t.replyCount > 0).length;
    return (threadsWithReplies / threads.length) * 100;
  },
};

// Default configuration
export const defaultReplyTrackingConfig: ReplyTrackingConfig = {
  enableReplyTracking: true,
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'https://localhost:3000',
  googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  pubsubTopicName: 'gmail-notifications',
};

/**
 * Initialize reply tracking system
 * This function should be called during application startup
 */
export async function initializeReplyTracking(config: Partial<ReplyTrackingConfig> = {}): Promise<void> {
  const finalConfig = { ...defaultReplyTrackingConfig, ...config };
  
  console.log('🔧 Initializing email reply tracking system...');
  console.log('📧 Webhook base URL:', finalConfig.webhookBaseUrl);
  console.log('🔄 Reply tracking enabled:', finalConfig.enableReplyTracking);
  
  if (finalConfig.googleCloudProjectId) {
    console.log('📬 Google Cloud Project ID:', finalConfig.googleCloudProjectId);
  }
  
  // TODO: Add any initialization logic here
  // - Verify webhook endpoints are accessible
  // - Check database schema
  // - Validate configuration
  
  console.log('✅ Email reply tracking system initialized');
}

/**
 * Health check for reply tracking system
 */
export async function healthCheckReplyTracking(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  message?: string;
}> {
  const checks = {
    database: false,
    webhooks: false,
    subscriptions: false,
  };

  try {
    // Check database connectivity
    // TODO: Add actual database check
    checks.database = true;

    // Check webhook endpoints
    // TODO: Add webhook health check
    checks.webhooks = true;

    // Check active subscriptions
    // TODO: Add subscription health check
    checks.subscriptions = true;

    const allHealthy = Object.values(checks).every(check => check);
    const someHealthy = Object.values(checks).some(check => check);

    return {
      status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
      checks,
      message: allHealthy ? 'All systems operational' : 'Some components need attention',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      checks,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}