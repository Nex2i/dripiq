-- Create the custom schema
CREATE SCHEMA IF NOT EXISTS "dripiq_app";

-- Move existing tables from public to the custom schema
ALTER TABLE IF EXISTS "public"."tenants" SET SCHEMA "dripiq_app";
ALTER TABLE IF EXISTS "public"."users" SET SCHEMA "dripiq_app";
ALTER TABLE IF EXISTS "public"."user_tenants" SET SCHEMA "dripiq_app";

-- Update foreign key constraints to reference the new schema
-- Drop existing foreign keys
ALTER TABLE IF EXISTS "dripiq_app"."user_tenants" DROP CONSTRAINT IF EXISTS "user_tenants_user_id_users_id_fk";
ALTER TABLE IF EXISTS "dripiq_app"."user_tenants" DROP CONSTRAINT IF EXISTS "user_tenants_tenant_id_tenants_id_fk";

-- Recreate foreign keys with correct schema references
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."user_tenants" ADD CONSTRAINT "user_tenants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "dripiq_app"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "dripiq_app"."user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$; 