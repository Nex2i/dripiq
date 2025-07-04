CREATE TABLE IF NOT EXISTS "dripiq_app"."lead_point_of_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"title" text,
	"company" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dripiq_app"."leads" ADD COLUMN "primary_contact_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."lead_point_of_contacts" ADD CONSTRAINT "lead_point_of_contacts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "dripiq_app"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "dripiq_app"."leads" DROP COLUMN IF EXISTS "email";--> statement-breakpoint
ALTER TABLE "dripiq_app"."leads" DROP COLUMN IF EXISTS "company";--> statement-breakpoint
ALTER TABLE "dripiq_app"."leads" DROP COLUMN IF EXISTS "phone";