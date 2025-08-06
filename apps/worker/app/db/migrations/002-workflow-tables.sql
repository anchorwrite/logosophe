-- Workflow tables for Durable Objects system

-- Workflows table
CREATE TABLE IF NOT EXISTS Workflows (
    Id TEXT PRIMARY KEY,
    TenantId TEXT NOT NULL,
    Title TEXT NOT NULL,
    Description TEXT,
    InitiatorEmail TEXT NOT NULL,
    InitiatorRole TEXT NOT NULL,
    Status TEXT NOT NULL DEFAULT 'active' CHECK (Status IN ('active', 'completed', 'cancelled')),
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL,
    CompletedAt TEXT,
    CompletedBy TEXT,
    FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE
);

-- Workflow participants table
CREATE TABLE IF NOT EXISTS WorkflowParticipants (
    Id TEXT PRIMARY KEY,
    WorkflowId TEXT NOT NULL,
    ParticipantEmail TEXT NOT NULL,
    Role TEXT NOT NULL CHECK (Role IN ('initiator', 'editor', 'agent', 'reviewer')),
    JoinedAt TEXT NOT NULL,
    FOREIGN KEY (WorkflowId) REFERENCES Workflows(Id) ON DELETE CASCADE
);

-- Workflow messages table
CREATE TABLE IF NOT EXISTS WorkflowMessages (
    Id TEXT PRIMARY KEY,
    WorkflowId TEXT NOT NULL,
    SenderEmail TEXT NOT NULL,
    MessageType TEXT NOT NULL DEFAULT 'message' CHECK (MessageType IN ('request', 'response', 'upload', 'share_link', 'review', 'message')),
    Content TEXT NOT NULL,
    MediaFileId INTEGER,
    ShareToken TEXT,
    CreatedAt TEXT NOT NULL,
    FOREIGN KEY (WorkflowId) REFERENCES Workflows(Id) ON DELETE CASCADE,
    FOREIGN KEY (MediaFileId) REFERENCES MediaFiles(Id) ON DELETE SET NULL
);

-- Workflow media files table
CREATE TABLE IF NOT EXISTS WorkflowMediaFiles (
    Id TEXT PRIMARY KEY,
    WorkflowId TEXT NOT NULL,
    MediaFileId INTEGER NOT NULL,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (WorkflowId) REFERENCES Workflows(Id) ON DELETE CASCADE,
    FOREIGN KEY (MediaFileId) REFERENCES MediaFiles(Id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_id ON Workflows(TenantId);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON Workflows(Status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON Workflows(CreatedAt);

CREATE INDEX IF NOT EXISTS idx_workflow_participants_workflow_id ON WorkflowParticipants(WorkflowId);
CREATE INDEX IF NOT EXISTS idx_workflow_participants_email ON WorkflowParticipants(ParticipantEmail);

CREATE INDEX IF NOT EXISTS idx_workflow_messages_workflow_id ON WorkflowMessages(WorkflowId);
CREATE INDEX IF NOT EXISTS idx_workflow_messages_created_at ON WorkflowMessages(CreatedAt);
CREATE INDEX IF NOT EXISTS idx_workflow_messages_sender_email ON WorkflowMessages(SenderEmail);

CREATE INDEX IF NOT EXISTS idx_workflow_media_files_workflow_id ON WorkflowMediaFiles(WorkflowId);
CREATE INDEX IF NOT EXISTS idx_workflow_media_files_media_file_id ON WorkflowMediaFiles(MediaFileId); 