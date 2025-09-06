/**
 * Email Reply Tracking Usage Examples
 * 
 * This file contains practical examples of how to use the email reply tracking system
 * for both Gmail and Outlook integrations.
 */

import { replyTrackingOrchestrator } from '../ReplyTrackingOrchestrator';
import { emailReplyTracker } from '../EmailReplyTracker';
import { GmailReplyTracker } from '../GmailReplyTracker';
import { OutlookReplyTracker } from '../OutlookReplyTracker';

// ============================================================================
// Example 1: Basic Email Campaign with Reply Tracking
// ============================================================================

export async function sendCampaignEmailWithTracking() {
  const userId = 'user-123';
  const campaignData = {
    tenantId: 'tenant-abc',
    campaignId: 'campaign-xyz',
    nodeId: 'node-001',
    outboundMessageId: 'msg-' + Date.now(),
    dedupeKey: `tenant-abc:campaign-xyz:contact-456:email`,
    from: 'sales@yourcompany.com',
    to: 'prospect@example.com',
    subject: 'Introducing our new product line',
    html: `
      <div>
        <h2>Hi there!</h2>
        <p>We're excited to introduce our new product line that could help your business grow.</p>
        <p>Would you like to schedule a quick 15-minute call to discuss?</p>
        <p>Best regards,<br>Sales Team</p>
      </div>
    `,
    text: `Hi there!

We're excited to introduce our new product line that could help your business grow.

Would you like to schedule a quick 15-minute call to discuss?

Best regards,
Sales Team`,
    enableReplyTracking: true, // This is the key flag
  };

  try {
    const result = await replyTrackingOrchestrator.sendEmailWithReplyTracking(userId, campaignData);
    
    console.log('✅ Campaign email sent successfully:', {
      providerMessageId: result.providerMessageId,
      threadId: result.threadId,
      responseStatus: result.responseStatus,
    });

    return result;
  } catch (error) {
    console.error('❌ Failed to send campaign email:', error);
    throw error;
  }
}

// ============================================================================
// Example 2: Setting Up Push Notifications for New Users
// ============================================================================

export async function setupReplyTrackingForNewUser(userId: string) {
  try {
    console.log('🔧 Setting up reply tracking for user:', userId);

    // Set up Gmail push notifications
    try {
      await replyTrackingOrchestrator.setupPushNotifications(userId, 'google');
      console.log('✅ Gmail push notifications setup complete');
    } catch (gmailError) {
      console.warn('⚠️ Gmail setup failed (user may not have Gmail account):', gmailError);
    }

    // Set up Outlook change notifications
    try {
      await replyTrackingOrchestrator.setupPushNotifications(userId, 'microsoft');
      console.log('✅ Outlook change notifications setup complete');
    } catch (outlookError) {
      console.warn('⚠️ Outlook setup failed (user may not have Outlook account):', outlookError);
    }

    console.log('✅ Reply tracking setup completed for user:', userId);
  } catch (error) {
    console.error('❌ Failed to setup reply tracking:', error);
    throw error;
  }
}

// ============================================================================
// Example 3: Manual Reply Processing (for testing or custom integrations)
// ============================================================================

