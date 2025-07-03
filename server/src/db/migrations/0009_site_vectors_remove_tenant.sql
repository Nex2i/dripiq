ALTER TABLE "dripiq_app"."site_embedding_domains" DROP CONSTRAINT "site_embedding_domains_tenant_id_tenants_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "site_domain_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "tenant_domain_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_domain_idx" ON "dripiq_app"."site_embedding_domains" USING btree ("domain");--> statement-breakpoint
ALTER TABLE "dripiq_app"."site_embedding_domains" DROP COLUMN IF EXISTS "tenant_id";