-- Add read tracking for workflow messages
-- This table tracks which participants have read which workflow messages

CREATE TABLE IF NOT EXISTS WorkflowMessageRecipients (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    WorkflowMessageId TEXT NOT NULL,
    ParticipantEmail TEXT NOT NULL,
    IsRead BOOLEAN DEFAULT FALSE,
    ReadAt DATETIME,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (WorkflowMessageId) REFERENCES WorkflowMessages(Id) ON DELETE CASCADE
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_workflow_message_recipients_message 
ON WorkflowMessageRecipients(WorkflowMessageId);

CREATE INDEX IF NOT EXISTS idx_workflow_message_recipients_participant 
ON WorkflowMessageRecipients(ParticipantEmail);

CREATE INDEX IF NOT EXISTS idx_workflow_message_recipients_read 
ON WorkflowMessageRecipients(IsRead);

-- Add unique constraint to prevent duplicate read records
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_message_recipients_unique 
ON WorkflowMessageRecipients(WorkflowMessageId, ParticipantEmail);
