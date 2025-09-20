-- Consolidated Test User Creation Script
-- Creates test users with the following structure:
-- - 5 signed users (201-205) - in TenantUsers with 'user' role
-- - 5 opted-in users (301-305) - in TenantUsers, Subscribers, and UserRoles
-- - 20 tenant users (410-444) - distributed across 4 tenants noncontiguously with various roles
-- - 4 test tenants (test-tenant-1 through test-tenant-4)

-- Create test tenants (6 tenants for 30 users)
INSERT OR IGNORE INTO Tenants (Id, Name, Description, CreatedAt, UpdatedAt) VALUES
('test-tenant-1', 'Test Tenant 1', 'Test Tenant 1', datetime('now'), datetime('now')),
('test-tenant-2', 'Test Tenant 2', 'Test Tenant 2', datetime('now'), datetime('now')),
('test-tenant-3', 'Test Tenant 3', 'Test Tenant 3', datetime('now'), datetime('now')),
('test-tenant-4', 'Test Tenant 4', 'Test Tenant 4', datetime('now'), datetime('now'));

-- Create signed users (201-205) - users who have signed in but haven't opted in
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('default', 'test-user-201@logosophe.test', 'user', datetime('now'), datetime('now')),
('default', 'test-user-202@logosophe.test', 'user', datetime('now'), datetime('now')),
('default', 'test-user-203@logosophe.test', 'user', datetime('now'), datetime('now')),
('default', 'test-user-204@logosophe.test', 'user', datetime('now'), datetime('now')),
('default', 'test-user-205@logosophe.test', 'user', datetime('now'), datetime('now'));

