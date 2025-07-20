DROP INDEX IF EXISTS "site_domain_idx";--> statement-breakpoint
ALTER TABLE "dripiq_app"."lead_point_of_contacts" ALTER COLUMN "email" DROP NOT NULL;