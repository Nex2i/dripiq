# SendGrid Webhook Events System

This document describes the complete SendGrid webhook events system implementation, including setup, configuration, API endpoints, and monitoring.

## Overview

The SendGrid webhook system captures and processes all email events from SendGrid's Event Webhook API, providing:

- ✅ **Complete Event Tracking**: All SendGrid event types (delivered, bounce, open, click, etc.)
- ✅ **Security**: HMAC-SHA256 signature verification with timestamp validation
- ✅ **Reliability**: Duplicate detection, batch processing, and error handling
- ✅ **Monitoring**: Comprehensive logging and health checks
- ✅ **Scalability**: Rate limiting and configurable processing options

## Architecture

```
SendGrid → Webhook Endpoint → Signature Validation → Raw Storage → 
Event Processing → Normalization → MessageEvents Creation → Status Updates
```

### Components

1. **SendGrid Webhook Route** (`/webhooks/sendgrid/events`)
   - Receives webhook requests from SendGrid
   - Validates signatures and headers
   - Rate limiting and security checks

2. **SendGrid Webhook Service**
   - Processes webhook payloads
   - Normalizes events to internal format
   - Handles batch processing and duplicates

3. **SendGrid Webhook Validator**
   - HMAC-SHA256 signature verification
   - Timestamp validation (replay attack protection)
   - Configuration validation

4. **Data Storage**
   - `webhook_deliveries`: Raw webhook archive
   - `message_events`: Normalized event records

## Setup Instructions

### 1. Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# SendGrid API Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here

# SendGrid Webhook Configuration
SENDGRID_WEBHOOK_SECRET=your_sendgrid_webhook_secret_here_minimum_16_chars
SENDGRID_WEBHOOK_ENABLED=true
SENDGRID_WEBHOOK_MAX_AGE=600
SENDGRID_WEBHOOK_DUPLICATE_DETECTION=true
SENDGRID_WEBHOOK_BATCH_PROCESSING=true
SENDGRID_WEBHOOK_ALLOWED_IPS=
```

### 2. SendGrid Configuration

1. **Log in to SendGrid Console**
   - Navigate to Settings → Mail Settings → Event Webhooks

2. **Create Event Webhook**
   - **HTTP POST URL**: `https://your-domain.com/api/webhooks/sendgrid/events`
   - **Select Events**: Choose all events you want to track:
     - Delivery Events: `delivered`, `bounce`, `deferred`, `dropped`
     - Engagement Events: `open`, `click`, `spam_report`, `unsubscribe`
     - Group Events: `group_unsubscribe`, `group_resubscribe`

3. **Configure Security**
   - Enable "Signed Event Webhook"
   - Generate a webhook verification key (minimum 16 characters)
   - Use this key as `SENDGRID_WEBHOOK_SECRET`

4. **Test Configuration**
   - Use SendGrid's "Test Your Integration" feature
   - Monitor logs for successful processing

### 3. Webhook Secret Generation

Generate a secure webhook secret:

```bash
# Generate a random 32-character secret
openssl rand -base64 32
```

### 4. IP Allowlisting (Optional)

For additional security, restrict webhook requests to SendGrid's IPs:

```bash
SENDGRID_WEBHOOK_ALLOWED_IPS=167.89.118.0/24,167.89.119.0/24
```

## API Endpoints

### Webhook Event Processor

**POST** `/api/webhooks/sendgrid/events`

Processes SendGrid webhook events.

**Headers:**
- `x-twilio-email-event-webhook-signature`: HMAC-SHA256 signature
- `x-twilio-email-event-webhook-timestamp`: Unix timestamp
- `content-type`: application/json

**Request Body:**
```json
[
  {
    "email": "recipient@example.com",
    "timestamp": 1234567890,
    "smtp-id": "<smtp-id>",
    "event": "delivered",
    "category": ["campaign"],
    "sg_event_id": "unique-event-id",
    "sg_message_id": "message-id",
    "tenant_id": "tenant-123",
    "campaign_id": "campaign-456",
    "outbound_message_id": "message-789",
    "response": "250 OK"
  }
]
```

**Response:**
```json
{
  "success": true,
  "webhookDeliveryId": "webhook-delivery-123",
  "totalEvents": 1,
  "successfulEvents": 1,
  "failedEvents": 0,
  "skippedEvents": 0,
  "errors": []
}
```

**Error Responses:**
- `400`: Invalid payload or missing headers
- `401`: Invalid signature
- `403`: IP not allowed
- `413`: Payload too large
- `429`: Rate limit exceeded
- `500`: Internal server error

### Health Check

**GET** `/api/webhooks/sendgrid/health`

