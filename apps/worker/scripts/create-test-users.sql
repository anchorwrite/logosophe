-- Test User Management Script
-- This script creates 50 test users and 6 test tenants

-- Create test tenants
INSERT OR IGNORE INTO Tenants (Id, Name, Description, CreatedAt, UpdatedAt) VALUES
('test-tenant-1', 'Test Tenant 1', 'Test Tenant 1', datetime('now'), datetime('now')),
('test-tenant-2', 'Test Tenant 2', 'Test Tenant 2', datetime('now'), datetime('now')),
('test-tenant-3', 'Test Tenant 3', 'Test Tenant 3', datetime('now'), datetime('now')),
('test-tenant-4', 'Test Tenant 4', 'Test Tenant 4', datetime('now'), datetime('now')),
('test-tenant-5', 'Test Tenant 5', 'Test Tenant 5', datetime('now'), datetime('now')),
('test-tenant-6', 'Test Tenant 6', 'Test Tenant 6', datetime('now'), datetime('now'));

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


-- Create additional tenant users (410-479) - 70 users distributed across 6 tenants
-- Tenant 1 users (410-419)
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('test-tenant-1', 'test-user-410@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-411@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-412@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-413@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-414@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-415@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-416@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-417@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-418@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-1', 'test-user-419@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-410@logosophe.test', 'Test User 410', 1, 'Test', datetime('now'), datetime('now')),
('test-user-411@logosophe.test', 'Test User 411', 1, 'Test', datetime('now'), datetime('now')),
('test-user-412@logosophe.test', 'Test User 412', 1, 'Test', datetime('now'), datetime('now')),
('test-user-413@logosophe.test', 'Test User 413', 1, 'Test', datetime('now'), datetime('now')),
('test-user-414@logosophe.test', 'Test User 414', 1, 'Test', datetime('now'), datetime('now')),
('test-user-415@logosophe.test', 'Test User 415', 1, 'Test', datetime('now'), datetime('now')),
('test-user-416@logosophe.test', 'Test User 416', 1, 'Test', datetime('now'), datetime('now')),
('test-user-417@logosophe.test', 'Test User 417', 1, 'Test', datetime('now'), datetime('now')),
('test-user-418@logosophe.test', 'Test User 418', 1, 'Test', datetime('now'), datetime('now')),
('test-user-419@logosophe.test', 'Test User 419', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('test-tenant-1', 'test-user-410@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-410@logosophe.test', 'author'),
('test-tenant-1', 'test-user-411@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-411@logosophe.test', 'agent'),
('test-tenant-1', 'test-user-412@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-412@logosophe.test', 'reviewer'),
('test-tenant-1', 'test-user-413@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-413@logosophe.test', 'editor'),
('test-tenant-1', 'test-user-414@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-414@logosophe.test', 'author'),
('test-tenant-1', 'test-user-414@logosophe.test', 'reviewer'),
('test-tenant-1', 'test-user-415@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-415@logosophe.test', 'agent'),
('test-tenant-1', 'test-user-415@logosophe.test', 'reviewer'),
('test-tenant-1', 'test-user-416@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-416@logosophe.test', 'author'),
('test-tenant-1', 'test-user-416@logosophe.test', 'editor'),
('test-tenant-1', 'test-user-417@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-417@logosophe.test', 'agent'),
('test-tenant-1', 'test-user-417@logosophe.test', 'editor'),
('test-tenant-1', 'test-user-418@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-418@logosophe.test', 'reviewer'),
('test-tenant-1', 'test-user-418@logosophe.test', 'editor'),
('test-tenant-1', 'test-user-419@logosophe.test', 'subscriber'),
('test-tenant-1', 'test-user-419@logosophe.test', 'author'),
('test-tenant-1', 'test-user-419@logosophe.test', 'agent');

-- Tenant 2 users (420-429)
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('test-tenant-2', 'test-user-420@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-421@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-422@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-423@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-424@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-425@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-426@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-427@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-428@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-2', 'test-user-429@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-420@logosophe.test', 'Test User 420', 1, 'Test', datetime('now'), datetime('now')),
('test-user-421@logosophe.test', 'Test User 421', 1, 'Test', datetime('now'), datetime('now')),
('test-user-422@logosophe.test', 'Test User 422', 1, 'Test', datetime('now'), datetime('now')),
('test-user-423@logosophe.test', 'Test User 423', 1, 'Test', datetime('now'), datetime('now')),
('test-user-424@logosophe.test', 'Test User 424', 1, 'Test', datetime('now'), datetime('now')),
('test-user-425@logosophe.test', 'Test User 425', 1, 'Test', datetime('now'), datetime('now')),
('test-user-426@logosophe.test', 'Test User 426', 1, 'Test', datetime('now'), datetime('now')),
('test-user-427@logosophe.test', 'Test User 427', 1, 'Test', datetime('now'), datetime('now')),
('test-user-428@logosophe.test', 'Test User 428', 1, 'Test', datetime('now'), datetime('now')),
('test-user-429@logosophe.test', 'Test User 429', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('test-tenant-2', 'test-user-420@logosophe.test', 'subscriber'),
('test-tenant-2', 'test-user-420@logosophe.test', 'agent'),
('test-tenant-2', 'test-user-421@logosophe.test', 'subscriber'),
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
('test-tenant-2', 'test-user-425@logosophe.test', 'agent'),
('test-tenant-2', 'test-user-426@logosophe.test', 'subscriber'),
('test-tenant-2', 'test-user-426@logosophe.test', 'agent'),
('test-tenant-2', 'test-user-426@logosophe.test', 'reviewer'),
('test-tenant-2', 'test-user-427@logosophe.test', 'subscriber'),
('test-tenant-2', 'test-user-427@logosophe.test', 'author'),
('test-tenant-2', 'test-user-427@logosophe.test', 'editor'),
('test-tenant-2', 'test-user-428@logosophe.test', 'subscriber'),
('test-tenant-2', 'test-user-428@logosophe.test', 'agent'),
('test-tenant-2', 'test-user-428@logosophe.test', 'editor'),
('test-tenant-2', 'test-user-429@logosophe.test', 'subscriber'),
('test-tenant-2', 'test-user-429@logosophe.test', 'reviewer'),
('test-tenant-2', 'test-user-429@logosophe.test', 'editor');

-- Tenant 3 users (430-439)
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('test-tenant-3', 'test-user-430@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-431@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-432@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-433@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-434@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-435@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-436@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-437@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-438@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-3', 'test-user-439@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-430@logosophe.test', 'Test User 430', 1, 'Test', datetime('now'), datetime('now')),
('test-user-431@logosophe.test', 'Test User 431', 1, 'Test', datetime('now'), datetime('now')),
('test-user-432@logosophe.test', 'Test User 432', 1, 'Test', datetime('now'), datetime('now')),
('test-user-433@logosophe.test', 'Test User 433', 1, 'Test', datetime('now'), datetime('now')),
('test-user-434@logosophe.test', 'Test User 434', 1, 'Test', datetime('now'), datetime('now')),
('test-user-435@logosophe.test', 'Test User 435', 1, 'Test', datetime('now'), datetime('now')),
('test-user-436@logosophe.test', 'Test User 436', 1, 'Test', datetime('now'), datetime('now')),
('test-user-437@logosophe.test', 'Test User 437', 1, 'Test', datetime('now'), datetime('now')),
('test-user-438@logosophe.test', 'Test User 438', 1, 'Test', datetime('now'), datetime('now')),
('test-user-439@logosophe.test', 'Test User 439', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('test-tenant-3', 'test-user-430@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-430@logosophe.test', 'author'),
('test-tenant-3', 'test-user-431@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-431@logosophe.test', 'agent'),
('test-tenant-3', 'test-user-432@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-432@logosophe.test', 'reviewer'),
('test-tenant-3', 'test-user-433@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-433@logosophe.test', 'editor'),
('test-tenant-3', 'test-user-434@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-434@logosophe.test', 'author'),
('test-tenant-3', 'test-user-434@logosophe.test', 'reviewer'),
('test-tenant-3', 'test-user-435@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-435@logosophe.test', 'agent'),
('test-tenant-3', 'test-user-435@logosophe.test', 'reviewer'),
('test-tenant-3', 'test-user-436@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-436@logosophe.test', 'author'),
('test-tenant-3', 'test-user-436@logosophe.test', 'editor'),
('test-tenant-3', 'test-user-437@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-437@logosophe.test', 'agent'),
('test-tenant-3', 'test-user-437@logosophe.test', 'editor'),
('test-tenant-3', 'test-user-438@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-438@logosophe.test', 'reviewer'),
('test-tenant-3', 'test-user-438@logosophe.test', 'editor'),
('test-tenant-3', 'test-user-439@logosophe.test', 'subscriber'),
('test-tenant-3', 'test-user-439@logosophe.test', 'author'),
('test-tenant-3', 'test-user-439@logosophe.test', 'agent');

-- Tenant 4 users (440-449)
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('test-tenant-4', 'test-user-440@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-441@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-442@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-443@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-444@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-445@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-446@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-447@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-448@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-4', 'test-user-449@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-440@logosophe.test', 'Test User 440', 1, 'Test', datetime('now'), datetime('now')),
('test-user-441@logosophe.test', 'Test User 441', 1, 'Test', datetime('now'), datetime('now')),
('test-user-442@logosophe.test', 'Test User 442', 1, 'Test', datetime('now'), datetime('now')),
('test-user-443@logosophe.test', 'Test User 443', 1, 'Test', datetime('now'), datetime('now')),
('test-user-444@logosophe.test', 'Test User 444', 1, 'Test', datetime('now'), datetime('now')),
('test-user-445@logosophe.test', 'Test User 445', 1, 'Test', datetime('now'), datetime('now')),
('test-user-446@logosophe.test', 'Test User 446', 1, 'Test', datetime('now'), datetime('now')),
('test-user-447@logosophe.test', 'Test User 447', 1, 'Test', datetime('now'), datetime('now')),
('test-user-448@logosophe.test', 'Test User 448', 1, 'Test', datetime('now'), datetime('now')),
('test-user-449@logosophe.test', 'Test User 449', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('test-tenant-4', 'test-user-440@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-440@logosophe.test', 'agent'),
('test-tenant-4', 'test-user-441@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-441@logosophe.test', 'reviewer'),
('test-tenant-4', 'test-user-442@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-442@logosophe.test', 'author'),
('test-tenant-4', 'test-user-442@logosophe.test', 'editor'),
('test-tenant-4', 'test-user-443@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-443@logosophe.test', 'agent'),
('test-tenant-4', 'test-user-443@logosophe.test', 'editor'),
('test-tenant-4', 'test-user-444@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-444@logosophe.test', 'reviewer'),
('test-tenant-4', 'test-user-444@logosophe.test', 'editor'),
('test-tenant-4', 'test-user-445@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-445@logosophe.test', 'author'),
('test-tenant-4', 'test-user-445@logosophe.test', 'agent'),
('test-tenant-4', 'test-user-446@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-446@logosophe.test', 'agent'),
('test-tenant-4', 'test-user-446@logosophe.test', 'reviewer'),
('test-tenant-4', 'test-user-447@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-447@logosophe.test', 'author'),
('test-tenant-4', 'test-user-447@logosophe.test', 'editor'),
('test-tenant-4', 'test-user-448@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-448@logosophe.test', 'agent'),
('test-tenant-4', 'test-user-448@logosophe.test', 'editor'),
('test-tenant-4', 'test-user-449@logosophe.test', 'subscriber'),
('test-tenant-4', 'test-user-449@logosophe.test', 'reviewer'),
('test-tenant-4', 'test-user-449@logosophe.test', 'editor');

-- Tenant 5 users (450-459)
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('test-tenant-5', 'test-user-450@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-5', 'test-user-451@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-5', 'test-user-452@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-5', 'test-user-453@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-5', 'test-user-454@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-5', 'test-user-455@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-5', 'test-user-456@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-5', 'test-user-457@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-5', 'test-user-458@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-5', 'test-user-459@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-450@logosophe.test', 'Test User 450', 1, 'Test', datetime('now'), datetime('now')),
('test-user-451@logosophe.test', 'Test User 451', 1, 'Test', datetime('now'), datetime('now')),
('test-user-452@logosophe.test', 'Test User 452', 1, 'Test', datetime('now'), datetime('now')),
('test-user-453@logosophe.test', 'Test User 453', 1, 'Test', datetime('now'), datetime('now')),
('test-user-454@logosophe.test', 'Test User 454', 1, 'Test', datetime('now'), datetime('now')),
('test-user-455@logosophe.test', 'Test User 455', 1, 'Test', datetime('now'), datetime('now')),
('test-user-456@logosophe.test', 'Test User 456', 1, 'Test', datetime('now'), datetime('now')),
('test-user-457@logosophe.test', 'Test User 457', 1, 'Test', datetime('now'), datetime('now')),
('test-user-458@logosophe.test', 'Test User 458', 1, 'Test', datetime('now'), datetime('now')),
('test-user-459@logosophe.test', 'Test User 459', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('test-tenant-5', 'test-user-450@logosophe.test', 'subscriber'),
('test-tenant-5', 'test-user-450@logosophe.test', 'author'),
('test-tenant-5', 'test-user-451@logosophe.test', 'subscriber'),
('test-tenant-5', 'test-user-451@logosophe.test', 'agent'),
('test-tenant-5', 'test-user-452@logosophe.test', 'subscriber'),
('test-tenant-5', 'test-user-452@logosophe.test', 'reviewer'),
('test-tenant-5', 'test-user-453@logosophe.test', 'subscriber'),
('test-tenant-5', 'test-user-453@logosophe.test', 'editor'),
('test-tenant-5', 'test-user-454@logosophe.test', 'subscriber'),
('test-tenant-5', 'test-user-454@logosophe.test', 'author'),
('test-tenant-5', 'test-user-454@logosophe.test', 'reviewer'),
('test-tenant-5', 'test-user-455@logosophe.test', 'subscriber'),
('test-tenant-5', 'test-user-455@logosophe.test', 'agent'),
('test-tenant-5', 'test-user-455@logosophe.test', 'reviewer'),
('test-tenant-5', 'test-user-456@logosophe.test', 'subscriber'),
('test-tenant-5', 'test-user-456@logosophe.test', 'author'),
('test-tenant-5', 'test-user-456@logosophe.test', 'editor'),
('test-tenant-5', 'test-user-457@logosophe.test', 'subscriber'),
('test-tenant-5', 'test-user-457@logosophe.test', 'agent'),
('test-tenant-5', 'test-user-457@logosophe.test', 'editor'),
('test-tenant-5', 'test-user-458@logosophe.test', 'subscriber'),
('test-tenant-5', 'test-user-458@logosophe.test', 'reviewer'),
('test-tenant-5', 'test-user-458@logosophe.test', 'editor'),
('test-tenant-5', 'test-user-459@logosophe.test', 'subscriber'),
('test-tenant-5', 'test-user-459@logosophe.test', 'author'),
('test-tenant-5', 'test-user-459@logosophe.test', 'agent');

-- Tenant 6 users (460-469)
INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt) VALUES
('test-tenant-6', 'test-user-460@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-6', 'test-user-461@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-6', 'test-user-462@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-6', 'test-user-463@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-6', 'test-user-464@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-6', 'test-user-465@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-6', 'test-user-466@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-6', 'test-user-467@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-6', 'test-user-468@logosophe.test', 'user', datetime('now'), datetime('now')),
('test-tenant-6', 'test-user-469@logosophe.test', 'user', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt) VALUES
('test-user-460@logosophe.test', 'Test User 460', 1, 'Test', datetime('now'), datetime('now')),
('test-user-461@logosophe.test', 'Test User 461', 1, 'Test', datetime('now'), datetime('now')),
('test-user-462@logosophe.test', 'Test User 462', 1, 'Test', datetime('now'), datetime('now')),
('test-user-463@logosophe.test', 'Test User 463', 1, 'Test', datetime('now'), datetime('now')),
('test-user-464@logosophe.test', 'Test User 464', 1, 'Test', datetime('now'), datetime('now')),
('test-user-465@logosophe.test', 'Test User 465', 1, 'Test', datetime('now'), datetime('now')),
('test-user-466@logosophe.test', 'Test User 466', 1, 'Test', datetime('now'), datetime('now')),
('test-user-467@logosophe.test', 'Test User 467', 1, 'Test', datetime('now'), datetime('now')),
('test-user-468@logosophe.test', 'Test User 468', 1, 'Test', datetime('now'), datetime('now')),
('test-user-469@logosophe.test', 'Test User 469', 1, 'Test', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId) VALUES
('test-tenant-6', 'test-user-460@logosophe.test', 'subscriber'),
('test-tenant-6', 'test-user-460@logosophe.test', 'agent'),
('test-tenant-6', 'test-user-461@logosophe.test', 'subscriber'),
('test-tenant-6', 'test-user-461@logosophe.test', 'reviewer'),
('test-tenant-6', 'test-user-462@logosophe.test', 'subscriber'),
('test-tenant-6', 'test-user-462@logosophe.test', 'author'),
('test-tenant-6', 'test-user-462@logosophe.test', 'editor'),
('test-tenant-6', 'test-user-463@logosophe.test', 'subscriber'),
('test-tenant-6', 'test-user-463@logosophe.test', 'agent'),
('test-tenant-6', 'test-user-463@logosophe.test', 'editor'),
('test-tenant-6', 'test-user-464@logosophe.test', 'subscriber'),
('test-tenant-6', 'test-user-464@logosophe.test', 'reviewer'),
('test-tenant-6', 'test-user-464@logosophe.test', 'editor'),
('test-tenant-6', 'test-user-465@logosophe.test', 'subscriber'),
('test-tenant-6', 'test-user-465@logosophe.test', 'author'),
('test-tenant-6', 'test-user-465@logosophe.test', 'agent'),
('test-tenant-6', 'test-user-466@logosophe.test', 'subscriber'),
('test-tenant-6', 'test-user-466@logosophe.test', 'agent'),
('test-tenant-6', 'test-user-466@logosophe.test', 'reviewer'),
('test-tenant-6', 'test-user-467@logosophe.test', 'subscriber'),
('test-tenant-6', 'test-user-467@logosophe.test', 'author'),
('test-tenant-6', 'test-user-467@logosophe.test', 'editor'),
('test-tenant-6', 'test-user-468@logosophe.test', 'subscriber'),
('test-tenant-6', 'test-user-468@logosophe.test', 'agent'),
('test-tenant-6', 'test-user-468@logosophe.test', 'editor'),
('test-tenant-6', 'test-user-469@logosophe.test', 'subscriber'),
('test-tenant-6', 'test-user-469@logosophe.test', 'reviewer'),
('test-tenant-6', 'test-user-469@logosophe.test', 'editor'); 