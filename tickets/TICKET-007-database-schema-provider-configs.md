# TICKET-007: Database Schema for Email Provider Configurations

## **Priority:** High
## **Estimated Time:** 2-3 days
## **Phase:** 3 - Database Schema Changes
## **Dependencies:** TICKET-002

---

## **Description**
Create new database tables and modify existing schema to support email provider configurations. This includes tables for provider configs, OAuth tokens, and modifications to the existing email sender identities table.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `email_provider_configs` table for storing provider configurations
- [ ] Create `email_provider_tokens` table for OAuth token storage
- [ ] Modify `email_sender_identities` table to reference provider configs
- [ ] Add proper indexes for performance
- [ ] Include foreign key constraints for data integrity
- [ ] Support encrypted credential storage
- [ ] Add migration scripts for schema changes

### **Should Have**
- [ ] Add audit columns (created_at, updated_at)
- [ ] Include soft delete capability
- [ ] Add tenant isolation constraints
- [ ] Support configuration versioning

### **Could Have**
- [ ] Add configuration history tracking
- [ ] Include provider usage statistics
- [ ] Support configuration templates

## **Technical Requirements**

### **Migration Files**

#### **Primary Migration: Add Provider Config Tables**
**File:** `server/src/db/migrations/XXXX_add_email_provider_tables.sql`

```sql
-- Email Provider Configurations (tenant-level)
CREATE TABLE IF NOT EXISTS "dripiq_app"."email_provider_configs" (
  "id" text PRIMARY KEY DEFAULT generate_cuid(),
  "tenant_id" text NOT NULL REFERENCES "dripiq_app"."tenants"("id") ON DELETE CASCADE,
  "type" text NOT NULL CHECK (type IN ('sendgrid', 'smtp', 'microsoft_graph', 'google_workspace')),
  "name" text NOT NULL,
  "config" jsonb NOT NULL,
  "encrypted_credentials" text, -- Encrypted JSON string for sensitive data
  "is_default" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE("tenant_id", "name"),
  
  -- Only one default provider per tenant
  EXCLUDE ("tenant_id" WITH =) WHERE ("is_default" = true)
);

-- OAuth tokens for providers that require them (Microsoft Graph, Google Workspace)
CREATE TABLE IF NOT EXISTS "dripiq_app"."email_provider_tokens" (
  "id" text PRIMARY KEY DEFAULT generate_cuid(),
  "config_id" text NOT NULL REFERENCES "dripiq_app"."email_provider_configs"("id") ON DELETE CASCADE,
  "encrypted_access_token" text,
  "encrypted_refresh_token" text,
  "token_type" text DEFAULT 'Bearer',
  "expires_at" timestamp,
  "scopes" text[],
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX "email_provider_configs_tenant_id_idx" ON "dripiq_app"."email_provider_configs"("tenant_id");
CREATE INDEX "email_provider_configs_tenant_id_type_idx" ON "dripiq_app"."email_provider_configs"("tenant_id", "type");
CREATE INDEX "email_provider_configs_tenant_id_is_active_idx" ON "dripiq_app"."email_provider_configs"("tenant_id", "is_active") WHERE "is_active" = true;
CREATE INDEX "email_provider_configs_tenant_id_is_default_idx" ON "dripiq_app"."email_provider_configs"("tenant_id", "is_default") WHERE "is_default" = true;

CREATE INDEX "email_provider_tokens_config_id_idx" ON "dripiq_app"."email_provider_tokens"("config_id");
CREATE INDEX "email_provider_tokens_expires_at_idx" ON "dripiq_app"."email_provider_tokens"("expires_at");

-- Comments for documentation
COMMENT ON TABLE "dripiq_app"."email_provider_configs" IS 'Email provider configurations for tenants';
COMMENT ON COLUMN "dripiq_app"."email_provider_configs"."config" IS 'Provider-specific configuration (non-sensitive)';
COMMENT ON COLUMN "dripiq_app"."email_provider_configs"."encrypted_credentials" IS 'Encrypted sensitive credentials';

COMMENT ON TABLE "dripiq_app"."email_provider_tokens" IS 'OAuth tokens for email providers';
COMMENT ON COLUMN "dripiq_app"."email_provider_tokens"."encrypted_access_token" IS 'Encrypted OAuth access token';
```

#### **Secondary Migration: Update Email Sender Identities**
**File:** `server/src/db/migrations/XXXX_update_email_sender_identities.sql`

