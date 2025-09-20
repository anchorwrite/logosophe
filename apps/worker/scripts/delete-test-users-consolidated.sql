-- Consolidated Test User Deletion Script
-- This script removes all test users and test tenants from the database
-- It follows the same deletion pattern as the user management delete action
-- to ensure proper cleanup of all related records

-- Delete test users from UserRoles table first (has foreign key constraints)
DELETE FROM UserRoles 
WHERE Email LIKE 'test-user-%@logosophe.test';

-- Delete test users from TenantUsers table
DELETE FROM TenantUsers 
WHERE Email LIKE 'test-user-%@logosophe.test';

-- Soft delete test users from Subscribers table (set Active = FALSE)
UPDATE Subscribers 
SET Active = FALSE, 
    Left = CURRENT_TIMESTAMP, 
    EmailVerified = NULL, 
    VerificationToken = NULL, 
    VerificationExpires = NULL 
WHERE Email LIKE 'test-user-%@logosophe.test';

-- Delete test users from Auth.js tables (if they exist)
DELETE FROM accounts 
WHERE userId IN (
    SELECT id FROM users 
    WHERE email LIKE 'test-user-%@logosophe.test'
);

DELETE FROM sessions 
WHERE userId IN (
    SELECT id FROM users 
    WHERE email LIKE 'test-user-%@logosophe.test'
);

DELETE FROM verification_tokens 
WHERE identifier LIKE 'test-user-%@logosophe.test';

-- Delete test users from users table (Auth.js)
DELETE FROM users 
WHERE email LIKE 'test-user-%@logosophe.test';

-- Delete test users from other related tables
DELETE FROM UserAvatars 
WHERE UserId IN (
    SELECT id FROM users 
    WHERE email LIKE 'test-user-%@logosophe.test'
);

DELETE FROM Preferences 
WHERE Email LIKE 'test-user-%@logosophe.test';

-- Delete test users from messaging tables
DELETE FROM Messages 
WHERE SenderEmail LIKE 'test-user-%@logosophe.test';

DELETE FROM MessageRecipients 
WHERE RecipientEmail LIKE 'test-user-%@logosophe.test';

DELETE FROM UserBlocks 
WHERE BlockerEmail LIKE 'test-user-%@logosophe.test' 
   OR BlockedEmail LIKE 'test-user-%@logosophe.test';

DELETE FROM MessageRateLimits 
WHERE SenderEmail LIKE 'test-user-%@logosophe.test';

-- Delete test users from workflow tables
DELETE FROM Workflows 
WHERE InitiatorEmail LIKE 'test-user-%@logosophe.test';

DELETE FROM WorkflowParticipants 
WHERE ParticipantEmail LIKE 'test-user-%@logosophe.test';

-- Delete test users from content tables
DELETE FROM PublishedContent 
WHERE PublisherId LIKE 'test-user-%@logosophe.test';

-- Delete test tenants
DELETE FROM Tenants 
WHERE Id LIKE 'test-tenant-%';

-- Note: SystemLogs records are intentionally NOT deleted to preserve audit trail
-- SystemLogs records will remain for historical purposes

-- Summary of deleted test data:
-- - All test users (test-user-201 through test-user-445)
-- - All test tenants (test-tenant-1 through test-tenant-4)
-- - All related records in UserRoles, TenantUsers, Subscribers, and other tables
-- - Auth.js related records (accounts, sessions, verification_tokens, users)
-- - Messaging, workflow, and content related records
