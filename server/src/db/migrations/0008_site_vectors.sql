CREATE TABLE IF NOT EXISTS "dripiq_app"."site_embedding_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"scraped_at" timestamp NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."site_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"domain_id" text NOT NULL,
	"url" text NOT NULL,
	"slug" text NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"content_summary" text,
	"chunk_index" integer,
	"embedding" vector(1536),
	"token_count" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dripiq_app"."role_permissions" DROP CONSTRAINT "role_permissions_role_id_permission_id_unique";--> statement-breakpoint
ALTER TABLE "dripiq_app"."user_tenants" DROP CONSTRAINT "user_tenants_user_id_tenant_id_unique";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."site_embedding_domains" ADD CONSTRAINT "site_embedding_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."site_embeddings" ADD CONSTRAINT "site_embeddings_domain_id_site_embedding_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "dripiq_app"."site_embedding_domains"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_domain_tenant_idx" ON "dripiq_app"."site_embedding_domains" USING btree ("domain","tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_scraped_at_idx" ON "dripiq_app"."site_embedding_domains" USING btree ("scraped_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_domain_idx" ON "dripiq_app"."site_embedding_domains" USING btree ("tenant_id","domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_embeddings_idx" ON "dripiq_app"."site_embeddings" USING btree ("domain_id","chunk_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_embedding_idx" ON "dripiq_app"."site_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_embedding_token_count_idx" ON "dripiq_app"."site_embeddings" USING btree ("token_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_embedding_content_idx" ON "dripiq_app"."site_embeddings" USING btree ("content");--> statement-breakpoint
ALTER TABLE "dripiq_app"."role_permissions" ADD CONSTRAINT "role_permission_unique" UNIQUE("role_id","permission_id");--> statement-breakpoint
ALTER TABLE "dripiq_app"."user_tenants" ADD CONSTRAINT "user_tenant_unique" UNIQUE("user_id","tenant_id");