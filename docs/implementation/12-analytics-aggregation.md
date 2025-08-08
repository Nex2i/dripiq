# Ticket 12: Analytics Aggregation

**Epic**: Analytics & Monitoring (Phase 4)

**Story Points**: 8

**Priority**: High

**Dependencies**: 01-database-schema, 07-send-worker, 09-webhook-ingestion, 10-message-events, 11-campaign-transitions

## Objective

Create hourly/daily aggregates for per-message, per-contact, per-campaign, and per-tenant metrics. Support dashboards with cached materialized data and on-demand refresh.

## Acceptance Criteria

- [ ] Aggregations for contact-hourly, campaign-daily, tenant-daily
- [ ] Automated refresh every hour (via pg_cron or job)
- [ ] Source tables: `outbound_messages`, `message_events`, `campaign_transitions`
- [ ] Efficient lookups for dashboard views
- [ ] No raw SQL index DDL in docs; indexes defined in Drizzle for base tables

## Implementation Steps

### Step 1: Rollup Tables or Materialized Views

- Choose approach per environment:
  - Materialized views for simplicity; or
  - Rollup tables populated by jobs for portability
- Define schemas in migrations derived from Drizzle where possible; avoid raw index DDL in docs

### Step 2: Aggregation Queries

- `metrics_contact_hourly(tenant_id, contact_id, channel, hour, sends, delivered, opens, clicks, bounces, unsubscribes)`
- `metrics_campaign_daily(tenant_id, campaign_id, date, sends, delivered, opens, clicks, bounces, unsubscribes)`
- `metrics_tenant_daily(tenant_id, date, sends, delivered, opens, clicks, bounces, unsubscribes)`

### Step 3: Refresh Process

- If using materialized views, set up `pg_cron` to refresh hourly (off-peak per tenant volume)
- If using rollup tables, create a background job that computes deltas since last run and upserts

### Step 4: Read Model

- Repository/services to fetch dashboard slices quickly
- Ensure predicates use existing table indexes (tenant_id, event_at/created_at)

## Monitoring & Operations

- Track refresh duration and staleness
- Alert on long refresh times or failures

## Testing Requirements

No unit tests at this time.

## Definition of Done

- [ ] Aggregation objects created and refreshed hourly
- [ ] Queries for dashboard read models are performant
- [ ] Documentation updated

