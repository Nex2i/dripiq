# Ticket 17: SMS Foundation

**Epic**: Scaling & Extensions (Phase 5)

**Story Points**: 8

**Priority**: Medium

**Dependencies**: 01-database-schema, 02-bullmq-setup, 05-campaign-plans

## Objective

Prepare the system for SMS as the next outreach channel by extending schemas, workers, and rate limiting, reusing the campaign engine design.

## Acceptance Criteria

- [ ] `channel='sms'` supported across `contact_campaigns`, `scheduled_actions`, `outbound_messages`, `message_events`, `communication_suppressions`
- [ ] Worker stubs for SMS send and webhook ingestion
- [ ] Per-tenant SMS rate limits configurable
- [ ] No unit tests at this time

## Implementation Steps

### Step 1: Schema Review

- Ensure `outbound_messages.to_address` and `channel` handle SMS
- Add optional SMS provider fields (e.g., `twilio_message_sid`) alongside email fields

### Step 2: Workers

- Create `send.sms.worker.ts` (stub) mirroring email send flow (idempotency, rate limiting)
- Create `webhook.sms.worker.ts` (stub) for delivery events; normalize into `message_events`

### Step 3: Rate Limiting

- Extend rate limiter configs for `sms`

### Step 4: Plan DSL

- Allow nodes with `channel='sms'` using the same JSON schema; fields like `body` reused

## File Structure

```
server/src/
├── workers/
│   ├── send.sms.worker.ts           # SMS sending (stub)
│   └── webhook.sms.worker.ts        # SMS event processing (stub)
└── db/
    └── schema.ts                    # Ensure channel-aware columns
```

## Monitoring & Operations

- Separate per-channel metrics and rate limits
- Plan for short-link tracking if click analytics are desired

## Testing Requirements

No unit tests at this time.

## Definition of Done

- [ ] SMS channel supported in schema and core flows
- [ ] Worker stubs created and integrated
- [ ] Rate limiting extended for SMS
- [ ] Documentation updated
