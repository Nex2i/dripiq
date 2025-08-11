CREATE TYPE "dripiq_app"."campaign_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "dripiq_app"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed', 'stopped', 'error');--> statement-breakpoint
-- Drop default before changing type to avoid cast error
ALTER TABLE "dripiq_app"."contact_campaigns" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dripiq_app"."contact_campaigns" ALTER COLUMN "channel" SET DATA TYPE "dripiq_app"."campaign_channel" USING "channel"::text::"dripiq_app"."campaign_channel";--> statement-breakpoint
ALTER TABLE "dripiq_app"."contact_campaigns" ALTER COLUMN "status" SET DATA TYPE "dripiq_app"."campaign_status" USING "status"::text::"dripiq_app"."campaign_status";--> statement-breakpoint
-- Restore enum default
ALTER TABLE "dripiq_app"."contact_campaigns" ALTER COLUMN "status" SET DEFAULT 'draft'::"dripiq_app"."campaign_status";