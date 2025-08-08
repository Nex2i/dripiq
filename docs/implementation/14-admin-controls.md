# Ticket 14: Admin Controls & Campaign Management

**Epic**: Analytics & Monitoring (Phase 4)

**Story Points**: 5

**Priority**: Medium

**Dependencies**: 01-database-schema, 05-campaign-plans, 06-scheduled-actions, 07-send-worker, 11-campaign-transitions, 13-suppression-management

## Objective

Provide tenant-level administration features to manage campaign execution, including pausing/resuming campaigns, viewing states, and adjusting rate limits.

## Acceptance Criteria

- [ ] Endpoints to pause/resume all campaigns for a tenant
- [ ] Endpoint to pause/resume a specific campaign
- [ ] Endpoint to set/get per-tenant send rate limits (stored in `send_rate_limits`)
- [ ] Read endpoints to inspect campaign state and pending actions
- [ ] No unit tests at this time

## Implementation Steps

### Step 1: Admin Routes

Create `server/src/routes/admin.controls.routes.ts`:
- POST `/admin/tenants/:tenantId/pause` → sets a tenant-wide pause flag
- POST `/admin/tenants/:tenantId/resume`
- POST `/admin/campaigns/:campaignId/pause`
- POST `/admin/campaigns/:campaignId/resume`
- GET `/admin/campaigns/:campaignId/state` (join current node + pending actions)
- GET `/admin/rate-limits` and PUT `/admin/rate-limits` for `send_rate_limits`

### Step 2: Enforcement

- Send worker checks tenant pause flag before processing
- Plan activation and transitions respect pause state

## Monitoring & Operations

- Audit logs for admin actions
- Alert if pause remains active longer than configured window

## Testing Requirements

No unit tests at this time.

## Definition of Done

- [ ] Admin endpoints for pause/resume and rate limits
- [ ] Enforcement integrated in send/transition paths
- [ ] Documentation updated

