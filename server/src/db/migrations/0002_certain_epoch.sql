DROP TABLE "dripiq_app"."permissions" CASCADE;--> statement-breakpoint
DROP TABLE "dripiq_app"."role_permissions" CASCADE;--> statement-breakpoint
ALTER TABLE "dripiq_app"."users" DROP COLUMN IF EXISTS "is_active";