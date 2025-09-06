CREATE TYPE "dripiq_app"."provider" AS ENUM('google', 'microsoft');--> statement-breakpoint
CREATE TYPE "dripiq_app"."token_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "dripiq_app"."mail_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"provider" "dripiq_app"."provider" NOT NULL,
	"provider_user_id" text NOT NULL,
	"tenant_id_provider" text,
	"primary_email" text NOT NULL,
	"display_name" text,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"disconnected_at" timestamp,
	"reauth_required" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail_accounts_provider_identity_uq" UNIQUE("provider","provider_user_id"),
	CONSTRAINT "mail_accounts_user_provider_uq" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "dripiq_app"."oauth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"mail_account_id" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"token_version" integer DEFAULT 1 NOT NULL,
	"status" "dripiq_app"."token_status" DEFAULT 'active' NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"rotated_at" timestamp,
	"inactive_after" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dripiq_app"."mail_accounts" ADD CONSTRAINT "mail_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "dripiq_app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."mail_accounts" ADD CONSTRAINT "mail_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "dripiq_app"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dripiq_app"."oauth_tokens" ADD CONSTRAINT "oauth_tokens_mail_account_id_mail_accounts_id_fk" FOREIGN KEY ("mail_account_id") REFERENCES "dripiq_app"."mail_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mail_accounts_email_idx" ON "dripiq_app"."mail_accounts" USING btree ("primary_email");--> statement-breakpoint
CREATE INDEX "mail_accounts_user_idx" ON "dripiq_app"."mail_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mail_accounts_tenant_idx" ON "dripiq_app"."mail_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "oauth_tokens_account_idx" ON "dripiq_app"."oauth_tokens" USING btree ("mail_account_id");--> statement-breakpoint
CREATE INDEX "oauth_tokens_active_idx" ON "dripiq_app"."oauth_tokens" USING btree ("mail_account_id","status");