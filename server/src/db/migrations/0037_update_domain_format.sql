-- Migration to update site_embedding_domains from short format (e.g., "leventhal-law") 
-- to full domain format (e.g., "leventhal-law.com")
-- This prevents conflicts between domains with same name but different TLD

-- Create a temporary table to help with the migration
CREATE TEMP TABLE domain_migration_log (
  old_domain text,
  new_domain text,
  needs_manual_review boolean DEFAULT false
);

-- For safety, we'll first log what domains would be affected
INSERT INTO domain_migration_log (old_domain, new_domain, needs_manual_review)
SELECT 
  "domain" as old_domain,
  CASE 
    WHEN "domain" NOT LIKE '%.%' THEN "domain" || '.com'
    ELSE "domain"
  END as new_domain,
  CASE 
    WHEN "domain" NOT LIKE '%.%' THEN true
    ELSE false
  END as needs_manual_review
FROM "dripiq_app"."site_embedding_domains"
WHERE "domain" NOT LIKE '%.%';

-- Display what would be changed (for manual review)
-- SELECT * FROM domain_migration_log WHERE needs_manual_review = true;

-- Update domains that clearly need TLD added (assuming .com for now)
-- This should be reviewed before running in production
UPDATE "dripiq_app"."site_embedding_domains" 
SET "domain" = "domain" || '.com'
WHERE "domain" NOT LIKE '%.%' 
  AND "domain" != '';

-- Note: Manual review recommended for production deployment
-- Check domain_migration_log table for affected domains