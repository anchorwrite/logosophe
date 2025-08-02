-- Test User Management Script - Delete
-- This script deletes all test users and tenants

-- Delete test users from UserRoles
DELETE FROM UserRoles 
WHERE Email LIKE 'test-user-%@logosophe.test';

-- Delete test users from TenantUsers
DELETE FROM TenantUsers 
WHERE Email LIKE 'test-user-%@logosophe.test';

-- Delete test users from Subscribers
DELETE FROM Subscribers 
WHERE Email LIKE 'test-user-%@logosophe.test';

-- Delete test tenants
DELETE FROM Tenants 
WHERE Id LIKE 'test-tenant-%'; 