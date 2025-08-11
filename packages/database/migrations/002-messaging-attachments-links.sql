-- Migration 002: Add messaging attachments and links support
-- This migration adds support for file attachments and link sharing in messages
-- Works with existing MessageAttachments table structure

-- Update existing MessageAttachments table to add missing columns
ALTER TABLE MessageAttachments ADD COLUMN AttachmentType TEXT DEFAULT 'media_library' CHECK (AttachmentType IN ('media_library', 'upload'));
ALTER TABLE MessageAttachments ADD COLUMN FileName TEXT;
ALTER TABLE MessageAttachments ADD COLUMN FileSize INTEGER;
ALTER TABLE MessageAttachments ADD COLUMN ContentType TEXT;

-- Update existing records to have default values
UPDATE MessageAttachments SET 
    AttachmentType = 'media_library',
    FileName = 'Unknown File',
    FileSize = 0,
    ContentType = 'application/octet-stream'
WHERE FileName IS NULL;

-- Make new columns NOT NULL after setting defaults
-- Note: SQLite doesn't support ALTER COLUMN NOT NULL, so we'll handle this in application code

-- Create MessageLinks table for link sharing
CREATE TABLE IF NOT EXISTS MessageLinks (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    Url TEXT NOT NULL,
    Title TEXT,
    Description TEXT,
    ThumbnailUrl TEXT,
    Domain TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON MessageAttachments(MessageId);
CREATE INDEX IF NOT EXISTS idx_message_attachments_media_id ON MessageAttachments(MediaId);
CREATE INDEX IF NOT EXISTS idx_message_attachments_type ON MessageAttachments(AttachmentType);
CREATE INDEX IF NOT EXISTS idx_message_links_message_id ON MessageLinks(MessageId);
CREATE INDEX IF NOT EXISTS idx_message_links_url ON MessageLinks(Url);

-- Add columns to Messages table for attachment tracking
ALTER TABLE Messages ADD COLUMN HasAttachments BOOLEAN DEFAULT FALSE;
ALTER TABLE Messages ADD COLUMN AttachmentCount INTEGER DEFAULT 0;

-- Create index on new columns
CREATE INDEX IF NOT EXISTS idx_messages_has_attachments ON Messages(HasAttachments);
CREATE INDEX IF NOT EXISTS idx_messages_attachment_count ON Messages(AttachmentCount);

-- Update existing messages to reflect current attachment count
UPDATE Messages SET 
    HasAttachments = (
        SELECT COUNT(*) > 0 FROM MessageAttachments ma 
        WHERE ma.MessageId = Messages.Id
    ),
    AttachmentCount = (
        SELECT COUNT(*) FROM MessageAttachments ma 
        WHERE ma.MessageId = Messages.Id
    );

-- Insert initial data if needed
-- (No initial data required for this migration)