export async function processTestReply() {
  const testReplyData = {
    providerMessageId: 'test-reply-' + Date.now(),
    fromEmail: 'prospect@example.com',
    toEmail: 'sales@yourcompany.com',
    subject: 'Re: Introducing our new product line',
    bodyText: 'Thanks for reaching out! I\'d be interested in learning more. When would be a good time for that call?',
    bodyHtml: '<p>Thanks for reaching out! I\'d be interested in learning more. When would be a good time for that call?</p>',
    messageId: '<reply-' + Date.now() + '@example.com>',
    inReplyTo: '<msg-123456@yourcompany.com>', // This should match an existing outbound message
    receivedAt: new Date(),
    raw: {
      source: 'manual-test',
      timestamp: new Date().toISOString(),
    },
  };

  try {
    const result = await emailReplyTracker.processInboundEmail(testReplyData);

    console.log('📧 Reply processed:', {
      inboundMessageId: result.inboundMessageId,
      isReply: result.threadMatch.isReply,
      matchMethod: result.threadMatch.matchMethod,
      confidence: result.threadMatch.confidence,
    });

    if (result.threadMatch.isReply) {
      console.log('🎉 Reply matched to campaign:', {
        campaignId: result.threadMatch.campaignId,
        contactId: result.threadMatch.contactId,
        threadId: result.threadMatch.threadId,
      });
    } else {
      console.log('ℹ️ No matching thread found - this appears to be a new conversation');
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to process reply:', error);
    throw error;
  }
}

// ============================================================================
// Example 4: Gmail-Specific Operations
// ============================================================================

export async function gmailSpecificOperations(refreshToken: string, userId: string, mailAccountId: string) {
  const gmailTracker = new GmailReplyTracker(refreshToken);

  try {
    // Set up push notifications
    console.log('🔧 Setting up Gmail push notifications...');
    const setupResult = await gmailTracker.setupPushNotifications(userId, mailAccountId);
    console.log('✅ Gmail setup complete:', setupResult);

    // The system will now automatically process incoming Gmail notifications
    // via the webhook at /api/webhooks/gmail/notifications

    // Renew notifications (typically done by a background job)
    console.log('🔄 Renewing Gmail push notifications...');
    await gmailTracker.renewPushNotifications(userId, mailAccountId);
    console.log('✅ Gmail notifications renewed');

    return setupResult;
  } catch (error) {
    console.error('❌ Gmail operations failed:', error);
    throw error;
  }
}

// ============================================================================
// Example 5: Outlook-Specific Operations
// ============================================================================

export async function outlookSpecificOperations(refreshToken: string, userId: string, mailAccountId: string) {
  const outlookTracker = new OutlookReplyTracker(refreshToken);

  try {
    // Test connection first
    console.log('🔍 Testing Outlook connection...');
    const connectionTest = await outlookTracker.testConnection();
    if (!connectionTest) {
      throw new Error('Outlook connection test failed');
    }
    console.log('✅ Outlook connection successful');

    // Set up change notifications
    console.log('🔧 Setting up Outlook change notifications...');
    const setupResult = await outlookTracker.setupChangeNotifications(userId, mailAccountId);
    console.log('✅ Outlook setup complete:', setupResult);

    // The system will now automatically process incoming Outlook notifications
    // via the webhook at /api/webhooks/outlook/notifications

    // Renew notifications (typically done by a background job)
    console.log('🔄 Renewing Outlook change notifications...');
    await outlookTracker.renewChangeNotifications(userId, mailAccountId);
    console.log('✅ Outlook notifications renewed');

    return setupResult;
  } catch (error) {
    console.error('❌ Outlook operations failed:', error);
    throw error;
  }
}

// ============================================================================
// Example 6: Comprehensive Campaign Flow
// ============================================================================

export async function runCompleteCampaignFlow() {
  const userId = 'demo-user-123';
  
  try {
    console.log('🚀 Starting complete campaign flow...');

    // Step 1: Set up reply tracking for the user
    await setupReplyTrackingForNewUser(userId);

    // Step 2: Send a campaign email with tracking
    const emailResult = await sendCampaignEmailWithTracking();

    // Step 3: Simulate receiving a reply (in real scenarios, this comes via webhook)
    console.log('⏳ Simulating reply processing...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

    // Create a simulated reply that references the sent email
    const simulatedReply = {
      providerMessageId: 'simulated-reply-' + Date.now(),
      fromEmail: 'prospect@example.com',
      toEmail: 'sales@yourcompany.com',
      subject: 'Re: Introducing our new product line',
      bodyText: 'Yes, I\'d be very interested in a call. How about tomorrow at 2 PM?',
      messageId: '<reply-' + Date.now() + '@example.com>',
      inReplyTo: emailResult.providerMessageId, // Reference the sent email
      receivedAt: new Date(),
      raw: { simulatedReply: true },
    };

    const replyResult = await emailReplyTracker.processInboundEmail(simulatedReply);

    console.log('🎉 Complete campaign flow finished:', {
      emailSent: {
        providerMessageId: emailResult.providerMessageId,
        threadId: emailResult.threadId,
      },
      replyReceived: {
        isReply: replyResult.threadMatch.isReply,
        matchMethod: replyResult.threadMatch.matchMethod,
        confidence: replyResult.threadMatch.confidence,
      },
    });

    return {
      emailResult,
      replyResult,
    };
  } catch (error) {
    console.error('❌ Campaign flow failed:', error);
    throw error;
  }
}

// ============================================================================
// Example 7: Webhook Testing
// ============================================================================

export function createWebhookTestPayloads() {
  return {
    // Gmail webhook test payload
    gmail: {
      message: {
        data: Buffer.from(JSON.stringify({
          emailAddress: 'user@gmail.com',
          historyId: '12345',
        })).toString('base64'),
        messageId: 'test-message-id',
        publishTime: new Date().toISOString(),
      },
      subscription: 'projects/your-project/subscriptions/gmail-notifications',
    },

    // Outlook webhook test payload
    outlook: {
      value: [
        {
          subscriptionId: 'test-subscription-id',
          clientState: 'test-client-state',
          changeType: 'created',
          resource: '/me/mailFolders/inbox/messages/test-message-id',
          resourceData: {
            '@odata.type': '#Microsoft.Graph.Message',
            '@odata.id': '/me/messages/test-message-id',
            id: 'test-message-id',
          },
          subscriptionExpirationDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          tenantId: 'test-tenant-id',
        },
      ],
    },

    // Generic webhook test payload
    generic: {
      providerMessageId: 'test-generic-' + Date.now(),
      fromEmail: 'test@example.com',
      toEmail: 'sales@yourcompany.com',
      subject: 'Re: Test email',
      bodyText: 'This is a test reply via generic webhook',
      messageId: '<test-' + Date.now() + '@example.com>',
      inReplyTo: '<original-test-message@yourcompany.com>',
      receivedAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Usage Examples for Different Scenarios
// ============================================================================

export const usageExamples = {
  // For new user onboarding
  onboardNewUser: setupReplyTrackingForNewUser,
  
  // For sending tracked emails
  sendTrackedEmail: sendCampaignEmailWithTracking,
  
  // For processing manual/test replies
  processManualReply: processTestReply,
  
  // For complete workflow testing
  runFullWorkflow: runCompleteCampaignFlow,
  
  // For webhook testing
  getWebhookPayloads: createWebhookTestPayloads,
};

// Example of how to use in your application:
/*
import { usageExamples } from './examples/usage-examples';

// Set up reply tracking for a new user
await usageExamples.onboardNewUser('user-123');

// Send a tracked campaign email
const result = await usageExamples.sendTrackedEmail();

// Process a test reply
await usageExamples.processManualReply();
*/