```sql
-- Add provider config reference to email sender identities
ALTER TABLE "dripiq_app"."email_sender_identities" 
ADD COLUMN "provider_config_id" text REFERENCES "dripiq_app"."email_provider_configs"("id") ON DELETE SET NULL;

-- Make sendgrid_sender_id nullable (legacy field for backward compatibility)
ALTER TABLE "dripiq_app"."email_sender_identities" 
ALTER COLUMN "sendgrid_sender_id" DROP NOT NULL;

-- Add provider-specific validation data
ALTER TABLE "dripiq_app"."email_sender_identities" 
ADD COLUMN "provider_validation_data" jsonb;

-- Add index for provider config lookup
CREATE INDEX "email_sender_identities_provider_config_id_idx" 
ON "dripiq_app"."email_sender_identities"("provider_config_id");

-- Add index for tenant + provider config queries
CREATE INDEX "email_sender_identities_tenant_provider_idx" 
ON "dripiq_app"."email_sender_identities"("tenant_id", "provider_config_id");

-- Comments
COMMENT ON COLUMN "dripiq_app"."email_sender_identities"."provider_config_id" IS 'Reference to email provider configuration';
COMMENT ON COLUMN "dripiq_app"."email_sender_identities"."provider_validation_data" IS 'Provider-specific validation data (identityId, verification URLs, etc.)';
```

#### **Data Migration: Create Default SendGrid Configs**
**File:** `server/src/db/migrations/XXXX_migrate_sendgrid_configs.sql`

```sql
-- Create default SendGrid configurations for existing tenants
-- This migration ensures backward compatibility

WITH sendgrid_configs AS (
  INSERT INTO "dripiq_app"."email_provider_configs" (
    "tenant_id",
    "type",
    "name",
    "config",
    "is_default",
    "is_active"
  )
  SELECT DISTINCT
    t.id as tenant_id,
    'sendgrid' as type,
    'SendGrid (Default)' as name,
    '{"legacy": true}'::jsonb as config,
    true as is_default,
    true as is_active
  FROM "dripiq_app"."tenants" t
  WHERE EXISTS (
    SELECT 1 FROM "dripiq_app"."email_sender_identities" esi 
    WHERE esi.tenant_id = t.id 
    AND esi.sendgrid_sender_id IS NOT NULL
  )
  RETURNING id, tenant_id
)
-- Update existing sender identities to reference the new config
UPDATE "dripiq_app"."email_sender_identities" 
SET provider_config_id = sc.id
FROM sendgrid_configs sc
WHERE email_sender_identities.tenant_id = sc.tenant_id
AND email_sender_identities.sendgrid_sender_id IS NOT NULL;
```

### **Schema Type Definitions**

#### **Update schema.ts**
**File:** `server/src/db/schema.ts` (additions)

```typescript
// Email Provider Configurations
export const emailProviderConfigs = appSchema.table(
  'email_provider_configs',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'sendgrid' | 'smtp' | 'microsoft_graph' | 'google_workspace'
    name: text('name').notNull(),
    config: jsonb('config').notNull(),
    encryptedCredentials: text('encrypted_credentials'),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique('tenant_provider_name_unique').on(table.tenantId, table.name)]
);

// OAuth tokens for email providers
export const emailProviderTokens = appSchema.table('email_provider_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  configId: text('config_id')
    .notNull()
    .references(() => emailProviderConfigs.id, { onDelete: 'cascade' }),
  encryptedAccessToken: text('encrypted_access_token'),
  encryptedRefreshToken: text('encrypted_refresh_token'),
  tokenType: text('token_type').default('Bearer'),
  expiresAt: timestamp('expires_at'),
  scopes: text('scopes').array(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Update existing emailSenderIdentities table (add new fields)
export const emailSenderIdentities = appSchema.table(
  'email_sender_identities',
  {
    // ... existing fields ...
    providerConfigId: text('provider_config_id').references(() => emailProviderConfigs.id, {
      onDelete: 'set null'
    }),
    providerValidationData: jsonb('provider_validation_data'),
    // Note: sendgridSenderId is now nullable for backward compatibility
  }
);

// Relations
export const emailProviderConfigsRelations = relations(emailProviderConfigs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [emailProviderConfigs.tenantId],
    references: [tenants.id],
  }),
  tokens: many(emailProviderTokens),
  senderIdentities: many(emailSenderIdentities),
}));

export const emailProviderTokensRelations = relations(emailProviderTokens, ({ one }) => ({
  config: one(emailProviderConfigs, {
    fields: [emailProviderTokens.configId],
    references: [emailProviderConfigs.id],
  }),
}));

// Update emailSenderIdentities relations
export const emailSenderIdentitiesRelations = relations(emailSenderIdentities, ({ one, many }) => ({
  // ... existing relations ...
  providerConfig: one(emailProviderConfigs, {
    fields: [emailSenderIdentities.providerConfigId],
    references: [emailProviderConfigs.id],
  }),
}));

// Types
export type EmailProviderConfig = typeof emailProviderConfigs.$inferSelect;
export type NewEmailProviderConfig = typeof emailProviderConfigs.$inferInsert;
export type EmailProviderToken = typeof emailProviderTokens.$inferSelect;
export type NewEmailProviderToken = typeof emailProviderTokens.$inferInsert;
```

