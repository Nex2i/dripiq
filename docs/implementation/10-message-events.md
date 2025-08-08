# Ticket 10: Message Events Store

**Epic**: Event Processing (Phase 3)

**Story Points**: 5

**Priority**: Critical

**Dependencies**: 01-database-schema, 02-bullmq-setup, 07-send-worker, 09-webhook-ingestion

## Objective

Normalize and persist email provider events into the `message_events` table with strict idempotency and efficient lookup paths for analytics and campaign transitions. Ensure linkage to `outbound_messages` when possible and scale for high event volume.

## Acceptance Criteria

- [ ] All supported events are normalized and stored in `message_events`
- [ ] Idempotency enforced via unique provider event key (e.g., `provider_event_id`)
- [ ] Events linked to `outbound_messages` when resolvable (by provider message ID)
- [ ] Efficient query paths for per-tenant and recent-time lookups
- [ ] Backfill-friendly design and safe reprocessing from `webhook_deliveries`
- [ ] No raw SQL index DDL in docs; indexes defined in schema

## Technical Requirements

- Table: `message_events`
- Columns (conceptual):
  - `id`, `tenant_id`, `outbound_message_id` (nullable), `provider` (e.g., sendgrid), `event_type`, `event_at`
  - `provider_event_id` (unique per provider), `payload` (jsonb), `url`, `ip`, `user_agent`
  - Timestamps: `created_at`
- Indexing: define in Drizzle schema (e.g., `(tenant_id, event_at DESC)`, `(provider, provider_event_id)`), not via raw SQL
- Source: `webhook:process` worker normalizes, dedupes, then inserts

## Implementation Steps

### Step 1: Schema

- Ensure `message_events` is defined in `server/src/db/schema.ts` with:
  - Unique constraint on `(provider, provider_event_id)` or a unique `provider_event_id` scoped appropriately
  - Useful composite indexes for tenant-time queries
  - Types exported for repository/service usage

### Step 2: Normalization Logic

- Implement/extend normalization in `server/src/workers/webhook.worker.ts`:
  - Map raw SendGrid fields to canonical event types: `processed`, `delivered`, `deferred`, `open`, `click`, `bounce`, `blocked`, `spamreport`, `unsubscribe`
  - Derive `provider_event_id` from `sg_event_id` (or fallback)
  - Resolve `outbound_message_id` by provider message id or metadata
  - Store raw payload for audit

### Step 3: Storage & Idempotency

- Insert rows with conflict handling to skip duplicates based on the unique key
- Update related `outbound_messages` statuses when applicable

### Step 4: Query Patterns

- Provide repository/service helpers to:
  - Fetch events by `tenant_id` and recent window
  - Fetch events for an `outbound_message_id`

## File Structure

```
server/src/
├── workers/
│   └── webhook.worker.ts            # Normalizes and stores message events
├── db/
│   └── schema.ts                    # Defines message_events with indexes
└── repositories/
    └── messageEvents.repository.ts  # Optional helper layer (future)
```

## Monitoring & Operations

- Track insert rates, duplicates skipped, and processing latency
- Monitor queue depth and storage errors

## Testing Requirements

No unit tests at this time.

## Definition of Done

- [ ] Events are normalized, deduped, and stored in `message_events`
- [ ] Links to `outbound_messages` when resolvable
- [ ] Indexes defined in schema enable performant queries
- [ ] Compatible with reprocessing from `webhook_deliveries`
- [ ] Documentation updated

