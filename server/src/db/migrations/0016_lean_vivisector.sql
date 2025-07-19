ALTER TABLE "dripiq_app"."leads" ADD COLUMN "owner_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "dripiq_app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
