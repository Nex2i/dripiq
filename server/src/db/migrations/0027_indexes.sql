CREATE TYPE "dripiq_app"."outbound_message_state" AS ENUM('queued', 'scheduled', 'sent', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "dripiq_app"."scheduled_action_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'canceled');--> statement-breakpoint
ALTER TABLE "dripiq_app"."campaign_transitions" ALTER COLUMN "from_status" SET DATA TYPE campaign_status;--> statement-breakpoint
ALTER TABLE "dripiq_app"."campaign_transitions" ALTER COLUMN "to_status" SET DATA TYPE campaign_status;--> statement-breakpoint
ALTER TABLE "dripiq_app"."communication_suppressions" ALTER COLUMN "channel" SET DATA TYPE campaign_channel;--> statement-breakpoint
ALTER TABLE "dripiq_app"."contact_channels" ALTER COLUMN "type" SET DATA TYPE campaign_channel;--> statement-breakpoint
ALTER TABLE "dripiq_app"."inbound_messages" ALTER COLUMN "channel" SET DATA TYPE campaign_channel;--> statement-breakpoint
ALTER TABLE "dripiq_app"."outbound_messages" ALTER COLUMN "channel" SET DATA TYPE campaign_channel;--> statement-breakpoint
ALTER TABLE "dripiq_app"."outbound_messages" ALTER COLUMN "state" SET DATA TYPE outbound_message_state;--> statement-breakpoint
ALTER TABLE "dripiq_app"."scheduled_actions" ALTER COLUMN "status" SET DATA TYPE scheduled_action_status;--> statement-breakpoint
ALTER TABLE "dripiq_app"."send_rate_limits" ALTER COLUMN "channel" SET DATA TYPE campaign_channel;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_plan_versions_plan_json_gin_idx" ON "dripiq_app"."campaign_plan_versions" USING gin ("plan_json");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_campaigns_plan_hash_idx" ON "dripiq_app"."contact_campaigns" USING btree ("plan_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_campaigns_plan_json_gin_idx" ON "dripiq_app"."contact_campaigns" USING gin ("plan_json");