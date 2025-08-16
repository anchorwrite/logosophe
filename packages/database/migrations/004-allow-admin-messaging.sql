-- Migration: 004-allow-admin-messaging.sql
-- Description: Allow admin users (Credentials provider) to send messages without requiring Subscribers table membership
-- Created: 2025-08-13
-- Status: Not yet applied

-- =============================================================================
-- ALLOW ADMIN MESSAGING
-- =============================================================================

-- Disable foreign key constraints temporarily
PRAGMA foreign_keys=OFF;

-- Add SenderType column to distinguish between subscribers and admin users
ALTER TABLE Messages ADD COLUMN SenderType TEXT DEFAULT 'subscriber' CHECK (SenderType IN ('subscriber', 'admin', 'tenant'));

-- Update existing records to set the correct SenderType
UPDATE Messages 
SET SenderType = CASE 
    WHEN EXISTS(SELECT 1 FROM Credentials c WHERE c.Email = Messages.SenderEmail) THEN 'admin'
    ELSE 'subscriber'
END;

-- Add RecipientType column to MessageRecipients for consistency
ALTER TABLE MessageRecipients ADD COLUMN RecipientType TEXT DEFAULT 'subscriber' CHECK (RecipientType IN ('subscriber', 'admin', 'tenant'));

-- Update existing recipient records to set the correct type
UPDATE MessageRecipients 
SET RecipientType = CASE 
    WHEN EXISTS(SELECT 1 FROM Credentials c WHERE c.Email = MessageRecipients.RecipientEmail) THEN 'admin'
    ELSE 'subscriber'
END;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON Messages(SenderType);
CREATE INDEX IF NOT EXISTS idx_message_recipients_recipient_type ON MessageRecipients(RecipientType);

-- Re-enable foreign key constraints
PRAGMA foreign_keys=ON;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify the new table structure
-- PRAGMA table_info(Messages);

-- Verify foreign key constraints
-- PRAGMA foreign_key_list(Messages);

-- Test that admin users can now send messages
-- INSERT INTO Messages (Subject, Body, SenderEmail, SenderType, TenantId, MessageType) 
-- VALUES ('Test Admin Message', 'This is a test message from an admin user', 'admin@example.com', 'admin', 'default', 'direct');

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================

-- This migration:
-- 1. Adds a SenderType column to distinguish between subscribers and admin users
-- 2. Keeps the existing foreign key constraint on TenantId (which is good)
-- 3. Adds a RecipientType column to MessageRecipients for consistency
-- 4. Maintains data integrity while allowing admin messaging
-- 5. Preserves all existing message data

-- After applying this migration:
-- - Admin users (Credentials provider) can send messages to any tenant they have access to
-- - Tenant admins can only send to their assigned tenants
-- - Subscribers can still send messages as before
-- - All existing messages are preserved with appropriate SenderType values
-- - The TenantId foreign key constraint remains for data integrity
