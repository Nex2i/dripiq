CREATE TABLE "dripiq_app"."tenant_domain_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"domain" text NOT NULL,
	"is_verified" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_domain_mapping_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenant_domain_mappings" ADD CONSTRAINT "tenant_domain_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tenant_domain_mapping_tenant_idx" ON "dripiq_app"."tenant_domain_mappings" USING btree ("tenant_id");
