-- Migration: Add lead_products junction table for many-to-many relationship between leads and products
-- Created: 2024

CREATE TABLE IF NOT EXISTS "leadgenius"."lead_products" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"product_id" text NOT NULL,
	"attached_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "leadgenius"."lead_products" ADD CONSTRAINT "lead_products_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leadgenius"."leads"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "leadgenius"."lead_products" ADD CONSTRAINT "lead_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "leadgenius"."products"("id") ON DELETE cascade ON UPDATE no action;

-- Add unique constraint to prevent duplicate attachments
ALTER TABLE "leadgenius"."lead_products" ADD CONSTRAINT "lead_products_lead_id_product_id_unique" UNIQUE("lead_id","product_id");

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "lead_products_lead_id_idx" ON "leadgenius"."lead_products" ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_products_product_id_idx" ON "leadgenius"."lead_products" ("product_id");
CREATE INDEX IF NOT EXISTS "lead_products_attached_at_idx" ON "leadgenius"."lead_products" ("attached_at");