# Ticket 16: Reply Handling (Inbound Email)

**Epic**: Scaling & Extensions (Phase 5)

**Story Points**: 5

**Priority**: Medium

**Dependencies**: 01-database-schema, 03-sendgrid-integration

## Objective

Capture inbound email replies via provider webhook (e.g., SendGrid Inbound Parse) and store them in `inbound_messages` for future analysis. No automations yet.

## Acceptance Criteria

- [ ] Webhook endpoint receives and validates inbound messages
- [ ] `inbound_messages` rows created with raw content and attachments metadata
- [ ] Secure handling of content and PII
- [ ] No unit tests at this time

## Implementation Steps

### Step 1: Route

Create `server/src/routes/webhooks/inbound.routes.ts`:
- POST `/webhooks/inbound/email` → validates request, maps to `inbound_messages`

### Step 2: Storage

- Insert `tenant_id`, `channel='email'`, `to_address`, `from_address`, `subject`, `text`, `html`, `attachments`, `provider_message_id`, `received_at`

### Step 3: Security

- Verify provider signatures
- Sanitize/size-limit payloads; store attachments safely (e.g., object storage) and reference metadata

## Monitoring & Operations

- Track inbound volume and failure rates

## Testing Requirements

No unit tests at this time.

## Definition of Done

- [ ] Inbound email replies ingested and stored
- [ ] Secure and compliant handling of payloads
- [ ] Documentation updated
