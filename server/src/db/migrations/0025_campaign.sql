CREATE TABLE IF NOT EXISTS "dripiq_app"."campaign_step_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_campaign_instance_id" text NOT NULL,
	"campaign_step_template_id" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"branch_outcome" text,
	"channel" text NOT NULL,
	"rendered_config" jsonb,
	"tenant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."campaign_step_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_template_id" text NOT NULL,
	"step_order" integer NOT NULL,
	"step_name" text NOT NULL,
	"channel" text NOT NULL,
	"config" jsonb,
	"send_time_window_start" text,
	"send_time_window_end" text,
	"delay_after_previous" text DEFAULT '0' NOT NULL,
	"branching" jsonb,
	"tenant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."campaign_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by" text,
	"tenant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."contact_campaign_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"campaign_template_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"tenant_id" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."step_events" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_step_instance_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"tenant_id" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_step_instances" ADD CONSTRAINT "campaign_step_instances_contact_campaign_instance_id_contact_campaign_instances_id_fk" FOREIGN KEY ("contact_campaign_instance_id") REFERENCES "dripiq_app"."contact_campaign_instances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_step_instances" ADD CONSTRAINT "campaign_step_instances_campaign_step_template_id_campaign_step_templates_id_fk" FOREIGN KEY ("campaign_step_template_id") REFERENCES "dripiq_app"."campaign_step_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_step_instances" ADD CONSTRAINT "campaign_step_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_step_templates" ADD CONSTRAINT "campaign_step_templates_campaign_template_id_campaign_templates_id_fk" FOREIGN KEY ("campaign_template_id") REFERENCES "dripiq_app"."campaign_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_step_templates" ADD CONSTRAINT "campaign_step_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_templates" ADD CONSTRAINT "campaign_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "dripiq_app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."campaign_templates" ADD CONSTRAINT "campaign_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."contact_campaign_instances" ADD CONSTRAINT "contact_campaign_instances_contact_id_lead_point_of_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "dripiq_app"."lead_point_of_contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."contact_campaign_instances" ADD CONSTRAINT "contact_campaign_instances_campaign_template_id_campaign_templates_id_fk" FOREIGN KEY ("campaign_template_id") REFERENCES "dripiq_app"."campaign_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."contact_campaign_instances" ADD CONSTRAINT "contact_campaign_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."step_events" ADD CONSTRAINT "step_events_campaign_step_instance_id_campaign_step_instances_id_fk" FOREIGN KEY ("campaign_step_instance_id") REFERENCES "dripiq_app"."campaign_step_instances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."step_events" ADD CONSTRAINT "step_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
