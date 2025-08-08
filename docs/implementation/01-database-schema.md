# Ticket 01: Database Schema Implementation

**Epic**: Foundation (Phase 1)  
**Story Points**: 8  
**Priority**: Critical  
**Dependencies**: None

## Objective

Create all new database tables, relationships, and indexes required for the outreach campaign system. This includes 13 new tables that will serve as the foundation for campaign execution, event tracking, and analytics.

## Acceptance Criteria

- [ ] All 13 new tables created with proper relationships
- [ ] Required indexes added for performance
- [ ] Drizzle schema definitions updated
- [ ] Migration scripts created and tested
- [ ] Type exports updated for new tables
- [ ] Backwards compatibility maintained

## Technical Requirements

### Database Tables to Create

1. `email_sender_identities` - AE sender verification
2. `contact_campaigns` - Core campaign instances  
3. `campaign_plan_versions` - Plan audit trail
4. `scheduled_actions` - SQL-based job scheduling
5. `outbound_messages` - Message outbox and deduplication
6. `message_events` - Normalized engagement events
7. `webhook_deliveries` - Raw webhook archive
8. `inbound_messages` - Reply storage for analysis
9. `communication_suppressions` - Per-tenant suppression lists
10. `send_rate_limits` - Configurable sending limits
11. `email_validation_results` - SendGrid validation cache
12. `contact_channels` - Multi-address support (optional)
13. `campaign_transitions` - State change audit log

### Key Constraints

- All tables must include standard fields: `id`, `tenant_id`, `created_at`, `updated_at`
- Use text primary keys (cuid2) consistent with existing schema
- Foreign keys with `ON DELETE CASCADE` unless specified otherwise
- Unique constraints for deduplication (critical for idempotency)

## Implementation Steps

### Step 1: Create Migration File

```bash
cd server
npm run db:generate
# This creates a new migration file like 0025_add_campaign_tables.sql
```

### Step 2: Update Drizzle Schema

Update `server/src/db/schema.ts`:

```typescript
// Add to existing imports
import { createId } from '@paralleldrive/cuid2';

// Email Sender Identities table
export const emailSenderIdentities = appSchema.table('email_sender_identities', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fromEmail: text('from_email').notNull(),
  fromName: text('from_name').notNull(),
  domain: text('domain').notNull(),
  sendgridSenderId: text('sendgrid_sender_id'),
  validationStatus: text('validation_status').notNull().default('pending'), // pending|verified|failed
  lastValidatedAt: timestamp('last_validated_at'),
  dedicatedIpPool: text('dedicated_ip_pool'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  unique('tenant_email_unique').on(table.tenantId, table.fromEmail)
]);

// Contact Campaigns table - core campaign instances
export const contactCampaigns = appSchema.table('contact_campaigns', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  leadId: text('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => leadPointOfContacts.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull(), // email|sms
  status: text('status').notNull().default('draft'), // draft|active|paused|completed|stopped|error
  currentNodeId: text('current_node_id'),
  planJson: jsonb('plan_json').notNull(),
  planVersion: text('plan_version').notNull().default('1.0'),
  planHash: text('plan_hash').notNull(), // for idempotency
  senderIdentityId: text('sender_identity_id').references(() => emailSenderIdentities.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  unique('contact_channel_unique').on(table.tenantId, table.contactId, table.channel),
  index('contact_campaigns_status_idx').on(table.tenantId, table.status),
  // Add GIN index for plan_json if needed for queries
]);

// Continue with remaining tables...
```

### Step 3: Add Relations

```typescript
// Add to existing relations section
export const emailSenderIdentitiesRelations = relations(emailSenderIdentities, ({ one }) => ({
  tenant: one(tenants, {
    fields: [emailSenderIdentities.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [emailSenderIdentities.userId],
    references: [users.id],
  }),
}));

export const contactCampaignsRelations = relations(contactCampaigns, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contactCampaigns.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [contactCampaigns.leadId],
    references: [leads.id],
  }),
  contact: one(leadPointOfContacts, {
    fields: [contactCampaigns.contactId],
    references: [leadPointOfContacts.id],
  }),
  senderIdentity: one(emailSenderIdentities, {
    fields: [contactCampaigns.senderIdentityId],
    references: [emailSenderIdentities.id],
  }),
  scheduledActions: many(scheduledActions),
  outboundMessages: many(outboundMessages),
  transitions: many(campaignTransitions),
}));
```

