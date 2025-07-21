CREATE TABLE IF NOT EXISTS "dripiq_app"."lead_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"status" text NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lead_status_unique" UNIQUE("lead_id","status")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."lead_statuses" ADD CONSTRAINT "lead_statuses_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "dripiq_app"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."lead_statuses" ADD CONSTRAINT "lead_statuses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
