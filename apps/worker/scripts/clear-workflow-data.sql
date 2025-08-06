-- Clear all workflow-related data
-- This script removes all data from workflow tables to start fresh

-- Delete all workflow messages
DELETE FROM WorkflowMessages;

-- Delete all workflow participants
DELETE FROM WorkflowParticipants;

-- Delete all workflow history records
DELETE FROM WorkflowHistory;

-- Delete all workflows
DELETE FROM Workflows;

-- Reset auto-increment counters (if any)
-- Note: SQLite doesn't have auto-increment for TEXT primary keys, so this is just for reference
-- If you had INTEGER primary keys, you would use: DELETE FROM sqlite_sequence WHERE name IN ('Workflows', 'WorkflowMessages', 'WorkflowParticipants', 'WorkflowHistory');

-- Verify the tables are empty
SELECT 'Workflows' as table_name, COUNT(*) as count FROM Workflows
UNION ALL
SELECT 'WorkflowMessages' as table_name, COUNT(*) as count FROM WorkflowMessages
UNION ALL
SELECT 'WorkflowParticipants' as table_name, COUNT(*) as count FROM WorkflowParticipants
UNION ALL
SELECT 'WorkflowHistory' as table_name, COUNT(*) as count FROM WorkflowHistory; 