-- Migration: Remove SenderEmail foreign key constraint from Messages table
-- This allows admin users to send messages without being in the Subscribers table

-- Drop existing foreign key constraints
PRAGMA foreign_keys=OFF;

-- Recreate Messages table without the SenderEmail FK constraint
CREATE TABLE Messages_new (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Subject TEXT NOT NULL,
    Body TEXT NOT NULL,
    SenderEmail TEXT NOT NULL, -- No FK constraint
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
    SenderType TEXT DEFAULT 'subscriber',
    FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

-- Recreate MessageRecipients table without RecipientEmail FK constraint
CREATE TABLE MessageRecipients_new (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    RecipientEmail TEXT NOT NULL, -- No FK constraint
    IsRead BOOLEAN DEFAULT FALSE,
    ReadAt DATETIME,
    IsDeleted BOOLEAN DEFAULT FALSE,
    DeletedAt DATETIME,
    IsForwarded BOOLEAN DEFAULT FALSE,
    ForwardedAt DATETIME,
    IsSaved BOOLEAN DEFAULT FALSE,
    SavedAt DATETIME,
    IsReplied BOOLEAN DEFAULT FALSE,
    RepliedAt DATETIME,
    IsArchived BOOLEAN DEFAULT FALSE,
    ArchivedAt TEXT,
    RecipientType TEXT DEFAULT 'subscriber',
    FOREIGN KEY (MessageId) REFERENCES Messages_new(Id) ON DELETE CASCADE
);

-- Recreate MessageAttachments table
CREATE TABLE MessageAttachments_new (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    MediaId INTEGER NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    AttachmentType TEXT DEFAULT 'media_library',
    FileName TEXT,
    FileSize INTEGER,
    ContentType TEXT,
    R2Key TEXT,
    UploadDate TEXT,
    FOREIGN KEY (MessageId) REFERENCES Messages_new(Id) ON DELETE CASCADE,
    FOREIGN KEY (MediaId) REFERENCES MediaFiles(Id)
);

-- Recreate MessageLinks table
CREATE TABLE MessageLinks_new (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    Url TEXT NOT NULL,
    Title TEXT,
    Description TEXT,
    ImageUrl TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    IsDeleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (MessageId) REFERENCES Messages_new(Id) ON DELETE CASCADE
);

-- Copy data from old tables to new tables
INSERT INTO Messages_new SELECT * FROM Messages;
INSERT INTO MessageRecipients_new SELECT * FROM MessageRecipients;
INSERT INTO MessageAttachments_new SELECT * FROM MessageAttachments;
INSERT INTO MessageLinks_new SELECT * FROM MessageLinks;

-- Drop old tables
DROP TABLE MessageLinks;
DROP TABLE MessageAttachments;
DROP TABLE MessageRecipients;
DROP TABLE Messages;

-- Rename new tables
ALTER TABLE Messages_new RENAME TO Messages;
ALTER TABLE MessageRecipients_new RENAME TO MessageRecipients;
ALTER TABLE MessageAttachments_new RENAME TO MessageAttachments;
ALTER TABLE MessageLinks_new RENAME TO MessageLinks;

-- Recreate indexes
CREATE INDEX idx_messages_tenant ON Messages(TenantId);
CREATE INDEX idx_messages_sender ON Messages(SenderEmail);
CREATE INDEX idx_messages_created ON Messages(CreatedAt);
CREATE INDEX idx_messages_deleted ON Messages(IsDeleted);
CREATE INDEX idx_messages_type ON Messages(MessageType);
CREATE INDEX idx_messages_sender_type ON Messages(SenderType);

CREATE INDEX idx_message_recipients_message ON MessageRecipients(MessageId);
CREATE INDEX idx_message_recipients_email ON MessageRecipients(RecipientEmail);
CREATE INDEX idx_message_recipients_read ON MessageRecipients(IsRead);

CREATE INDEX idx_message_attachments_message ON MessageAttachments(MessageId);
CREATE INDEX idx_message_attachments_media ON MessageAttachments(MediaId);

CREATE INDEX idx_message_links_message ON MessageLinks(MessageId);

-- Re-enable foreign key constraints
PRAGMA foreign_keys=ON;
