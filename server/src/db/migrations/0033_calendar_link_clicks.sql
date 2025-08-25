CREATE TABLE IF NOT EXISTS "leadgen_app"."calendar_link_clicks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"user_id" text NOT NULL,
	"campaign_id" text,
	"node_id" text,
	"outbound_message_id" text,
	"ip_address" text,
	"user_agent" text,
	"referrer" text,
	"clicked_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "leadgen_app"."calendar_link_clicks" ADD CONSTRAINT "calendar_link_clicks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "leadgen_app"."tenants"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "leadgen_app"."calendar_link_clicks" ADD CONSTRAINT "calendar_link_clicks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leadgen_app"."leads"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "leadgen_app"."calendar_link_clicks" ADD CONSTRAINT "calendar_link_clicks_contact_id_lead_point_of_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "leadgen_app"."lead_point_of_contacts"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "leadgen_app"."calendar_link_clicks" ADD CONSTRAINT "calendar_link_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "leadgen_app"."users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "calendar_link_clicks_tenant_id_idx" ON "leadgen_app"."calendar_link_clicks" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "calendar_link_clicks_lead_id_idx" ON "leadgen_app"."calendar_link_clicks" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "calendar_link_clicks_contact_id_idx" ON "leadgen_app"."calendar_link_clicks" USING btree ("contact_id");
CREATE INDEX IF NOT EXISTS "calendar_link_clicks_user_id_idx" ON "leadgen_app"."calendar_link_clicks" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "calendar_link_clicks_clicked_at_idx" ON "leadgen_app"."calendar_link_clicks" USING btree ("clicked_at");