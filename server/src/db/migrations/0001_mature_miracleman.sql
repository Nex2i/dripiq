CREATE TABLE IF NOT EXISTS "dripiq_app"."permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."role_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_unique" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dripiq_app"."roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
-- First, create Admin role if it doesn't exist
INSERT INTO "dripiq_app"."roles" ("id", "name", "description", "created_at", "updated_at") 
VALUES ('clzadmin0000000000000000', 'Admin', 'Full access to all system features including user management, campaign oversight, and system configuration', now(), now())
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
-- Add role_id column as nullable first
ALTER TABLE "dripiq_app"."user_tenants" ADD COLUMN "role_id" text;--> statement-breakpoint
-- Update existing records to use Admin role
UPDATE "dripiq_app"."user_tenants" SET "role_id" = 'clzadmin0000000000000000' WHERE "role_id" IS NULL;--> statement-breakpoint
-- Now apply NOT NULL constraint
ALTER TABLE "dripiq_app"."user_tenants" ALTER COLUMN "role_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dripiq_app"."users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "dripiq_app"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dripiq_app"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "dripiq_app"."permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "dripiq_app"."user_tenants" ADD CONSTRAINT "user_tenants_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "dripiq_app"."roles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
