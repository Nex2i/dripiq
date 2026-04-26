CREATE TABLE "dripiq_app"."calendar_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"mail_account_id" text,
	"provider" text NOT NULL,
	"provider_calendar_id" text DEFAULT 'primary' NOT NULL,
	"display_name" text,
	"primary_email" text,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"reauth_required" boolean DEFAULT false NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"disconnected_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dripiq_app"."schedule_booking_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"campaign_id" text,
	"node_id" text,
	"outbound_message_id" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"revoked_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_booking_tokens_hash_uq" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "dripiq_app"."scheduled_meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"lead_id" text,
	"contact_id" text,
	"booking_token_id" text,
	"campaign_id" text,
	"calendar_connection_id" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"calendar_event_id" text,
	"provider" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"contact_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_meetings_provider_event_uq" UNIQUE("provider","calendar_event_id")
);
--> statement-breakpoint
CREATE TABLE "dripiq_app"."user_schedule_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"working_hours" jsonb DEFAULT '{"monday":[{"start":"09:00","end":"17:00"}],"tuesday":[{"start":"09:00","end":"17:00"}],"wednesday":[{"start":"09:00","end":"17:00"}],"thursday":[{"start":"09:00","end":"17:00"}],"friday":[{"start":"09:00","end":"17:00"}],"saturday":[],"sunday":[]}'::jsonb NOT NULL,
	"meeting_duration_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"min_notice_minutes" integer DEFAULT 120 NOT NULL,
	"booking_horizon_days" integer DEFAULT 14 NOT NULL,
	"respect_free_busy" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_schedule_settings_tenant_user_uq" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "dripiq_app"."calendar_connections" ADD CONSTRAINT "calendar_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "dripiq_app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."calendar_connections" ADD CONSTRAINT "calendar_connections_mail_account_id_mail_accounts_id_fk" FOREIGN KEY ("mail_account_id") REFERENCES "dripiq_app"."mail_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."schedule_booking_tokens" ADD CONSTRAINT "schedule_booking_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."schedule_booking_tokens" ADD CONSTRAINT "schedule_booking_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "dripiq_app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."schedule_booking_tokens" ADD CONSTRAINT "schedule_booking_tokens_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "dripiq_app"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."schedule_booking_tokens" ADD CONSTRAINT "schedule_booking_tokens_contact_id_lead_point_of_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "dripiq_app"."lead_point_of_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."schedule_booking_tokens" ADD CONSTRAINT "schedule_booking_tokens_campaign_id_contact_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "dripiq_app"."contact_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."schedule_booking_tokens" ADD CONSTRAINT "schedule_booking_tokens_outbound_message_id_outbound_messages_id_fk" FOREIGN KEY ("outbound_message_id") REFERENCES "dripiq_app"."outbound_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."scheduled_meetings" ADD CONSTRAINT "scheduled_meetings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."scheduled_meetings" ADD CONSTRAINT "scheduled_meetings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "dripiq_app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."scheduled_meetings" ADD CONSTRAINT "scheduled_meetings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "dripiq_app"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."scheduled_meetings" ADD CONSTRAINT "scheduled_meetings_contact_id_lead_point_of_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "dripiq_app"."lead_point_of_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."scheduled_meetings" ADD CONSTRAINT "scheduled_meetings_booking_token_id_schedule_booking_tokens_id_fk" FOREIGN KEY ("booking_token_id") REFERENCES "dripiq_app"."schedule_booking_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."scheduled_meetings" ADD CONSTRAINT "scheduled_meetings_campaign_id_contact_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "dripiq_app"."contact_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."scheduled_meetings" ADD CONSTRAINT "scheduled_meetings_calendar_connection_id_calendar_connections_id_fk" FOREIGN KEY ("calendar_connection_id") REFERENCES "dripiq_app"."calendar_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."user_schedule_settings" ADD CONSTRAINT "user_schedule_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."user_schedule_settings" ADD CONSTRAINT "user_schedule_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "dripiq_app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_connections_tenant_user_idx" ON "dripiq_app"."calendar_connections" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_connections_active_user_uq" ON "dripiq_app"."calendar_connections" USING btree ("tenant_id","user_id") WHERE "dripiq_app"."calendar_connections"."is_active" = true;--> statement-breakpoint
CREATE INDEX "schedule_booking_tokens_tenant_user_idx" ON "dripiq_app"."schedule_booking_tokens" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "schedule_booking_tokens_contact_idx" ON "dripiq_app"."schedule_booking_tokens" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE INDEX "schedule_booking_tokens_expires_at_idx" ON "dripiq_app"."schedule_booking_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "scheduled_meetings_tenant_user_start_idx" ON "dripiq_app"."scheduled_meetings" USING btree ("tenant_id","user_id","start_time");--> statement-breakpoint
CREATE INDEX "scheduled_meetings_contact_idx" ON "dripiq_app"."scheduled_meetings" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE INDEX "scheduled_meetings_status_idx" ON "dripiq_app"."scheduled_meetings" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "user_schedule_settings_tenant_idx" ON "dripiq_app"."user_schedule_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_schedule_settings_user_idx" ON "dripiq_app"."user_schedule_settings" USING btree ("user_id");