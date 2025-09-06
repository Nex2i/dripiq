# Email Reply Tracking Webhooks - Proof of Concept

This is a bare-bones proof of concept for email reply tracking webhooks that work with both Gmail and Outlook.

## Endpoints

### Gmail Webhook
- **URL**: `POST /api/webhooks/email-reply/gmail/notifications`
- **Purpose**: Receives Google Cloud Pub/Sub notifications when new emails arrive in Gmail
- **Payload**: Google Cloud Pub/Sub message format

### Outlook Webhook  
- **URL**: `POST /api/webhooks/email-reply/outlook/notifications`
- **Purpose**: Receives Microsoft Graph change notifications when new emails arrive in Outlook
- **Payload**: Microsoft Graph change notification format

### Health Check
- **URL**: `GET /api/webhooks/email-reply/health`
- **Purpose**: Check if webhook endpoints are running

## Current Functionality

Both webhooks currently:
- Log all incoming requests to the console with full headers and body
- Decode and log Pub/Sub messages (Gmail)
- Handle Microsoft Graph validation requests (Outlook)
- Return success responses

## Console Output

When webhooks are triggered, you'll see detailed console output like:

```
=== Gmail Webhook Received ===
Request ID: req-1234567890-abc123
Headers: { ... }
Body: { ... }
Decoded Pub/Sub Data: { ... }
=== End Gmail Webhook ===
```

## Testing

You can test the endpoints using curl:

```bash
# Test Gmail webhook
curl -X POST http://localhost:3000/api/webhooks/email-reply/gmail/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "data": "eyJ0ZXN0IjogInRlc3QifQ==",
      "messageId": "test-123",
      "publishTime": "2024-01-01T00:00:00Z"
    },
    "subscription": "test-subscription"
  }'

# Test Outlook webhook validation
curl -X POST "http://localhost:3000/api/webhooks/email-reply/outlook/notifications?validationToken=test-token"

# Test Outlook webhook
curl -X POST http://localhost:3000/api/webhooks/email-reply/outlook/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "value": [{
      "subscriptionId": "test-sub",
      "changeType": "created",
      "resource": "/me/messages/test",
      "tenantId": "test-tenant"
    }]
  }'

# Health check
curl http://localhost:3000/api/webhooks/email-reply/health
```

## Next Steps

To make this production-ready, you would:

1. **Gmail Setup**: Configure Google Cloud Pub/Sub topic and subscription
2. **Outlook Setup**: Register Microsoft Graph application and webhook
3. **Processing Logic**: Add actual email processing and reply detection
4. **Database**: Store and track email threads and replies
5. **Authentication**: Add proper webhook verification