### Step 4: Export Types

```typescript
// Add to type exports section
export type EmailSenderIdentity = typeof emailSenderIdentities.$inferSelect;
export type NewEmailSenderIdentity = typeof emailSenderIdentities.$inferInsert;
export type ContactCampaign = typeof contactCampaigns.$inferSelect;
export type NewContactCampaign = typeof contactCampaigns.$inferInsert;
// Add types for all new tables...
```

### Step 5: Create Index Strategies

```sql
-- High-performance indexes for scale
CREATE INDEX CONCURRENTLY idx_message_events_tenant_event_time 
ON dripiq_app.message_events (tenant_id, event_at DESC);

CREATE INDEX CONCURRENTLY idx_outbound_messages_provider_lookup 
ON dripiq_app.outbound_messages (provider, provider_message_id);

CREATE INDEX CONCURRENTLY idx_scheduled_actions_ready 
ON dripiq_app.scheduled_actions (status, run_at) 
WHERE status = 'pending';

-- Add GIN indexes for JSONB columns if needed
CREATE INDEX CONCURRENTLY idx_contact_campaigns_plan_gin 
ON dripiq_app.contact_campaigns USING GIN (plan_json);
```

## File Structure

```
server/src/db/
├── migrations/
│   └── 0025_add_campaign_tables.sql    # New migration
├── schema.ts                           # Updated with new tables
└── seed.ts                            # Update if needed

server/src/repositories/
└── entities/
    ├── ContactCampaignRepository.ts    # New repository
    ├── EmailSenderIdentityRepository.ts # New repository
    └── ...                            # Repositories for other tables
```

## Testing Requirements

### Unit Tests

```typescript
// server/src/db/schema.test.ts
describe('Campaign Schema', () => {
  test('contact_campaigns unique constraint works', async () => {
    // Test tenant_id + contact_id + channel uniqueness
  });
  
  test('foreign key relationships are correct', async () => {
    // Test cascading deletes work properly
  });
  
  test('default values are set correctly', async () => {
    // Test status defaults, timestamps, etc.
  });
});
```

### Migration Tests

```typescript
// Test migration up and down
describe('Migration 0025', () => {
  test('migration creates all tables', async () => {
    // Verify all 13 tables exist after migration
  });
  
  test('migration is reversible', async () => {
    // Test rollback works without data loss
  });
});
```

## Performance Considerations

### Indexing Strategy
- Primary indexes on high-query columns (`tenant_id`, `status`, `event_at`)
- Composite indexes for common query patterns
- Partial indexes for filtered queries (e.g., pending actions)
- GIN indexes for JSONB only if complex queries needed

### Table Partitioning
- Consider partitioning `message_events` by month if volume is high
- Use native Postgres partitioning (no pg_partman required for Supabase)

## Validation Checklist

- [ ] All tables created successfully in development
- [ ] Foreign key constraints work correctly
- [ ] Unique constraints prevent duplicate data
- [ ] Indexes improve query performance
- [ ] TypeScript types compile without errors
- [ ] Migration is reversible
- [ ] No breaking changes to existing schema

## Rollback Plan

If issues are discovered:

1. **Before deployment**: Simply don't run the migration
2. **After deployment**: Create reverse migration to drop tables
3. **Data corruption**: Restore from backup (new tables should be empty initially)

## References

- Main architecture: `docs/outreach-campaign-architecture.md`
- Current schema: `server/src/db/schema.ts`
- Drizzle docs: https://orm.drizzle.team/docs/overview
- Migration guide: `server/README.md` (if exists)

## Definition of Done

- [ ] All 13 tables created with correct structure
- [ ] Drizzle schema updated and TypeScript compiles
- [ ] Migration tested in development environment
- [ ] Required indexes added and tested
- [ ] Relations and types exported
- [ ] Unit tests written and passing
- [ ] Documentation updated
- [ ] Code review completed