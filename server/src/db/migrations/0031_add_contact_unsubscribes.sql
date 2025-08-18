CREATE TABLE "dripiq_app"."contact_unsubscribes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"channel" text NOT NULL,
	"channel_value" text NOT NULL,
	"unsubscribed_at" timestamp DEFAULT now() NOT NULL,
	"unsubscribe_source" text NOT NULL,
	"campaign_id" text,
	"contact_id" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_unsubscribes_unique" UNIQUE("tenant_id","channel","channel_value")
);
--> statement-breakpoint
ALTER TABLE "dripiq_app"."contact_unsubscribes" ADD CONSTRAINT "contact_unsubscribes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."contact_unsubscribes" ADD CONSTRAINT "contact_unsubscribes_campaign_id_contact_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "dripiq_app"."contact_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."contact_unsubscribes" ADD CONSTRAINT "contact_unsubscribes_contact_id_lead_point_of_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "dripiq_app"."lead_point_of_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_unsubscribes_tenant_channel_idx" ON "dripiq_app"."contact_unsubscribes" USING btree ("tenant_id","channel");--> statement-breakpoint
CREATE INDEX "contact_unsubscribes_channel_value_idx" ON "dripiq_app"."contact_unsubscribes" USING btree ("channel","channel_value");--> statement-breakpoint
CREATE INDEX "contact_unsubscribes_unsubscribed_at_idx" ON "dripiq_app"."contact_unsubscribes" USING btree ("unsubscribed_at");--> statement-breakpoint
CREATE INDEX "contact_unsubscribes_source_idx" ON "dripiq_app"."contact_unsubscribes" USING btree ("unsubscribe_source");