CREATE TABLE IF NOT EXISTS "dripiq_app"."campaign_plan_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"version" text NOT NULL,
	"plan_json" jsonb NOT NULL,
	"plan_hash" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_version_unique" UNIQUE("campaign_id","version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."campaign_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"created_by" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."communication_suppressions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"channel" text NOT NULL,
	"address" text NOT NULL,
	"reason" text,
	"suppressed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "communication_suppressions_unique" UNIQUE("tenant_id","channel","address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."contact_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_node_id" text,
	"plan_json" jsonb NOT NULL,
	"plan_version" text DEFAULT '1.0' NOT NULL,
	"plan_hash" text NOT NULL,
	"sender_identity_id" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_channel_unique" UNIQUE("tenant_id","contact_id","channel")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."contact_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verification_status" text,
	"verified_at" timestamp,
	"validation_result_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_channels_unique" UNIQUE("tenant_id","contact_id","type","value")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."email_sender_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text NOT NULL,
	"domain" text NOT NULL,
	"sendgrid_sender_id" text,
	"validation_status" text DEFAULT 'pending' NOT NULL,
	"last_validated_at" timestamp,
	"dedicated_ip_pool" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_email_unique" UNIQUE("tenant_id","from_email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."email_validation_results" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"email" text NOT NULL,
	"is_valid" boolean DEFAULT false NOT NULL,
	"score" integer,
	"validation_status" text,
	"source" text,
	"checked_at" timestamp,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_validation_results_unique" UNIQUE("tenant_id","email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."inbound_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"campaign_id" text,
	"contact_id" text,
	"channel" text NOT NULL,
	"provider_message_id" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."message_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"message_id" text NOT NULL,
	"type" text NOT NULL,
	"event_at" timestamp NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."outbound_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"channel" text NOT NULL,
	"sender_identity_id" text,
	"provider_message_id" text,
	"dedupe_key" text NOT NULL,
	"content" jsonb,
	"state" text DEFAULT 'queued' NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"error_at" timestamp,
	"last_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "outbound_messages_dedupe_unique" UNIQUE("tenant_id","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."scheduled_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"campaign_id" text,
	"action_type" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."send_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"channel" text NOT NULL,
	"scope" text DEFAULT 'tenant' NOT NULL,
	"identity_id" text,
	"window_seconds" integer NOT NULL,
	"max_sends" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "send_rate_limits_unique" UNIQUE("tenant_id","channel","scope","identity_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"message_id" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	"signature" text,
	"status" text DEFAULT 'received' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_plan_versions" ADD CONSTRAINT "campaign_plan_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_plan_versions" ADD CONSTRAINT "campaign_plan_versions_campaign_id_contact_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "dripiq_app"."contact_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_plan_versions" ADD CONSTRAINT "campaign_plan_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "dripiq_app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_transitions" ADD CONSTRAINT "campaign_transitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_transitions" ADD CONSTRAINT "campaign_transitions_campaign_id_contact_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "dripiq_app"."contact_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_transitions" ADD CONSTRAINT "campaign_transitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "dripiq_app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."communication_suppressions" ADD CONSTRAINT "communication_suppressions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."contact_campaigns" ADD CONSTRAINT "contact_campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."contact_campaigns" ADD CONSTRAINT "contact_campaigns_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "dripiq_app"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."contact_campaigns" ADD CONSTRAINT "contact_campaigns_contact_id_lead_point_of_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "dripiq_app"."lead_point_of_contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."contact_campaigns" ADD CONSTRAINT "contact_campaigns_sender_identity_id_email_sender_identities_id_fk" FOREIGN KEY ("sender_identity_id") REFERENCES "dripiq_app"."email_sender_identities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."contact_channels" ADD CONSTRAINT "contact_channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."contact_channels" ADD CONSTRAINT "contact_channels_contact_id_lead_point_of_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "dripiq_app"."lead_point_of_contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."contact_channels" ADD CONSTRAINT "contact_channels_validation_result_id_email_validation_results_id_fk" FOREIGN KEY ("validation_result_id") REFERENCES "dripiq_app"."email_validation_results"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."email_sender_identities" ADD CONSTRAINT "email_sender_identities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."email_sender_identities" ADD CONSTRAINT "email_sender_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "dripiq_app"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."email_validation_results" ADD CONSTRAINT "email_validation_results_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."inbound_messages" ADD CONSTRAINT "inbound_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."inbound_messages" ADD CONSTRAINT "inbound_messages_campaign_id_contact_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "dripiq_app"."contact_campaigns"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."inbound_messages" ADD CONSTRAINT "inbound_messages_contact_id_lead_point_of_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "dripiq_app"."lead_point_of_contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."message_events" ADD CONSTRAINT "message_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."message_events" ADD CONSTRAINT "message_events_message_id_outbound_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "dripiq_app"."outbound_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."outbound_messages" ADD CONSTRAINT "outbound_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."outbound_messages" ADD CONSTRAINT "outbound_messages_campaign_id_contact_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "dripiq_app"."contact_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."outbound_messages" ADD CONSTRAINT "outbound_messages_contact_id_lead_point_of_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "dripiq_app"."lead_point_of_contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."outbound_messages" ADD CONSTRAINT "outbound_messages_sender_identity_id_email_sender_identities_id_fk" FOREIGN KEY ("sender_identity_id") REFERENCES "dripiq_app"."email_sender_identities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."scheduled_actions" ADD CONSTRAINT "scheduled_actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."scheduled_actions" ADD CONSTRAINT "scheduled_actions_campaign_id_contact_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "dripiq_app"."contact_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."send_rate_limits" ADD CONSTRAINT "send_rate_limits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."send_rate_limits" ADD CONSTRAINT "send_rate_limits_identity_id_email_sender_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "dripiq_app"."email_sender_identities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_message_id_outbound_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "dripiq_app"."outbound_messages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_plan_versions_hash_idx" ON "dripiq_app"."campaign_plan_versions" USING btree ("plan_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_transitions_campaign_idx" ON "dripiq_app"."campaign_transitions" USING btree ("campaign_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_suppressions_suppressed_at_idx" ON "dripiq_app"."communication_suppressions" USING btree ("suppressed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_campaigns_status_idx" ON "dripiq_app"."contact_campaigns" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_channels_primary_idx" ON "dripiq_app"."contact_channels" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_validation_results_checked_at_idx" ON "dripiq_app"."email_validation_results" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbound_messages_received_at_idx" ON "dripiq_app"."inbound_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbound_messages_provider_id_idx" ON "dripiq_app"."inbound_messages" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_events_tenant_type_idx" ON "dripiq_app"."message_events" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_events_event_at_idx" ON "dripiq_app"."message_events" USING btree ("event_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_messages_state_idx" ON "dripiq_app"."outbound_messages" USING btree ("tenant_id","state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_messages_provider_id_idx" ON "dripiq_app"."outbound_messages" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_actions_tenant_status_idx" ON "dripiq_app"."scheduled_actions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_actions_scheduled_at_idx" ON "dripiq_app"."scheduled_actions" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "send_rate_limits_channel_idx" ON "dripiq_app"."send_rate_limits" USING btree ("channel");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_provider_idx" ON "dripiq_app"."webhook_deliveries" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_received_at_idx" ON "dripiq_app"."webhook_deliveries" USING btree ("received_at");