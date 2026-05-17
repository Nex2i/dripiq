CREATE TABLE "dripiq_app"."tenant_zoominfo_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_enc" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_zoominfo_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
	CONSTRAINT "tenant_zoominfo_credentials_tenant_unique" UNIQUE("tenant_id")
);
