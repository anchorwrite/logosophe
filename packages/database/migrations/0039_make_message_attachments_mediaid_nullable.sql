-- Migration 0039: Make MessageAttachments.MediaId nullable
-- This allows uploaded files to be stored without a MediaId reference

-- SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
CREATE TABLE MessageAttachments_new (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    MediaId INTEGER, -- Made nullable for uploaded files
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    AttachmentType TEXT DEFAULT 'media_library',
    FileName TEXT,
    FileSize INTEGER,
    ContentType TEXT,
    R2Key TEXT,
    UploadDate TEXT,
    FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
    FOREIGN KEY (MediaId) REFERENCES MediaFiles(Id)
);

-- Copy data from old table to new table
INSERT INTO MessageAttachments_new SELECT * FROM MessageAttachments;

-- Drop old table
DROP TABLE MessageAttachments;

-- Rename new table
ALTER TABLE MessageAttachments_new RENAME TO MessageAttachments;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON MessageAttachments(MessageId);
CREATE INDEX IF NOT EXISTS idx_message_attachments_media_id ON MessageAttachments(MediaId);
CREATE INDEX IF NOT EXISTS idx_message_attachments_type ON MessageAttachments(AttachmentType);
