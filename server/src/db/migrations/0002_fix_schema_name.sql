-- Create the schema that matches the environment variable
CREATE SCHEMA IF NOT EXISTS "dripiq_local";

-- Create tables in the correct schema
CREATE TABLE IF NOT EXISTS "dripiq_local"."tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dripiq_local"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"supabase_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_supabase_id_unique" UNIQUE("supabase_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "dripiq_local"."user_tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"is_super_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_tenants_user_id_tenant_id_unique" UNIQUE("user_id","tenant_id")
);

-- Copy data from dripiq_app schema if it exists
INSERT INTO "dripiq_local"."tenants" 
SELECT * FROM "dripiq_app"."tenants" 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'dripiq_app' AND table_name = 'tenants')
ON CONFLICT DO NOTHING;

INSERT INTO "dripiq_local"."users" 
SELECT * FROM "dripiq_app"."users" 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'dripiq_app' AND table_name = 'users')
ON CONFLICT DO NOTHING;

INSERT INTO "dripiq_local"."user_tenants" 
SELECT * FROM "dripiq_app"."user_tenants" 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'dripiq_app' AND table_name = 'user_tenants')
ON CONFLICT DO NOTHING;

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "dripiq_local"."user_tenants" ADD CONSTRAINT "user_tenants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "dripiq_local"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "dripiq_local"."user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_local"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$; 