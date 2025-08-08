# Ticket 06: Scheduled Actions System

**Epic**: Core Campaign Engine (Phase 2)

**Story Points**: 8

**Priority**: Critical

**Dependencies**: 01-database-schema, 02-bullmq-setup, 05-campaign-plans

## Objective

Implement SQL-grounded scheduling via `scheduled_actions` as the source of truth for time-based actions (send, timeout, wait, cancel), with mirrored BullMQ jobs using jobId-based idempotency and safe rebuild-on-startup semantics.

## Acceptance Criteria

- [ ] `scheduled_actions` read/write flow implemented with Drizzle
- [ ] New actions created when plans are activated/transitioned
- [ ] Enqueue jobs to BullMQ with `jobId = dedupe_key`
- [ ] Atomic claim/complete/cancel semantics; retries are safe
- [ ] Rebuild sweep on startup enqueues missed or unqueued pending actions
- [ ] Indexes defined in Drizzle schema (no raw SQL)

## Implementation Steps

### Step 1: Schema & Types

- Ensure `scheduled_actions` table exists in `server/src/db/schema.ts` with:
  - Columns: `id`, `tenant_id`, `contact_campaign_id`, `node_id`, `action_type`, `run_at`, `status`, `job_id` (nullable), `dedupe_key`, `reason`, timestamps
  - Unique constraint: `(tenant_id, dedupe_key)`
  - Index: `(status, run_at)` for ready-to-run scanning
- Export types for service usage

### Step 2: Scheduler Service

Create `server/src/services/campaigns/action.scheduler.ts`:
- `scheduleSend(campaign, node, runAt)` → insert `scheduled_actions` with dedupe key; enqueue BullMQ job with same key
- `scheduleTimeout(campaign, node, eventType, runAt)` → same pattern
- `cancelPendingForNode(campaignId, nodeId, type?)` → set status to `canceled` where `pending`
- `complete(actionId)` and `markError(actionId, reason)` helpers

### Step 3: Enqueue & Idempotency

- Use `queueManager.enqueueJob(queue, name, data, { jobId: dedupeKey, delay })`
- Before enqueue, insert row; if unique violation occurs, treat as already scheduled
- Worker must mark action `completed` or `error` and be safe on retries

### Step 4: Rebuild on Startup

Add a startup task (e.g., `server/src/jobs/scheduler.rebuild.ts`):
- Find `pending` actions with `run_at <= now()` and `job_id IS NULL`
- Enqueue jobs with `jobId = dedupe_key` and update `job_id`
- Log counts and anomalies

### Step 5: Cancellation Semantics

- On state transitions, cancel irrelevant timeouts for previous node
- On campaign stop/completion, cancel all `pending` actions

## File Structure

```
server/src/
├── services/
│   └── campaigns/
│       └── action.scheduler.ts      # Scheduling helpers
├── jobs/
│   └── scheduler.rebuild.ts         # Rebuild missed jobs
└── libs/
    └── bullmq/
        └── queue.manager.ts         # Enqueue API
```

## Monitoring & Operations

- Metrics: pending count by status, enqueued per minute, rebuild counts
- Alerts: large backlog of `pending` with `run_at <= now()`

## Testing Requirements

No unit tests at this time.

## Definition of Done

- [ ] Actions created/canceled/claimed/completed via services
- [ ] Jobs enqueued idempotently with `jobId = dedupe_key`
- [ ] Rebuild process in place and safe to re-run
- [ ] Indexes defined in schema (no raw SQL)
- [ ] Documentation updated
