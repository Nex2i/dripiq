-- Remove products and services columns from tenants table
ALTER TABLE "dripiq_app"."tenants" DROP COLUMN IF EXISTS "products";
ALTER TABLE "dripiq_app"."tenants" DROP COLUMN IF EXISTS "services";

-- Create products table
CREATE TABLE IF NOT EXISTS "dripiq_app"."products" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sales_voice" text,
	"tenant_id" text NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

-- Add foreign key constraint for products table
ALTER TABLE "dripiq_app"."products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action; 