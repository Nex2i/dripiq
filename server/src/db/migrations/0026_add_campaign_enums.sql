CREATE TYPE "dripiq_app"."campaign_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "dripiq_app"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed', 'stopped', 'error');--> statement-breakpoint
ALTER TABLE "dripiq_app"."contact_campaigns" ALTER COLUMN "channel" SET DATA TYPE campaign_channel;--> statement-breakpoint
ALTER TABLE "dripiq_app"."contact_campaigns" ALTER COLUMN "status" SET DATA TYPE campaign_status;