Returns webhook endpoint health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "sendgrid-webhook"
}
```

### Configuration Test (Authenticated)

**GET** `/api/webhooks/sendgrid/config/test`

Tests webhook configuration (requires authentication).

**Response:**
```json
{
  "configured": true,
  "secretConfigured": true,
  "enabled": true,
  "rateLimitConfigured": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Recent Deliveries (Authenticated)

**GET** `/api/webhooks/sendgrid/deliveries/recent?limit=10`

Lists recent webhook deliveries for debugging (requires authentication).

**Response:**
```json
[
  {
    "id": "webhook-delivery-123",
    "eventType": "delivered",
    "status": "processed",
    "receivedAt": "2024-01-01T00:00:00.000Z",
    "totalEvents": 1,
    "provider": "sendgrid"
  }
]
```

## Event Types and Processing

### Supported Event Types

| Event Type | Description | Creates MessageEvent | Priority |
|------------|-------------|---------------------|----------|
| `delivered` | Message successfully delivered | ✅ | 1 |
| `bounce` | Message bounced (hard/soft) | ✅ | 2 |
| `deferred` | Temporary delivery delay | ❌ | 0 |
| `dropped` | Message dropped by SendGrid | ✅ | 3 |
| `open` | Recipient opened email | ✅ | 1 |
| `click` | Recipient clicked link | ✅ | 1 |
| `spam_report` | Marked as spam | ✅ | 2 |
| `unsubscribe` | Recipient unsubscribed | ✅ | 2 |
| `group_unsubscribe` | Unsubscribed from group | ✅ | 2 |
| `group_resubscribe` | Resubscribed to group | ✅ | 1 |

### Event Processing Flow

1. **Signature Verification**: Validate HMAC-SHA256 signature
2. **Payload Parsing**: Parse and validate JSON events
3. **Tenant Extraction**: Determine tenant from custom args
4. **Raw Storage**: Store complete webhook in `webhook_deliveries`
5. **Event Processing**: Process each event individually
6. **Duplicate Detection**: Check for existing events (optional)
7. **Normalization**: Convert to internal `message_events` format
8. **Status Update**: Update webhook delivery status

### Custom Arguments Integration

The system extracts tenant and campaign information from SendGrid's custom arguments:

```json
{
  "tenant_id": "tenant-123",
  "campaign_id": "campaign-456", 
  "node_id": "node-789",
  "outbound_message_id": "message-abc",
  "dedupe_key": "unique-key"
}
```

These are automatically included when sending emails through the existing SendGrid client.

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SENDGRID_WEBHOOK_SECRET` | - | **Required**: Webhook signing secret (min 16 chars) |
| `SENDGRID_WEBHOOK_ENABLED` | `true` | Enable/disable webhook processing |
| `SENDGRID_WEBHOOK_MAX_AGE` | `600` | Max timestamp age in seconds (60-3600) |
| `SENDGRID_WEBHOOK_DUPLICATE_DETECTION` | `true` | Enable duplicate event detection |
| `SENDGRID_WEBHOOK_BATCH_PROCESSING` | `true` | Process events in parallel |
| `SENDGRID_WEBHOOK_ALLOWED_IPS` | - | Comma-separated allowed IP ranges |

### Rate Limiting

- **Default**: 1000 requests per minute per IP
- **Configurable**: Via Fastify rate-limit plugin
- **Response**: 429 status with retry-after header

### Request Limits

- **Body Size**: 5MB maximum
- **Timeout**: Standard Fastify timeout
- **Headers**: Required signature and timestamp headers

## Monitoring and Logging

### Structured Logging

All webhook events are logged with structured data:

```json
{
  "level": "info",
  "msg": "SendGrid webhook processed successfully",
  "requestId": "req-123",
  "tenantId": "tenant-456",
  "totalEvents": 2,
  "successfulEvents": 2,
  "processingTimeMs": 45
}
```

### Key Log Events

- **Webhook Received**: Request details and validation status
- **Signature Verification**: Success/failure with details
- **Event Processing**: Individual event results
- **Error Handling**: Detailed error information
- **Performance**: Processing time and metrics

### Health Monitoring

Monitor these metrics for webhook health:

1. **Success Rate**: Percentage of successfully processed webhooks
2. **Processing Time**: Average webhook processing duration
3. **Error Rate**: Failed webhook processing attempts
4. **Duplicate Rate**: Percentage of duplicate events detected
5. **Event Volume**: Number of events processed per time period

### Database Queries

Monitor webhook-related database operations:

```sql
-- Recent webhook deliveries
SELECT * FROM webhook_deliveries 
WHERE provider = 'sendgrid' 
ORDER BY received_at DESC 
LIMIT 10;

-- Event processing status
SELECT status, COUNT(*) 
FROM webhook_deliveries 
WHERE provider = 'sendgrid' 
GROUP BY status;

-- Recent message events
SELECT type, COUNT(*) 
FROM message_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY type;
```

## Error Handling

### Common Error Scenarios

1. **Invalid Signature** (401)
   - Check webhook secret configuration
   - Verify SendGrid webhook settings
   - Check timestamp validity

2. **Missing Headers** (401)
   - Ensure SendGrid includes required headers
   - Check webhook configuration

3. **Payload Too Large** (413)
   - Review webhook event selection
   - Consider batch size limits

4. **Rate Limit Exceeded** (429)
   - Implement exponential backoff
   - Contact support for rate limit increase

5. **Processing Failures** (500)
   - Check database connectivity
   - Review application logs
   - Verify tenant configuration

### Error Recovery

- **Automatic Retry**: SendGrid automatically retries failed webhooks
- **Dead Letter Queue**: Failed events are logged for manual review
- **Partial Success**: Individual event failures don't fail entire webhook
- **Status Tracking**: Webhook delivery status indicates processing results

## Testing

### Unit Tests

Run comprehensive unit tests:

```bash
npm test -- --testPathPattern="sendgrid.webhook"
```

Tests cover:
- Signature verification
- Event processing logic
- Error handling scenarios
- Configuration validation

### Integration Testing

Test complete webhook flow:

```bash
# Test webhook endpoint
curl -X POST http://localhost:8085/api/webhooks/sendgrid/health

# Test configuration
curl -H "Authorization: Bearer <token>" \
     http://localhost:8085/api/webhooks/sendgrid/config/test
```

### SendGrid Test Integration

Use SendGrid's built-in test feature:

1. Navigate to Event Webhooks settings
2. Click "Test Your Integration"
3. Monitor application logs for processing
4. Verify events in database

## Troubleshooting

### Common Issues

**1. Signature Verification Fails**
```bash
# Check webhook secret
echo $SENDGRID_WEBHOOK_SECRET

# Verify secret length (minimum 16 characters)
echo $SENDGRID_WEBHOOK_SECRET | wc -c
```

**2. No Events Received**
- Verify webhook URL is publicly accessible
- Check SendGrid webhook configuration
- Review rate limiting and IP restrictions
- Monitor application logs for errors

**3. Events Not Processing**
- Check tenant ID extraction
- Verify database connectivity
- Review message event creation
- Check for duplicate detection issues

**4. Performance Issues**
- Monitor processing time logs
- Consider disabling duplicate detection
- Review batch processing settings
- Check database query performance

### Debug Endpoints

Use authenticated debug endpoints for troubleshooting:

```bash
# Check recent deliveries
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8085/api/webhooks/sendgrid/deliveries/recent?limit=5"

# Test configuration
curl -H "Authorization: Bearer <token>" \
     http://localhost:8085/api/webhooks/sendgrid/config/test
```

### Log Analysis

Key log patterns to monitor:

```bash
# Successful processing
grep "SendGrid webhook processed successfully" logs/app.log

# Signature failures
grep "Signature verification failed" logs/app.log

# Rate limiting
grep "SendGrid webhook rate limit exceeded" logs/app.log

# Processing errors
grep "SendGrid webhook processing failed" logs/app.log
```

## Security Considerations

### Best Practices

1. **Use HTTPS**: Always use HTTPS for webhook endpoints
2. **Verify Signatures**: Never disable signature verification
3. **Timestamp Validation**: Prevent replay attacks
4. **IP Allowlisting**: Restrict to SendGrid IPs when possible
5. **Rate Limiting**: Protect against abuse
6. **Log Monitoring**: Monitor for suspicious activity
7. **Secret Rotation**: Regularly rotate webhook secrets

### Security Headers

The webhook endpoint includes security headers:
- Content-Type validation
- Request size limits
- Rate limiting per IP
- Timestamp age validation

### Compliance

- **Data Privacy**: Webhook payloads may contain PII
- **Retention**: Configure appropriate data retention policies
- **Audit Trail**: Complete webhook processing is logged
- **Access Control**: Debug endpoints require authentication

## Performance Optimization

### Configuration Tuning

```bash
# High-volume environments
SENDGRID_WEBHOOK_BATCH_PROCESSING=true
SENDGRID_WEBHOOK_DUPLICATE_DETECTION=false

# Security-focused environments  
SENDGRID_WEBHOOK_MAX_AGE=300
SENDGRID_WEBHOOK_ALLOWED_IPS=167.89.118.0/24
```

### Database Optimization

- Index `webhook_deliveries` on `(tenant_id, provider, received_at)`
- Index `message_events` on `(tenant_id, type, event_at)`
- Consider partitioning for high-volume tenants
- Archive old webhook deliveries periodically

### Monitoring Queries

```sql
-- Processing performance
SELECT 
  DATE_TRUNC('hour', received_at) as hour,
  COUNT(*) as webhooks,
  AVG(EXTRACT(EPOCH FROM (updated_at - received_at))) as avg_processing_seconds
FROM webhook_deliveries 
WHERE provider = 'sendgrid' 
GROUP BY hour 
ORDER BY hour DESC;

-- Event type distribution
SELECT 
  event_type,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM webhook_deliveries 
WHERE provider = 'sendgrid' 
GROUP BY event_type;
```

This comprehensive webhook system provides a robust, secure, and scalable solution for processing all SendGrid events while maintaining full audit trails and monitoring capabilities.