-- Create opted-in users (301-305) - users who have signed in and opted in
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('default', 'test-user-301@logosophe.test', 'user', datetime('now'), datetime('now')),
('default', 'test-user-302@logosophe.test', 'user', datetime('now'), datetime('now')),
('default', 'test-user-303@logosophe.test', 'user', datetime('now'), datetime('now')),
('default', 'test-user-304@logosophe.test', 'user', datetime('now'), datetime('now')),
('default', 'test-user-305@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-301@logosophe.test', 'Test User 301', 1, 'Test', datetime('now'), datetime('now')),
('test-user-302@logosophe.test', 'Test User 302', 1, 'Test', datetime('now'), datetime('now')),
('test-user-303@logosophe.test', 'Test User 303', 1, 'Test', datetime('now'), datetime('now')),
('test-user-304@logosophe.test', 'Test User 304', 1, 'Test', datetime('now'), datetime('now')),
('test-user-305@logosophe.test', 'Test User 305', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('default', 'test-user-301@logosophe.test', 'subscriber'),
('default', 'test-user-302@logosophe.test', 'subscriber'),
('default', 'test-user-303@logosophe.test', 'subscriber'),
('default', 'test-user-304@logosophe.test', 'subscriber'),
('default', 'test-user-305@logosophe.test', 'subscriber');

-- Create tenant users (411-445) - 20 users distributed noncontiguously across 4 tenants
-- Each tenant gets 5 users with different role combinations

-- Tenant 1 users (410-414)
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('test-tenant-1', 'test-user-411@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-412@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-413@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-414@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-415@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-411@logosophe.test', 'Test User 411', 1, 'Test', datetime('now'), datetime('now')),
('test-user-412@logosophe.test', 'Test User 412', 1, 'Test', datetime('now'), datetime('now')),
('test-user-413@logosophe.test', 'Test User 413', 1, 'Test', datetime('now'), datetime('now')),
('test-user-414@logosophe.test', 'Test User 414', 1, 'Test', datetime('now'), datetime('now')),
('test-user-415@logosophe.test', 'Test User 415', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('test-tenant-1', 'test-user-411@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-411@logosophe.test', 'author'),
('test-tenant-1', 'test-user-412@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-412@logosophe.test', 'agent'),
('test-tenant-1', 'test-user-413@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-413@logosophe.test', 'reviewer'),
('test-tenant-1', 'test-user-414@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-414@logosophe.test', 'editor'),
('test-tenant-1', 'test-user-415@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-415@logosophe.test', 'author'),
('test-tenant-1', 'test-user-415@logosophe.test', 'reviewer');

-- Tenant 2 users (421-425)
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('test-tenant-2', 'test-user-421@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-422@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-423@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-424@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-425@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-421@logosophe.test', 'Test User 421', 1, 'Test', datetime('now'), datetime('now')),
('test-user-422@logosophe.test', 'Test User 422', 1, 'Test', datetime('now'), datetime('now')),
('test-user-423@logosophe.test', 'Test User 423', 1, 'Test', datetime('now'), datetime('now')),
('test-user-424@logosophe.test', 'Test User 424', 1, 'Test', datetime('now'), datetime('now')),
('test-user-425@logosophe.test', 'Test User 425', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('test-tenant-2', 'test-user-421@logosophe.test', 'subscriber'),
('test-tenant-2', 'test-user-421@logosophe.test', 'agent'),
('test-tenant-2', 'test-user-421@logosophe.test', 'reviewer'),
('test-tenant-2', 'test-user-422@logosophe.test', 'subscriber'),
('test-tenant-2', 'test-user-422@logosophe.test', 'author'),
('test-tenant-2', 'test-user-422@logosophe.test', 'editor'),
('test-tenant-2', 'test-user-423@logosophe.test', 'subscriber'),
('test-tenant-2', 'test-user-423@logosophe.test', 'agent'),
('test-tenant-2', 'test-user-423@logosophe.test', 'editor'),
('test-tenant-2', 'test-user-424@logosophe.test', 'subscriber'),
('test-tenant-2', 'test-user-424@logosophe.test', 'reviewer'),
('test-tenant-2', 'test-user-424@logosophe.test', 'editor'),
('test-tenant-2', 'test-user-425@logosophe.test', 'subscriber'),
('test-tenant-2', 'test-user-425@logosophe.test', 'author'),
('test-tenant-2', 'test-user-425@logosophe.test', 'agent');

-- Tenant 3 users (431-435)
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('test-tenant-3', 'test-user-431@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-432@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-433@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-434@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-435@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-431@logosophe.test', 'Test User 431', 1, 'Test', datetime('now'), datetime('now')),
('test-user-432@logosophe.test', 'Test User 432', 1, 'Test', datetime('now'), datetime('now')),
('test-user-433@logosophe.test', 'Test User 433', 1, 'Test', datetime('now'), datetime('now')),
('test-user-434@logosophe.test', 'Test User 434', 1, 'Test', datetime('now'), datetime('now')),
('test-user-435@logosophe.test', 'Test User 435', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('test-tenant-3', 'test-user-431@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-431@logosophe.test', 'agent'),
('test-tenant-3', 'test-user-432@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-432@logosophe.test', 'reviewer'),
('test-tenant-3', 'test-user-433@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-433@logosophe.test', 'author'),
('test-tenant-3', 'test-user-433@logosophe.test', 'editor'),
('test-tenant-3', 'test-user-434@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-434@logosophe.test', 'agent'),
('test-tenant-3', 'test-user-434@logosophe.test', 'editor'),
('test-tenant-3', 'test-user-435@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-435@logosophe.test', 'reviewer'),
('test-tenant-3', 'test-user-435@logosophe.test', 'editor');

-- Tenant 4 users (441-445)
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('test-tenant-4', 'test-user-441@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-442@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-443@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-444@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-445@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-441@logosophe.test', 'Test User 441', 1, 'Test', datetime('now'), datetime('now')),
('test-user-442@logosophe.test', 'Test User 442', 1, 'Test', datetime('now'), datetime('now')),
('test-user-443@logosophe.test', 'Test User 443', 1, 'Test', datetime('now'), datetime('now')),
('test-user-444@logosophe.test', 'Test User 444', 1, 'Test', datetime('now'), datetime('now')),
('test-user-445@logosophe.test', 'Test User 445', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('test-tenant-4', 'test-user-441@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-441@logosophe.test', 'author'),
('test-tenant-4', 'test-user-441@logosophe.test', 'agent'),
('test-tenant-4', 'test-user-442@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-442@logosophe.test', 'agent'),
('test-tenant-4', 'test-user-442@logosophe.test', 'reviewer'),
('test-tenant-4', 'test-user-443@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-443@logosophe.test', 'author'),
('test-tenant-4', 'test-user-443@logosophe.test', 'editor'),
('test-tenant-4', 'test-user-444@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-444@logosophe.test', 'agent'),
('test-tenant-4', 'test-user-444@logosophe.test', 'editor'),
('test-tenant-4', 'test-user-445@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-445@logosophe.test', 'reviewer'),
('test-tenant-4', 'test-user-445@logosophe.test', 'editor');

-- Create Preferences records for all test users with Test
INSERT OR IGNORE INTO Preferences (Email, Theme, Language, CurrentProvider, CreatedAt, UpdatedAt) VALUES
-- Signed users (201-205)
('test-user-201@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-202@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-203@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-204@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-205@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
-- Opted-in users (301-305)
('test-user-301@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-302@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-303@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-304@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-305@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
-- Tenant users (411-445)
('test-user-411@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-412@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-413@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-414@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-415@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-421@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-422@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-423@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-424@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-425@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-431@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-432@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-433@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-434@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-435@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-441@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-442@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-443@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-444@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now')),
('test-user-445@logosophe.test', 'light', 'en', 'Test', datetime('now'), datetime('now'));

-- Summary of created test data:
-- - 4 test tenants (test-tenant-1 through test-tenant-4)
-- - 5 signed users (test-user-201 through test-user-205) - signed in but not opted in
-- - 5 opted-in users (test-user-301 through test-user-305) - signed in and opted in
-- - 20 tenant users (test-user-411 through test-user-445 noncontiguous) - distributed across 4 tenants with various roles
