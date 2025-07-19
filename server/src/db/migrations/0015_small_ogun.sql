CREATE TABLE IF NOT EXISTS "dripiq_app"."products" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sales_voice" text,
	"tenant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" DROP COLUMN IF EXISTS "products";--> statement-breakpoint
ALTER TABLE "dripiq_app"."tenants" DROP COLUMN IF EXISTS "services";