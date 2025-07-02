-- Migration to consolidate invites and seats into user_tenants table
-- Add status tracking fields to user_tenants
ALTER TABLE "dripiq_app"."user_tenants" ADD COLUMN "status" text NOT NULL DEFAULT 'active';
ALTER TABLE "dripiq_app"."user_tenants" ADD COLUMN "invited_at" timestamp;
ALTER TABLE "dripiq_app"."user_tenants" ADD COLUMN "accepted_at" timestamp;

-- Migrate existing data from seats table to user_tenants
INSERT INTO "dripiq_app"."user_tenants" (
  "user_id",
  "tenant_id", 
  "role_id",
  "is_super_user",
  "status",
  "invited_at",
  "accepted_at",
  "created_at",
  "updated_at"
)
SELECT 
  u.id as user_id,
  s.tenant_id,
  r.id as role_id,
  false as is_super_user,
  'active' as status,
  s.created_at as invited_at,
  s.created_at as accepted_at,
  s.created_at,
  s.updated_at
FROM "dripiq_app"."seats" s
JOIN "dripiq_app"."users" u ON u.supabase_id = s.supabase_uid
JOIN "dripiq_app"."roles" r ON r.name = s.role
WHERE NOT EXISTS (
  SELECT 1 FROM "dripiq_app"."user_tenants" ut 
  WHERE ut.user_id = u.id AND ut.tenant_id = s.tenant_id
);

-- Migrate existing pending invites to user_tenants with users created immediately
-- First, create users for pending invites that don't have associated users yet
INSERT INTO "dripiq_app"."users" (
  "supabase_id",
  "email", 
  "name",
  "created_at",
  "updated_at"
)
SELECT 
  i.supabase_id,
  i.email,
  CONCAT(i.first_name, COALESCE(' ' || i.last_name, '')) as name,
  i.created_at,
  i.updated_at
FROM "dripiq_app"."invites" i
WHERE i.supabase_id IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 FROM "dripiq_app"."users" u WHERE u.supabase_id = i.supabase_id
);

-- Then create user_tenants entries for all invites
INSERT INTO "dripiq_app"."user_tenants" (
  "user_id",
  "tenant_id",
  "role_id", 
  "is_super_user",
  "status",
  "invited_at",
  "accepted_at",
  "created_at",
  "updated_at"
)
SELECT 
  u.id as user_id,
  i.tenant_id,
  r.id as role_id,
  false as is_super_user,
  CASE 
    WHEN i.status = 'accepted' THEN 'active'
    ELSE 'pending'
  END as status,
  i.created_at as invited_at,
  i.accepted_at,
  i.created_at,
  i.updated_at
FROM "dripiq_app"."invites" i
JOIN "dripiq_app"."users" u ON u.supabase_id = i.supabase_id
JOIN "dripiq_app"."roles" r ON r.name = i.role
WHERE i.supabase_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM "dripiq_app"."user_tenants" ut 
  WHERE ut.user_id = u.id AND ut.tenant_id = i.tenant_id
);

-- Drop the old tables
DROP TABLE IF EXISTS "dripiq_app"."seats";
DROP TABLE IF EXISTS "dripiq_app"."invites"; 