# Email Reply Tracking - Examples and Usage

This directory contains examples and documentation for using the email reply tracking system.

## Overview

The email reply tracking system provides comprehensive tracking of email replies for both Gmail and Outlook/Microsoft Graph. It uses webhooks and push notifications to detect replies in real-time and matches them to original campaign messages.

## Architecture Components

### Core Components

1. **EmailReplyTracker** - Core logic for processing inbound emails and matching them to threads
2. **GmailReplyTracker** - Gmail-specific implementation using Gmail API and Pub/Sub
3. **OutlookReplyTracker** - Outlook-specific implementation using Microsoft Graph webhooks
4. **ReplyTrackingOrchestrator** - High-level orchestrator that combines email sending with reply tracking

### Database Schema

- **email_threads** - Tracks conversation threads between campaigns and contacts
- **inbound_messages** - Stores all inbound emails with reply matching information
- **webhook_subscriptions** - Manages active webhook subscriptions for both providers

## Setup Instructions

### 1. Environment Variables

```bash
# Google Cloud Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CLOUD_PROJECT_ID=your_project_id

# Microsoft Graph Configuration
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret

# Webhook Configuration
WEBHOOK_BASE_URL=https://your-domain.com
DOMAIN=your-domain.com
```

### 2. Google Cloud Pub/Sub Setup

1. Create a Pub/Sub topic in your Google Cloud project:
```bash
gcloud pubsub topics create gmail-notifications
```

2. Create a push subscription:
```bash
gcloud pubsub subscriptions create gmail-webhook-sub \
  --topic=gmail-notifications \
  --push-endpoint=https://your-domain.com/api/webhooks/gmail/notifications
```

3. Grant Gmail API the necessary permissions to publish to your topic.

### 3. Microsoft Graph Webhook Setup

Microsoft Graph webhooks are set up automatically through the API. Ensure your webhook endpoint is publicly accessible and can handle validation requests.

## Usage Examples

### Basic Email Sending with Reply Tracking

```typescript
import { replyTrackingOrchestrator } from '@/libs/email/reply-tracking/ReplyTrackingOrchestrator';

// Send an email with reply tracking enabled
const result = await replyTrackingOrchestrator.sendEmailWithReplyTracking(userId, {
  tenantId: 'tenant-123',
  campaignId: 'campaign-123',
  nodeId: 'node-123',
  outboundMessageId: 'msg-123',
  dedupeKey: 'unique-key',
  from: 'sales@company.com',
  to: 'customer@example.com',
  subject: 'Follow up on your inquiry',
  html: '<p>Thank you for your interest...</p>',
  text: 'Thank you for your interest...',
  enableReplyTracking: true, // Enable reply tracking
});

console.log('Email sent with tracking:', {
  providerMessageId: result.providerMessageId,
  threadId: result.threadId,
});
```

### Setting Up Push Notifications

```typescript
import { replyTrackingOrchestrator } from '@/libs/email/reply-tracking/ReplyTrackingOrchestrator';

// Set up Gmail push notifications
await replyTrackingOrchestrator.setupPushNotifications(userId, 'google');

// Set up Outlook change notifications
await replyTrackingOrchestrator.setupPushNotifications(userId, 'microsoft');
```

### Processing Inbound Emails Manually

```typescript
import { emailReplyTracker } from '@/libs/email/reply-tracking/EmailReplyTracker';

const inboundEmail = {
  providerMessageId: 'reply-msg-456',
  fromEmail: 'customer@example.com',
  toEmail: 'sales@company.com',
  subject: 'Re: Follow up on your inquiry',
  bodyText: 'Thanks for the follow up!',
  inReplyTo: '<msg-123@company.com>',
  receivedAt: new Date(),
};

const result = await emailReplyTracker.processInboundEmail(inboundEmail);

if (result.threadMatch.isReply) {
  console.log('Reply detected!', {
    matchMethod: result.threadMatch.matchMethod,
    confidence: result.threadMatch.confidence,
    campaignId: result.threadMatch.campaignId,
  });
}
```

## Webhook Endpoints

