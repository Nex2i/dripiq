ALTER TABLE "dripiq_app"."email_sender_identities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "dripiq_app"."email_sender_identities" CASCADE;--> statement-breakpoint
ALTER TABLE "dripiq_app"."send_rate_limits" DROP CONSTRAINT "send_rate_limits_unique";--> statement-breakpoint
ALTER TABLE "dripiq_app"."contact_campaigns" DROP CONSTRAINT "contact_campaigns_sender_identity_id_email_sender_identities_id_fk";
--> statement-breakpoint
ALTER TABLE "dripiq_app"."outbound_messages" DROP CONSTRAINT "outbound_messages_sender_identity_id_email_sender_identities_id_fk";
--> statement-breakpoint
ALTER TABLE "dripiq_app"."send_rate_limits" DROP CONSTRAINT "send_rate_limits_identity_id_email_sender_identities_id_fk";
--> statement-breakpoint
ALTER TABLE "dripiq_app"."contact_campaigns" DROP COLUMN "sender_identity_id";--> statement-breakpoint
ALTER TABLE "dripiq_app"."outbound_messages" DROP COLUMN "sender_identity_id";--> statement-breakpoint
ALTER TABLE "dripiq_app"."send_rate_limits" DROP COLUMN "identity_id";--> statement-breakpoint
ALTER TABLE "dripiq_app"."send_rate_limits" ADD CONSTRAINT "send_rate_limits_unique" UNIQUE("tenant_id","channel","scope");
