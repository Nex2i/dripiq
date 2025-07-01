-- Migration: Add indexes for foreign keys to improve query performance
-- The following indexes improve performance for foreign key lookups

-- Index for leads.tenant_id (foreign key: leads_tenant_id_tenants_id_fk)
CREATE INDEX IF NOT EXISTS "idx_leads_tenant_id" ON "dripiq_app"."leads" ("tenant_id");

-- Index for role_permissions.permission_id (foreign key: role_permissions_permission_id_permissions_id_fk)
CREATE INDEX IF NOT EXISTS "idx_role_permissions_permission_id" ON "dripiq_app"."role_permissions" ("permission_id");

-- Index for user_tenants.role_id (foreign key: user_tenants_role_id_roles_id_fk)
CREATE INDEX IF NOT EXISTS "idx_user_tenants_role_id" ON "dripiq_app"."user_tenants" ("role_id");

-- Index for user_tenants.tenant_id (foreign key: user_tenants_tenant_id_tenants_id_fk)
CREATE INDEX IF NOT EXISTS "idx_user_tenants_tenant_id" ON "dripiq_app"."user_tenants" ("tenant_id"); 