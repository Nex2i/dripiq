# Ticket 15: Partitioning & Index Strategy for Scale

**Epic**: Scaling & Extensions (Phase 5)

**Story Points**: 8

**Priority**: High

**Dependencies**: 01-database-schema, 10-message-events, 12-analytics-aggregation

## Objective

Design and implement native PostgreSQL partitioning and indexing strategies for high-volume tables (`message_events`, optionally `outbound_messages`) to maintain performance at scale.

## Acceptance Criteria

- [ ] Partitioning approach defined (e.g., monthly by `event_at` for `message_events`)
- [ ] Operational plan to pre-create upcoming partitions
- [ ] Indexes defined in Drizzle schema (no raw SQL in docs)
- [ ] Query patterns verified to hit efficient indexes

## Implementation Steps

### Step 1: Partitioning Plan

- Use native range partitioning on `message_events.event_at` by month
- Keep a default catch-all partition for unexpected data

### Step 2: Operational Tasks

- Background job or migration task to ensure next N months partitions exist
- Cleanup/archive policy for very old partitions (if ever desired)

### Step 3: Index Guidance

- Define btree indexes in Drizzle on partitioned tables for `(tenant_id, event_at)` and `(provider, provider_event_id)` as needed
- Avoid GIN unless necessary; prefer structured columns

## Monitoring & Operations

- Track partition counts and sizes
- Monitor slow queries; adjust indexes accordingly

## Testing Requirements

No unit tests at this time.

## Definition of Done

- [ ] Partitioning implemented and automated for `message_events`
- [ ] Indexes defined in schema and validated via EXPLAIN in staging
- [ ] Documentation updated
