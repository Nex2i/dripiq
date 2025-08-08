# Ticket 08: Timeout Worker Implementation

**Epic**: Core Campaign Engine (Phase 2)

**Story Points**: 5

**Priority**: Critical

**Dependencies**: 01-database-schema, 02-bullmq-setup, 05-campaign-plans, 06-scheduled-actions, 07-send-worker

## Objective

Implement the `outreach:timeout` worker that generates synthetic timeout events (no_open, no_click) based on scheduled timeouts defined by campaign plans. The worker must be idempotent, reliable, and trigger campaign transitions via the state manager.

## Acceptance Criteria

- [ ] Worker processes `outreach:timeout` jobs for synthetic events
- [ ] Strict idempotency: the same timeout job does not create duplicate effects
- [ ] Marks related `scheduled_actions` as completed/canceled appropriately
- [ ] Calls the Campaign State Manager to process `no_open` and `no_click`
- [ ] Logs outcomes and errors with sufficient context
- [ ] Safe to retry; handles late/out-of-order conditions gracefully

## Technical Requirements

- Queue: `outreach:timeout` (BullMQ)
- Job data: `{ tenantId, campaignId, contactId, nodeId, eventType, scheduledAt }`
- Synthetic events produced: `no_open`, `no_click`
- Default durations: `no_open` = 72h, `no_click` = 24h (from plan or defaults)
- Idempotency via `scheduled_actions.dedupe_key` and `jobId = dedupe_key`

## Implementation Steps

### Step 1: Worker File

Create `server/src/workers/timeout.worker.ts` and implement:
- Worker constructor using `workerConfigs['outreach:timeout']`
- `processJob` to call `campaignStateManager.processEvent(tenantId, syntheticEventType, undefined, metadata)`
- Robust logging and error handling; no duplicate effects on retry

### Step 2: Queue Registration

- Initialize worker in your worker bootstrap (e.g., `server/src/workers/index.ts`) and ensure lifecycle start/stop methods are wired into the server startup/shutdown.

### Step 3: Scheduling Timeouts

- Timeouts are scheduled when entering a node with transitions that include `after` (e.g., `after: "PT72H"` for `no_open`).
- Use the `scheduled_actions` table to persist them and enqueue with `jobId = dedupe_key`.
- Upon transition, cancel irrelevant pending timeouts for the previous node.

## File Structure

```
server/src/
├── workers/
│   ├── timeout.worker.ts            # Generates synthetic timeout events
│   └── index.ts                     # Worker bootstrap (if used)
├── services/
│   └── campaigns/
│       └── state.manager.ts         # Consumed by timeout worker
└── libs/
    └── bullmq/
        ├── queue.config.ts          # Queue configs
        └── queue.manager.ts         # Enqueue API
```

## Monitoring & Operations

- Emit metrics: processed jobs, failures, transitions triggered
- Alert on consecutive failures and high backlog
- Log dedupe keys for auditability

## Testing Requirements

No unit tests at this time.

## Definition of Done

- [ ] Timeout worker runs and processes jobs in `outreach:timeout`
- [ ] Synthetic events `no_open`/`no_click` reliably trigger transitions
- [ ] Idempotency enforced via `scheduled_actions.dedupe_key`/jobId
- [ ] Irrelevant timeouts canceled on node change
- [ ] Clear logs and metrics for observability
- [ ] Documentation updated

