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
--> statement-breakpoint
-- Data migration: Add default statuses for existing leads
INSERT INTO "dripiq_app"."lead_statuses" ("id", "lead_id", "status", "tenant_id", "created_at", "updated_at")
SELECT 
  'ls_' || substr(md5(random()::text), 1, 22) as id,
  l."id" as lead_id,
  CASE 
    WHEN l."summary" IS NOT NULL THEN 'Processed'
    ELSE 'New'
  END as status,
  l."tenant_id",
  now() as created_at,
  now() as updated_at
FROM "dripiq_app"."leads" l
WHERE NOT EXISTS (
  SELECT 1 FROM "dripiq_app"."lead_statuses" ls 
  WHERE ls."lead_id" = l."id"
);
