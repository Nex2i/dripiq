-- Migration to remove email sender identities and replace with mail account validation
-- This migration drops the email_sender_identities table and removes foreign key references

-- First, remove foreign key constraints that reference email_sender_identities
ALTER TABLE contact_campaigns DROP CONSTRAINT IF EXISTS contact_campaigns_sender_identity_id_email_sender_identities_id_fk;
ALTER TABLE outbound_messages DROP CONSTRAINT IF EXISTS outbound_messages_sender_identity_id_email_sender_identities_id_fk;
ALTER TABLE send_rate_limits DROP CONSTRAINT IF EXISTS send_rate_limits_identity_id_email_sender_identities_id_fk;

-- Remove sender_identity_id columns from tables
ALTER TABLE contact_campaigns DROP COLUMN IF EXISTS sender_identity_id;
ALTER TABLE outbound_messages DROP COLUMN IF EXISTS sender_identity_id;
ALTER TABLE send_rate_limits DROP COLUMN IF EXISTS identity_id;

-- Drop the email_sender_identities table
DROP TABLE IF EXISTS email_sender_identities;