-- Migration: 005-remove-sender-email-fk.sql
-- Description: Remove the foreign key constraint on SenderEmail to allow admin users to send messages
-- Created: 2025-08-13
-- Status: Not yet applied

-- =============================================================================
-- REMOVE SENDEREMAIL FOREIGN KEY CONSTRAINT
-- =============================================================================

-- Disable foreign key constraints temporarily
PRAGMA foreign_keys=OFF;

-- Create a new Messages table without the SenderEmail foreign key constraint
CREATE TABLE Messages_new (
    Id INTEGER PRIMARY KEY,
    Subject TEXT NOT NULL,
    Body TEXT NOT NULL,
    SenderEmail TEXT NOT NULL,
    SenderType TEXT NOT NULL DEFAULT 'subscriber',
    TenantId TEXT NOT NULL,
    MessageType TEXT NOT NULL DEFAULT 'direct',
    Priority TEXT DEFAULT 'normal',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt DATETIME,
    IsDeleted BOOLEAN DEFAULT FALSE,
    IsRecalled BOOLEAN DEFAULT FALSE,
    RecalledAt DATETIME,
    RecallReason TEXT,
    IsArchived BOOLEAN DEFAULT FALSE,
    ArchivedAt TEXT,
    DeletedAt DATETIME,
    HasAttachments BOOLEAN DEFAULT FALSE,
    AttachmentCount INTEGER DEFAULT 0,
    FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

-- Copy all existing data to the new table
INSERT INTO Messages_new 
SELECT * FROM Messages;

-- Drop the old table and rename the new one
DROP TABLE Messages;
ALTER TABLE Messages_new RENAME TO Messages;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_email ON Messages(SenderEmail);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON Messages(TenantId);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON Messages(CreatedAt);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON Messages(MessageType);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON Messages(SenderType);

-- Re-enable foreign key constraints
PRAGMA foreign_keys=ON;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify the new table structure
-- PRAGMA table_info(Messages);

-- Verify foreign key constraints (should only show TenantId now)
-- PRAGMA foreign_key_list(Messages);

-- Test that admin users can now send messages
-- INSERT INTO Messages (Subject, Body, SenderEmail, SenderType, TenantId, MessageType) 
-- VALUES ('Test Admin Message', 'This is a test message from an admin user', 'admin@example.com', 'admin', 'default', 'direct');

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================

-- This migration:
-- 1. Removes the foreign key constraint on SenderEmail that required it to exist in Subscribers
-- 2. Keeps the foreign key constraint on TenantId for data integrity
-- 3. Preserves all existing message data
-- 4. Maintains the SenderType column for distinguishing between subscribers and admin users
-- 5. Allows admin users (Credentials provider) to send messages without being in Subscribers table

-- After applying this migration:
-- - Admin users can send messages to any tenant they have access to
-- - Tenant admins can only send to their assigned tenants
-- - Subscribers can still send messages as before
-- - All existing messages are preserved
-- - Only the TenantId foreign key constraint remains (which is good for data integrity)
