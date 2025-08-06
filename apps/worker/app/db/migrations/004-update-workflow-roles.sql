-- Update WorkflowParticipants table to allow proper role names
-- Remove the constraint that limits roles to 'initiator' and 'recipient'

-- Create a new table with the updated schema
CREATE TABLE WorkflowParticipants_new (
    WorkflowId TEXT NOT NULL,
    ParticipantEmail TEXT NOT NULL,
    Role TEXT NOT NULL,
    JoinedAt TEXT NOT NULL,
    PRIMARY KEY (WorkflowId, ParticipantEmail),
    FOREIGN KEY (WorkflowId) REFERENCES Workflows(Id) ON DELETE CASCADE
);

-- Copy data from old table to new table
INSERT INTO WorkflowParticipants_new 
SELECT WorkflowId, ParticipantEmail, Role, JoinedAt 
FROM WorkflowParticipants;

-- Drop the old table
DROP TABLE WorkflowParticipants;

-- Rename the new table to the original name
ALTER TABLE WorkflowParticipants_new RENAME TO WorkflowParticipants; 