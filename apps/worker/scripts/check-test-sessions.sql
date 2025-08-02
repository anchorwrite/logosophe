-- Check current state of TestSessions table
-- Run with: yarn wrangler d1 execute DB --local --file=scripts/check-test-sessions.sql

-- Get count of all sessions
SELECT COUNT(*) as total_sessions FROM TestSessions;

-- Get all sessions with details
SELECT Id, SessionToken, TestUserEmail, CreatedBy, CreatedAt, LastAccessed, IpAddress, UserAgent
FROM TestSessions 
ORDER BY CreatedAt DESC; 