ALTER TABLE "dripiq_app"."leads" ADD COLUMN "tenant_id" text NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
