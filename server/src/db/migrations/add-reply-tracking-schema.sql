-- Migration: Add Email Reply Tracking Schema
-- This migration adds the necessary tables and indexes for email reply tracking

-- Add new columns to inbound_messages table
ALTER TABLE inbound_messages 
ADD COLUMN IF NOT EXISTS outbound_message_id TEXT REFERENCES outbound_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS thread_id TEXT,
ADD COLUMN IF NOT EXISTS from_email TEXT,
ADD COLUMN IF NOT EXISTS to_email TEXT,
ADD COLUMN IF NOT EXISTS message_id TEXT,
ADD COLUMN IF NOT EXISTS in_reply_to TEXT,
ADD COLUMN IF NOT EXISTS references TEXT,
ADD COLUMN IF NOT EXISTS conversation_id TEXT,
ADD COLUMN IF NOT EXISTS processed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

-- Add indexes for inbound_messages
CREATE INDEX IF NOT EXISTS inbound_messages_thread_idx ON inbound_messages(thread_id);
CREATE INDEX IF NOT EXISTS inbound_messages_outbound_idx ON inbound_messages(outbound_message_id);
CREATE INDEX IF NOT EXISTS inbound_messages_message_id_idx ON inbound_messages(message_id);
CREATE INDEX IF NOT EXISTS inbound_messages_conversation_idx ON inbound_messages(conversation_id);

-- Create email_threads table
CREATE TABLE IF NOT EXISTS email_threads (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL REFERENCES contact_campaigns(id) ON DELETE CASCADE,
    contact_id TEXT NOT NULL REFERENCES lead_point_of_contacts(id) ON DELETE CASCADE,
    original_message_id TEXT NOT NULL REFERENCES outbound_messages(id) ON DELETE CASCADE,
    provider_thread_id TEXT,
    message_id TEXT,
    last_reply_at TIMESTAMP,
    reply_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT email_threads_original_message_unique UNIQUE (original_message_id)
);

-- Add indexes for email_threads
CREATE INDEX IF NOT EXISTS email_threads_tenant_campaign_idx ON email_threads(tenant_id, campaign_id);
CREATE INDEX IF NOT EXISTS email_threads_provider_thread_idx ON email_threads(provider_thread_id);
CREATE INDEX IF NOT EXISTS email_threads_message_id_idx ON email_threads(message_id);

-- Create webhook_subscriptions table
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mail_account_id TEXT NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
    subscription_id TEXT NOT NULL,
    resource_id TEXT,
    webhook_url TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'failed', 'cancelled')),
    last_renewal_at TIMESTAMP,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT webhook_subscriptions_provider_unique UNIQUE (mail_account_id, provider)
);

-- Add indexes for webhook_subscriptions
CREATE INDEX IF NOT EXISTS webhook_subscriptions_user_idx ON webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS webhook_subscriptions_mail_account_idx ON webhook_subscriptions(mail_account_id);
CREATE INDEX IF NOT EXISTS webhook_subscriptions_expires_at_idx ON webhook_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS webhook_subscriptions_status_idx ON webhook_subscriptions(status);

-- Add trigger to update updated_at timestamp for email_threads
CREATE OR REPLACE FUNCTION update_email_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_threads_updated_at
    BEFORE UPDATE ON email_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_email_threads_updated_at();

-- Add trigger to update updated_at timestamp for webhook_subscriptions
CREATE OR REPLACE FUNCTION update_webhook_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_webhook_subscriptions_updated_at
    BEFORE UPDATE ON webhook_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_subscriptions_updated_at();

-- Create a view for easy reply tracking analytics
CREATE OR REPLACE VIEW email_reply_analytics AS
SELECT 
    t.tenant_id,
    t.campaign_id,
    t.contact_id,
    t.original_message_id,
    t.reply_count,
    t.last_reply_at,
    t.created_at as thread_created_at,
    om.content->>'subject' as original_subject,
    om.content->>'to' as recipient_email,
    om.sent_at as original_sent_at,
    CASE 
        WHEN t.reply_count > 0 THEN 'replied'
        ELSE 'no_reply'
    END as reply_status,
    CASE 
        WHEN t.last_reply_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (t.last_reply_at - om.sent_at)) / 3600
        ELSE NULL
    END as hours_to_first_reply
FROM email_threads t
JOIN outbound_messages om ON t.original_message_id = om.id
WHERE t.is_active = true;

-- Add comment for documentation
COMMENT ON TABLE email_threads IS 'Tracks email conversation threads between campaigns and contacts';
COMMENT ON TABLE webhook_subscriptions IS 'Manages active webhook subscriptions for Gmail and Outlook';
COMMENT ON VIEW email_reply_analytics IS 'Analytics view for email reply tracking metrics';

-- Grant necessary permissions (adjust schema name as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON email_threads TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_subscriptions TO your_app_user;
-- GRANT SELECT ON email_reply_analytics TO your_app_user;