## **Security Requirements**

### **Credential Encryption**
- [ ] Encrypt sensitive fields before database storage
- [ ] Use tenant-specific encryption keys where possible
- [ ] Implement secure key management
- [ ] Support credential rotation

### **Access Control**
- [ ] Tenant isolation enforced at database level
- [ ] Row-level security policies
- [ ] Audit logging for sensitive operations

## **Performance Considerations**

### **Indexing Strategy**
- [ ] Optimize for common query patterns
- [ ] Composite indexes for multi-column queries
- [ ] Partial indexes for boolean columns
- [ ] Consider query performance impact

### **Data Size Optimization**
- [ ] JSONB compression for large config objects
- [ ] Appropriate column types for efficiency
- [ ] Consider partitioning for high-volume scenarios

## **Testing Requirements**

### **Migration Testing**
- [ ] Test migration on empty database
- [ ] Test migration with existing data
- [ ] Test rollback scenarios
- [ ] Validate foreign key constraints

### **Data Integrity Testing**
- [ ] Test unique constraints
- [ ] Test foreign key relationships
- [ ] Validate data types and constraints
- [ ] Test cascade operations

### **Test Files**
```
server/src/db/migrations/__tests__/provider-config-migration.test.ts
```

## **Backward Compatibility**

### **Existing Data Preservation**
- [ ] Preserve all existing SendGrid configurations
- [ ] Maintain existing sender identity relationships
- [ ] Ensure no data loss during migration
- [ ] Support rollback to previous schema

### **Legacy Support**
- [ ] Keep `sendgridSenderId` field for backward compatibility
- [ ] Support queries that don't use new provider system
- [ ] Gradual migration strategy

## **Documentation Requirements**

### **Schema Documentation**
- [ ] Document all new tables and columns
- [ ] Include relationship diagrams
- [ ] Document encryption strategy
- [ ] Create migration guides

### **Security Documentation**
- [ ] Document encryption methods
- [ ] Access control requirements
- [ ] Key management procedures
- [ ] Audit requirements

## **Rollback Strategy**

### **Migration Rollback**
```sql
-- Rollback script for email_provider_configs
DROP TABLE IF EXISTS "dripiq_app"."email_provider_tokens";
DROP TABLE IF EXISTS "dripiq_app"."email_provider_configs";

-- Rollback sender identities changes
ALTER TABLE "dripiq_app"."email_sender_identities" 
DROP COLUMN IF EXISTS "provider_config_id";

ALTER TABLE "dripiq_app"."email_sender_identities" 
DROP COLUMN IF EXISTS "provider_validation_data";

-- Restore sendgrid_sender_id NOT NULL constraint if needed
-- (Only if no NULL values exist)
```

## **Definition of Done**
- [ ] All migration scripts created and tested
- [ ] Schema types updated in TypeScript
- [ ] Foreign key relationships working correctly
- [ ] Indexes created and optimized
- [ ] Backward compatibility verified
- [ ] Migration rollback tested
- [ ] Security review completed
- [ ] Documentation completed
- [ ] Code review completed

## **Notes**
- Consider database performance impact of new indexes
- Plan for potential large-scale data migrations
- Ensure encryption keys are properly managed
- Test with realistic data volumes

## **Related Tickets**
- TICKET-002: Email Configuration Types (prerequisite)
- TICKET-008: Provider Config Repository
- TICKET-009: SendGrid Provider Implementation
- TICKET-014: Data Migration and Backward Compatibility