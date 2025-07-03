ALTER TABLE "dripiq_app"."leads" ADD COLUMN "products" jsonb;--> statement-breakpoint
ALTER TABLE "dripiq_app"."leads" ADD COLUMN "services" jsonb;--> statement-breakpoint
ALTER TABLE "dripiq_app"."leads" ADD COLUMN "differentiators" jsonb;--> statement-breakpoint
ALTER TABLE "dripiq_app"."leads" ADD COLUMN "target_market" text;--> statement-breakpoint
ALTER TABLE "dripiq_app"."leads" ADD COLUMN "tone" text;--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" ADD COLUMN "products" jsonb;--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" ADD COLUMN "services" jsonb;--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" ADD COLUMN "differentiators" jsonb;--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" ADD COLUMN "target_market" text;--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" ADD COLUMN "tone" text;