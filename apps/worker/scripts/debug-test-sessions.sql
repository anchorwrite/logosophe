-- Debug script for TestSessions table
-- Run with: yarn wrangler d1 execute DB --local --file=scripts/debug-test-sessions.sql

-- Check table structure
PRAGMA table_info(TestSessions);

-- Get count of all sessions
SELECT COUNT(*) as total_sessions FROM TestSessions;

-- Get all sessions with full details
SELECT 
  Id, 
  SessionToken, 
  TestUserEmail, 
  CreatedBy, 
  CreatedAt, 
  LastAccessed, 
  IpAddress, 
  UserAgent
FROM TestSessions 
ORDER BY CreatedAt DESC;

-- Check if there are any sessions with NULL values
SELECT COUNT(*) as null_sessions FROM TestSessions WHERE Id IS NULL OR SessionToken IS NULL OR TestUserEmail IS NULL;

-- Check for any sessions that might be causing issues
SELECT * FROM TestSessions WHERE Id IS NULL OR SessionToken IS NULL OR TestUserEmail IS NULL; 