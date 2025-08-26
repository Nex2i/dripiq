CREATE TABLE "dripiq_app"."domain_validation" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domain_validation_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE INDEX "domain_validation_domain_idx" ON "dripiq_app"."domain_validation" USING btree ("domain");