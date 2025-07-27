CREATE TABLE IF NOT EXISTS "dripiq_app"."lead_products" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"product_id" text NOT NULL,
	"attached_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lead_products_lead_id_product_id_unique" UNIQUE("lead_id","product_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."lead_products" ADD CONSTRAINT "lead_products_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "dripiq_app"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."lead_products" ADD CONSTRAINT "lead_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "dripiq_app"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
