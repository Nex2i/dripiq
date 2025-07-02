-- Add supabaseId column to invites table (nullable initially)
ALTER TABLE "dripiq_app"."invites" ADD COLUMN "supabase_id" text;

-- Remove tokenHash column from invites table
ALTER TABLE "dripiq_app"."invites" DROP COLUMN "token_hash"; 