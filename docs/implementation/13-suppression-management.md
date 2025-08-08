# Ticket 13: Suppression Management

**Epic**: Analytics & Monitoring (Phase 4)

**Story Points**: 5

**Priority**: High

**Dependencies**: 01-database-schema, 07-send-worker, 09-webhook-ingestion

## Objective

Implement per-tenant suppression handling across channels. Honor unsubscribes, bounces, spam complaints, and invalid emails by preventing future sends and recording reasons.

## Acceptance Criteria

- [ ] `communication_suppressions` is the source of truth
- [ ] Unsubscribe/bounce/spamreport events create or update suppression rows
- [ ] Send worker checks suppressions before sending
- [ ] API to manage/view suppressions per tenant
- [ ] No unit tests at this time

## Implementation Steps

### Step 1: Webhook-driven Updates

- In `webhook.worker.ts`, on events (`bounce`, `blocked`, `spamreport`, `unsubscribe`):
  - Upsert into `communication_suppressions` with type, first/last seen

### Step 2: Send-time Enforcement

- In send worker, check suppression by `(tenant_id, channel, value)` and block sends with clear error

### Step 3: API Endpoints

Create `server/src/routes/suppressions.routes.ts`:
- `GET /suppressions` (filter by channel/type/value)
- `POST /suppressions` (manual add e.g., compliance request)
- `DELETE /suppressions/:id` (lift suppression where appropriate)

## File Structure

```
server/src/
├── routes/
│   └── suppressions.routes.ts       # CRUD for suppressions
├── workers/
│   └── webhook.worker.ts            # Upsert on events
└── db/
    └── schema.ts                    # communication_suppressions
```

## Monitoring & Operations

- Track suppression growth and send blocks
- Exportable list for compliance reviews

## Testing Requirements

No unit tests at this time.

## Definition of Done

- [ ] Suppressions auto-created from events and enforced at send-time
- [ ] Admin API for viewing/managing suppressions
- [ ] Documentation updated
