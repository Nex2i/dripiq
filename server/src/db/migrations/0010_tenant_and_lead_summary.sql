ALTER TABLE "dripiq_app"."leads" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "dripiq_app"."leads" ADD COLUMN "site_embedding_domain_id" text;--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" ADD COLUMN "organization_summary" text;--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" ADD COLUMN "site_embedding_domain_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."leads" ADD CONSTRAINT "leads_site_embedding_domain_id_site_embedding_domains_id_fk" FOREIGN KEY ("site_embedding_domain_id") REFERENCES "dripiq_app"."site_embedding_domains"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."tenants" ADD CONSTRAINT "tenants_site_embedding_domain_id_site_embedding_domains_id_fk" FOREIGN KEY ("site_embedding_domain_id") REFERENCES "dripiq_app"."site_embedding_domains"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
