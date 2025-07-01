-- Fix role_id null values by creating admin role and updating existing records

-- First, ensure Admin role exists
INSERT INTO "dripiq_app"."roles" ("id", "name", "description", "created_at", "updated_at") 
VALUES ('clzadmin0000000000000000', 'Admin', 'Full access to all system features including user management, campaign oversight, and system configuration', now(), now())
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint

-- Update any existing user_tenants records that have null role_id to use Admin role
UPDATE "dripiq_app"."user_tenants" 
SET "role_id" = 'clzadmin0000000000000000' 
WHERE "role_id" IS NULL;
--> statement-breakpoint

-- If the role_id column doesn't have NOT NULL constraint yet, add it
ALTER TABLE "dripiq_app"."user_tenants" ALTER COLUMN "role_id" SET NOT NULL;
--> statement-breakpoint 