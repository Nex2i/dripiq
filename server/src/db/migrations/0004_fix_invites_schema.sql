-- Make supabase_id nullable if it exists and is not null
DO $$ 
BEGIN
    -- Check if column exists and is not null, then make it nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dripiq_app' 
        AND table_name = 'invites' 
        AND column_name = 'supabase_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "dripiq_app"."invites" ALTER COLUMN "supabase_id" DROP NOT NULL;
    END IF;
    
    -- Add supabase_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dripiq_app' 
        AND table_name = 'invites' 
        AND column_name = 'supabase_id'
    ) THEN
        ALTER TABLE "dripiq_app"."invites" ADD COLUMN "supabase_id" text;
    END IF;
END $$;

-- Remove daily_cap from invites table if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dripiq_app' 
        AND table_name = 'invites' 
        AND column_name = 'daily_cap'
    ) THEN
        ALTER TABLE "dripiq_app"."invites" DROP COLUMN "daily_cap";
    END IF;
END $$;

-- Remove daily_cap from seats table if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dripiq_app' 
        AND table_name = 'seats' 
        AND column_name = 'daily_cap'
    ) THEN
        ALTER TABLE "dripiq_app"."seats" DROP COLUMN "daily_cap";
    END IF;
END $$;

-- Remove token_hash from invites table if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dripiq_app' 
        AND table_name = 'invites' 
        AND column_name = 'token_hash'
    ) THEN
        ALTER TABLE "dripiq_app"."invites" DROP COLUMN "token_hash";
    END IF;
END $$; 