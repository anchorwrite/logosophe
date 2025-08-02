-- Script to clean up TestSessions table
-- Run with: yarn wrangler d1 execute DB --local --file=scripts/cleanup-test-sessions.sql

-- Get count before cleanup
SELECT COUNT(*) as count FROM TestSessions;

-- Delete all sessions
DELETE FROM TestSessions;

-- Get count after cleanup
SELECT COUNT(*) as count FROM TestSessions; 