-- Migration: Add campaign schema
-- This migration adds support for multi-channel campaigns (email, SMS, video, etc.)

-- Campaign Templates table
CREATE TABLE IF NOT EXISTS "crm"."campaign_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by" text,
	"tenant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Campaign Step Templates table (channel-agnostic with config)
CREATE TABLE IF NOT EXISTS "crm"."campaign_step_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_template_id" text NOT NULL,
	"step_order" integer NOT NULL,
	"step_name" text NOT NULL,
	"channel" text NOT NULL,
	"config" jsonb,
	"send_time_window_start" time,
	"send_time_window_end" time,
	"delay_after_previous" interval DEFAULT '0'::interval NOT NULL,
	"branching" jsonb,
	"tenant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Contact Campaign Instances table
CREATE TABLE IF NOT EXISTS "crm"."contact_campaign_instances" (
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

-- Campaign Step Instances table
CREATE TABLE IF NOT EXISTS "crm"."campaign_step_instances" (
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

-- Step Events table (engagement tracking, channel-agnostic)
CREATE TABLE IF NOT EXISTS "crm"."step_events" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_step_instance_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"tenant_id" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "crm"."campaign_templates" ADD CONSTRAINT "campaign_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "crm"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."campaign_templates" ADD CONSTRAINT "campaign_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "crm"."tenants"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."campaign_step_templates" ADD CONSTRAINT "campaign_step_templates_campaign_template_id_campaign_templates_id_fk" FOREIGN KEY ("campaign_template_id") REFERENCES "crm"."campaign_templates"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."campaign_step_templates" ADD CONSTRAINT "campaign_step_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "crm"."tenants"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."contact_campaign_instances" ADD CONSTRAINT "contact_campaign_instances_contact_id_lead_point_of_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."lead_point_of_contacts"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."contact_campaign_instances" ADD CONSTRAINT "contact_campaign_instances_campaign_template_id_campaign_templates_id_fk" FOREIGN KEY ("campaign_template_id") REFERENCES "crm"."campaign_templates"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."contact_campaign_instances" ADD CONSTRAINT "contact_campaign_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "crm"."tenants"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."campaign_step_instances" ADD CONSTRAINT "campaign_step_instances_contact_campaign_instance_id_contact_campaign_instances_id_fk" FOREIGN KEY ("contact_campaign_instance_id") REFERENCES "crm"."contact_campaign_instances"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."campaign_step_instances" ADD CONSTRAINT "campaign_step_instances_campaign_step_template_id_campaign_step_templates_id_fk" FOREIGN KEY ("campaign_step_template_id") REFERENCES "crm"."campaign_step_templates"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."campaign_step_instances" ADD CONSTRAINT "campaign_step_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "crm"."tenants"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."step_events" ADD CONSTRAINT "step_events_campaign_step_instance_id_campaign_step_instances_id_fk" FOREIGN KEY ("campaign_step_instance_id") REFERENCES "crm"."campaign_step_instances"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "crm"."step_events" ADD CONSTRAINT "step_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "crm"."tenants"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_campaign_templates_tenant_id" ON "crm"."campaign_templates" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_templates_created_by" ON "crm"."campaign_templates" ("created_by");

CREATE INDEX IF NOT EXISTS "idx_campaign_step_templates_campaign_template_id" ON "crm"."campaign_step_templates" ("campaign_template_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_step_templates_tenant_id" ON "crm"."campaign_step_templates" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_step_templates_channel" ON "crm"."campaign_step_templates" ("channel");

CREATE INDEX IF NOT EXISTS "idx_contact_campaign_instances_contact_id" ON "crm"."contact_campaign_instances" ("contact_id");
CREATE INDEX IF NOT EXISTS "idx_contact_campaign_instances_campaign_template_id" ON "crm"."contact_campaign_instances" ("campaign_template_id");
CREATE INDEX IF NOT EXISTS "idx_contact_campaign_instances_tenant_id" ON "crm"."contact_campaign_instances" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_contact_campaign_instances_status" ON "crm"."contact_campaign_instances" ("status");

CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_contact_campaign_instance_id" ON "crm"."campaign_step_instances" ("contact_campaign_instance_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_campaign_step_template_id" ON "crm"."campaign_step_instances" ("campaign_step_template_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_tenant_id" ON "crm"."campaign_step_instances" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_status" ON "crm"."campaign_step_instances" ("status");
CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_scheduled_at" ON "crm"."campaign_step_instances" ("scheduled_at");
CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_channel" ON "crm"."campaign_step_instances" ("channel");

CREATE INDEX IF NOT EXISTS "idx_step_events_campaign_step_instance_id" ON "crm"."step_events" ("campaign_step_instance_id");
CREATE INDEX IF NOT EXISTS "idx_step_events_tenant_id" ON "crm"."step_events" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_step_events_event_type" ON "crm"."step_events" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_step_events_occurred_at" ON "crm"."step_events" ("occurred_at");