### Gmail Webhook
- **URL**: `POST /api/webhooks/gmail/notifications`
- **Purpose**: Receives Google Cloud Pub/Sub notifications when new emails arrive
- **Authentication**: Google Cloud Pub/Sub signature verification

### Outlook Webhook
- **URL**: `POST /api/webhooks/outlook/notifications`
- **Purpose**: Receives Microsoft Graph change notifications
- **Authentication**: Microsoft Graph validation token

### Generic Email Webhook
- **URL**: `POST /api/webhooks/email/replies`
- **Purpose**: Testing endpoint for custom email integrations

## Reply Matching Logic

The system uses multiple methods to match replies to original messages, in order of confidence:

1. **Message-ID Matching (High Confidence)**
   - Uses RFC 2822 In-Reply-To header
   - Parses References header for message chains

2. **Provider Thread ID (Medium Confidence)**
   - Gmail: Uses Gmail thread ID
   - Outlook: Uses conversation ID

3. **Subject Line Matching (Low Confidence)**
   - Fallback method using cleaned subject lines
   - Matches against recent outbound messages

## Monitoring and Maintenance

### Subscription Renewal

Both Gmail and Outlook subscriptions have expiration times:

- **Gmail**: Maximum 7 days
- **Outlook**: Maximum 4230 minutes (~70 hours)

The system should implement automatic renewal:

```typescript
// Example renewal job
async function renewExpiredSubscriptions() {
  const expiredSubscriptions = await db
    .select()
    .from(webhookSubscriptions)
    .where(and(
      eq(webhookSubscriptions.status, 'active'),
      lt(webhookSubscriptions.expiresAt, new Date())
    ));

  for (const subscription of expiredSubscriptions) {
    try {
      if (subscription.provider === 'google') {
        const gmailTracker = new GmailReplyTracker(refreshToken);
        await gmailTracker.renewPushNotifications(subscription.userId, subscription.mailAccountId);
      } else if (subscription.provider === 'microsoft') {
        const outlookTracker = new OutlookReplyTracker(refreshToken);
        await outlookTracker.renewChangeNotifications(subscription.userId, subscription.mailAccountId);
      }
    } catch (error) {
      console.error('Failed to renew subscription:', error);
    }
  }
}
```

## Error Handling

The system includes comprehensive error handling:

1. **Webhook Failures**: Logged and tracked in webhook_deliveries table
2. **Token Expiration**: Automatic token refresh with fallback
3. **Rate Limiting**: Exponential backoff for API calls
4. **Partial Failures**: Continue processing other notifications even if one fails

## Testing

### Unit Tests
```bash
npm test -- --testPathPattern=EmailReplyTracker
```

### Integration Testing
```bash
# Test webhook endpoints
curl -X POST http://localhost:3000/api/webhooks/email/replies \
  -H "Content-Type: application/json" \
  -d '{
    "providerMessageId": "test-123",
    "fromEmail": "test@example.com",
    "toEmail": "sales@company.com",
    "subject": "Test reply",
    "bodyText": "This is a test reply"
  }'
```

## Performance Considerations

1. **Database Indexing**: Ensure proper indexes on message IDs and thread IDs
2. **Webhook Processing**: Use queues for high-volume webhook processing
3. **Cleanup**: Regular cleanup of old inbound messages and expired subscriptions
4. **Caching**: Cache frequently accessed thread information

## Security

1. **Webhook Validation**: Always verify webhook signatures
2. **Token Security**: Encrypt refresh tokens in database
3. **Rate Limiting**: Implement rate limiting on webhook endpoints
4. **Access Control**: Restrict webhook endpoints to authorized sources

## Troubleshooting

### Common Issues

1. **Webhooks Not Received**
   - Check webhook URL accessibility
   - Verify subscription status
   - Check firewall/proxy settings

2. **Replies Not Matched**
   - Verify Message-ID headers are present
   - Check thread creation for outbound messages
   - Review matching logic for edge cases

3. **Token Expiration**
   - Implement automatic token refresh
   - Monitor token status in logs
   - Set up alerts for token failures