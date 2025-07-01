ALTER TABLE "dripiq_app"."roles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "dripiq_app"."roles" CASCADE;--> statement-breakpoint
ALTER TABLE "dripiq_app"."user_tenants" DROP COLUMN IF EXISTS "role_id";