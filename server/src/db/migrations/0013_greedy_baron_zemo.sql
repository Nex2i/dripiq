ALTER TABLE "dripiq_app"."leads" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "dripiq_app"."leads" ADD COLUMN "brand_colors" jsonb;--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" ADD COLUMN "brand_colors" jsonb;