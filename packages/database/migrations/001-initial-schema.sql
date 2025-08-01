-- Migration: 001-initial-schema.sql
-- Description: Initial database schema for Logosophe
-- Created: 2025-08-01
-- Status: Applied to both local and remote databases

-- =============================================================================
-- AUTHENTICATION TABLES
-- =============================================================================

-- Credentials table for admin/tenant users
CREATE TABLE IF NOT EXISTS "Credentials" (
    "Email" VARCHAR(8000) PRIMARY KEY,
    "Password" VARCHAR(8000) NULL,
    "Role" VARCHAR(8000) NULL,
    CreatedAt TEXT,
    UpdatedAt TEXT
);

-- Subscribers table for regular users
CREATE TABLE IF NOT EXISTS "Subscribers" (
    Email TEXT PRIMARY KEY,
    EmailVerified DATETIME,
    Name TEXT,
    Joined DATETIME,
    Signin DATETIME,
    Left DATETIME,
    Active BOOLEAN DEFAULT false,
    Banned BOOLEAN DEFAULT false,
    Post BOOLEAN DEFAULT false,
    Moderate BOOLEAN DEFAULT false,
    Track BOOLEAN DEFAULT false,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    'Provider' TEXT DEFAULT 'credentials'
);

-- =============================================================================
-- TENANT MANAGEMENT
-- =============================================================================

-- Tenants table
CREATE TABLE IF NOT EXISTS "Tenants" (
    Id TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TenantUsers table for user-tenant relationships
CREATE TABLE IF NOT EXISTS "TenantUsers" (
    TenantId TEXT NOT NULL,
    Email TEXT NOT NULL,
    RoleId TEXT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (TenantId, Email)
);

-- UserRoles table for additional role assignments
CREATE TABLE IF NOT EXISTS "UserRoles" (
    TenantId TEXT NOT NULL,
    Email TEXT NOT NULL,
    RoleId TEXT NOT NULL,
    PRIMARY KEY (TenantId, Email, RoleId),
    FOREIGN KEY (TenantId, Email) REFERENCES TenantUsers(TenantId, Email) ON DELETE CASCADE,
    FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE
);

-- =============================================================================
-- ROLES AND PERMISSIONS
-- =============================================================================

-- Roles table
CREATE TABLE IF NOT EXISTS "Roles" (
    Id TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Description TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS "Permissions" (
    Id TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Description TEXT,
    Resource TEXT,
    Action TEXT
);

-- RolePermissions table for role-permission mappings
CREATE TABLE IF NOT EXISTS "RolePermissions" (
    RoleId TEXT NOT NULL,
    PermissionId TEXT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (RoleId, PermissionId),
    FOREIGN KEY (RoleId) REFERENCES Roles(Id),
    FOREIGN KEY (PermissionId) REFERENCES Permissions(Id)
);

-- =============================================================================
-- MEDIA MANAGEMENT
-- =============================================================================

-- MediaFiles table
CREATE TABLE IF NOT EXISTS "MediaFiles" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    FileName TEXT NOT NULL,
    OriginalName TEXT NOT NULL,
    FileSize INTEGER NOT NULL,
    MimeType TEXT NOT NULL,
    R2Key TEXT NOT NULL,
    TenantId TEXT NOT NULL,
    UploadedBy TEXT NOT NULL,
    UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    IsDeleted BOOLEAN DEFAULT 0,
    DeletedAt DATETIME,
    DeletedBy TEXT,
    FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    FOREIGN KEY (UploadedBy) REFERENCES Subscribers(Email)
);

-- MediaAccess table for role-based access control
CREATE TABLE IF NOT EXISTS "MediaAccess" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MediaId INTEGER NOT NULL,
    TenantId TEXT NOT NULL,
    RoleId TEXT NOT NULL,
    AccessType TEXT NOT NULL CHECK (AccessType IN ('view', 'download', 'edit', 'delete', 'upload')),
    GrantedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    GrantedBy TEXT NOT NULL,
    ExpiresAt DATETIME,
    FOREIGN KEY (MediaId) REFERENCES MediaFiles(Id) ON DELETE CASCADE,
    FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

-- MediaAccessTemplates table for default access patterns
CREATE TABLE IF NOT EXISTS "MediaAccessTemplates" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    RoleId TEXT NOT NULL,
    AccessType TEXT NOT NULL CHECK (AccessType IN ('view', 'download', 'edit', 'delete')),
    FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

-- MediaShareLinks table for sharing media files
CREATE TABLE IF NOT EXISTS "MediaShareLinks" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MediaId INTEGER NOT NULL,
    ShareToken TEXT UNIQUE NOT NULL,
    CreatedBy TEXT NOT NULL,
    TenantId TEXT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt DATETIME,
    MaxAccesses INTEGER,
    AccessCount INTEGER DEFAULT 0,
    FOREIGN KEY (MediaId) REFERENCES MediaFiles(Id) ON DELETE CASCADE,
    FOREIGN KEY (CreatedBy) REFERENCES Subscribers(Email)
);

-- =============================================================================
-- MESSAGING SYSTEM
-- =============================================================================

-- Messages table
CREATE TABLE IF NOT EXISTS "Messages" (
    Id TEXT PRIMARY KEY,
    SenderEmail TEXT NOT NULL,
    Subject TEXT,
    Content TEXT NOT NULL,
    MessageType TEXT NOT NULL CHECK (MessageType IN ('direct', 'broadcast', 'announcement')),
    Status TEXT NOT NULL DEFAULT 'sent' CHECK (Status IN ('sent', 'delivered', 'read', 'deleted')),
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL,
    ReadAt TEXT,
    DeletedAt TEXT,
    IsRecalled BOOLEAN DEFAULT FALSE,
    RecallRequestedAt TEXT,
    RecallRequestedBy TEXT,
    FOREIGN KEY (SenderEmail) REFERENCES Subscribers(Email)
);

-- MessageRecipients table for message delivery
CREATE TABLE IF NOT EXISTS "MessageRecipients" (
    MessageId TEXT NOT NULL,
    RecipientEmail TEXT NOT NULL,
    Status TEXT NOT NULL DEFAULT 'pending' CHECK (Status IN ('pending', 'delivered', 'read', 'deleted')),
    DeliveredAt TEXT,
    ReadAt TEXT,
    DeletedAt TEXT,
    PRIMARY KEY (MessageId, RecipientEmail),
    FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
    FOREIGN KEY (RecipientEmail) REFERENCES Subscribers(Email)
);

-- MessageAttachments table for media file attachments
CREATE TABLE IF NOT EXISTS "MessageAttachments" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId TEXT NOT NULL,
    MediaFileId INTEGER NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
    FOREIGN KEY (MediaFileId) REFERENCES MediaFiles(Id) ON DELETE CASCADE
);

-- MessageThreads table for reply threading
CREATE TABLE IF NOT EXISTS "MessageThreads" (
    Id TEXT PRIMARY KEY,
    ParentMessageId TEXT NOT NULL,
    ChildMessageId TEXT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ParentMessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
    FOREIGN KEY (ChildMessageId) REFERENCES Messages(Id) ON DELETE CASCADE
);

-- MessageRateLimits table for rate limiting
CREATE TABLE IF NOT EXISTS "MessageRateLimits" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserEmail TEXT NOT NULL,
    MessageCount INTEGER DEFAULT 0,
    ResetTime DATETIME NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserEmail) REFERENCES Subscribers(Email)
);

-- UserBlocks table for user blocking
CREATE TABLE IF NOT EXISTS "UserBlocks" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    BlockerEmail TEXT NOT NULL,
    BlockedEmail TEXT NOT NULL,
    TenantId TEXT NOT NULL,
    Reason TEXT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    IsActive BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (BlockerEmail) REFERENCES Subscribers(Email),
    FOREIGN KEY (BlockedEmail) REFERENCES Subscribers(Email),
    FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    UNIQUE(BlockerEmail, BlockedEmail, TenantId)
);

-- =============================================================================
-- WORKFLOW SYSTEM
-- =============================================================================

-- Workflows table
CREATE TABLE IF NOT EXISTS "Workflows" (
    Id TEXT PRIMARY KEY,
    TenantId TEXT NOT NULL,
    InitiatorEmail TEXT NOT NULL,
    Title TEXT,
    Status TEXT NOT NULL DEFAULT 'active' CHECK (Status IN ('active', 'completed', 'terminated', 'deleted', 'reactivated')),
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL,
    CompletedAt TEXT,
    CompletedBy TEXT
);

-- WorkflowHistory table for workflow audit trail
CREATE TABLE IF NOT EXISTS "WorkflowHistory" (
    Id TEXT PRIMARY KEY,
    WorkflowId TEXT NOT NULL,
    TenantId TEXT NOT NULL,
    InitiatorEmail TEXT NOT NULL,
    Title TEXT NOT NULL,
    Status TEXT NOT NULL,
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL,
    CompletedAt TEXT,
    CompletedBy TEXT,
    DeletedAt TEXT,
    DeletedBy TEXT,
    EventType TEXT NOT NULL CHECK (EventType IN ('created', 'updated', 'completed', 'terminated', 'deleted', 'reactivated')),
    EventTimestamp TEXT NOT NULL,
    EventPerformedBy TEXT NOT NULL
);

-- WorkflowMessages table for workflow communication
CREATE TABLE IF NOT EXISTS "WorkflowMessages" (
    Id TEXT PRIMARY KEY,
    WorkflowId TEXT NOT NULL,
    SenderEmail TEXT NOT NULL,
    MessageType TEXT NOT NULL CHECK (MessageType IN ('request', 'response', 'upload', 'share_link')),
    Content TEXT NOT NULL,
    MediaFileId INTEGER,
    ShareToken TEXT,
    CreatedAt TEXT NOT NULL,
    FOREIGN KEY (WorkflowId) REFERENCES Workflows(Id) ON DELETE CASCADE
);

-- WorkflowParticipants table for workflow participants
CREATE TABLE IF NOT EXISTS "WorkflowParticipants" (
    WorkflowId TEXT NOT NULL,
    ParticipantEmail TEXT NOT NULL,
    Role TEXT NOT NULL CHECK (Role IN ('initiator', 'recipient')),
    JoinedAt TEXT NOT NULL,
    PRIMARY KEY (WorkflowId, ParticipantEmail),
    FOREIGN KEY (WorkflowId) REFERENCES Workflows(Id) ON DELETE CASCADE
);

-- =============================================================================
-- SYSTEM TABLES
-- =============================================================================

-- SystemLogs table for audit logging
CREATE TABLE IF NOT EXISTS "SystemLogs" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    LogType TEXT NOT NULL,
    Timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UserId TEXT,
    UserEmail TEXT,
    Provider TEXT,
    TenantId TEXT,
    ActivityType TEXT,
    AccessType TEXT,
    TargetId TEXT,
    TargetName TEXT,
    IpAddress TEXT,
    UserAgent TEXT,
    Metadata TEXT,
    IsDeleted BOOLEAN DEFAULT 0
);

-- SystemSettings table for system configuration
CREATE TABLE IF NOT EXISTS "SystemSettings" (
    Key TEXT PRIMARY KEY,
    Value TEXT NOT NULL,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedBy TEXT NOT NULL
);

-- UserActivity table for user activity tracking
CREATE TABLE IF NOT EXISTS "UserActivity" (
    Id TEXT PRIMARY KEY,
    UserId TEXT NOT NULL,
    Email TEXT NOT NULL,
    Provider TEXT NOT NULL,
    ActivityType TEXT NOT NULL CHECK (ActivityType IN ('signin', 'signout')),
    ActivityTime TEXT NOT NULL,
    IpAddress TEXT,
    UserAgent TEXT,
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL
);

-- UserAvatars table for user profile pictures
CREATE TABLE IF NOT EXISTS "UserAvatars" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId TEXT NOT NULL,
    R2Key TEXT NOT NULL,
    IsPreset BOOLEAN DEFAULT false,
    UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UploadedBy TEXT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    IsActive BOOLEAN DEFAULT 1,
    FOREIGN KEY (UserId) REFERENCES users(id)
);

-- TestSessions table for testing sessions
CREATE TABLE IF NOT EXISTS "TestSessions" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    SessionToken TEXT UNIQUE NOT NULL,
    TestUserEmail TEXT NOT NULL,
    CreatedBy TEXT NOT NULL,
    CreatedAt TEXT NOT NULL,
    LastAccessed TEXT,
    IpAddress TEXT,
    UserAgent TEXT
);

-- =============================================================================
-- RESOURCE MANAGEMENT
-- =============================================================================

-- Resources table
CREATE TABLE IF NOT EXISTS "Resources" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Type TEXT NOT NULL CHECK (Type IN ('page', 'api', 'content', 'media')),
    Name TEXT NOT NULL,
    Description TEXT
);

-- ResourceAccess table for resource access control
CREATE TABLE IF NOT EXISTS "ResourceAccess" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ResourceId INTEGER NOT NULL,
    RoleId TEXT NOT NULL,
    AccessLevel TEXT NOT NULL CHECK (AccessLevel IN ('full', 'write', 'read', 'none')),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ResourceId) REFERENCES Resources(Id),
    FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

-- TenantResources table for tenant-resource relationships
CREATE TABLE IF NOT EXISTS "TenantResources" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    TenantId TEXT NOT NULL,
    ResourceId INTEGER NOT NULL,
    AccessLevel TEXT NOT NULL CHECK (AccessLevel IN ('full', 'write', 'read', 'none')),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    FOREIGN KEY (ResourceId) REFERENCES Resources(Id)
);

-- PublishedContent table for content publishing
CREATE TABLE IF NOT EXISTS "PublishedContent" (
    Id TEXT PRIMARY KEY,
    MediaId INTEGER NOT NULL,
    PublisherId TEXT NOT NULL,
    PublishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PublishingSettings JSON,
    ApprovalStatus TEXT DEFAULT 'approved' CHECK (ApprovalStatus IN ('pending', 'approved', 'rejected')),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MediaId) REFERENCES MediaFiles(Id),
    FOREIGN KEY (PublisherId) REFERENCES TenantUsers(Email)
);

-- Preferences table for user preferences
CREATE TABLE IF NOT EXISTS "Preferences" (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserEmail TEXT NOT NULL,
    PreferenceKey TEXT NOT NULL,
    PreferenceValue TEXT,
    Language TEXT DEFAULT 'en' CHECK (Language IN ('en', 'de', 'es', 'fr', 'nl')),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(UserEmail, PreferenceKey)
);

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert default roles
INSERT OR IGNORE INTO "Roles" (Id, Name, Description) VALUES
('admin', 'Administrator', 'Full system access'),
('tenant', 'Tenant', 'Tenant admin role'),
('author', 'Author', 'Can create and manage content'),
('editor', 'Editor', 'Can edit and review content'),
('subscriber', 'Subscriber', 'Basic subscriber access'),
('agent', 'Agent', 'Limited access role'),
('reviewer', 'Reviewer', 'Can review content'),
('user', 'User', 'Basic user role'),
('publisher', 'Publisher', 'Can publish content');

-- Insert workflow permissions
INSERT OR IGNORE INTO "Permissions" (Id, Name, Description, Resource, Action) VALUES
('workflow.initiate', 'Initiate Workflow', 'Can start workflow processes', 'workflow', 'initiate'),
('workflow.respond', 'Respond to Workflow', 'Can respond to workflow requests', 'workflow', 'respond'),
('workflow.view', 'View Workflow', 'Can view workflow history', 'workflow', 'view'),
('workflow.manage', 'Manage Workflow', 'Can manage workflow settings', 'workflow', 'manage'),
('workflow.complete', 'Complete Workflow', 'Can complete workflow processes', 'workflow', 'complete');

-- Insert role permissions
INSERT OR IGNORE INTO "RolePermissions" (RoleId, PermissionId) VALUES
-- Admin gets all workflow permissions
('admin', 'workflow.initiate'),
('admin', 'workflow.respond'),
('admin', 'workflow.view'),
('admin', 'workflow.manage'),
('admin', 'workflow.complete'),
-- Author can initiate workflows and view them
('author', 'workflow.initiate'),
('author', 'workflow.view'),
('author', 'workflow.complete'),
-- Editor can respond to workflows and view them
('editor', 'workflow.respond'),
('editor', 'workflow.view'),
-- Agent can respond to workflows and view them
('agent', 'workflow.respond'),
('agent', 'workflow.view'),
-- Reviewer can respond to workflows and view them
('reviewer', 'workflow.respond'),
('reviewer', 'workflow.view'),
-- Subscriber can view workflows (basic access)
('subscriber', 'workflow.view');

-- Insert media access templates
INSERT OR IGNORE INTO "MediaAccessTemplates" (Id, RoleId, AccessType) VALUES
(1, 'author', 'view'),
(2, 'author', 'download'),
(3, 'author', 'edit'),
(4, 'author', 'delete'),
(5, 'subscriber', 'view'),
(6, 'agent', 'view'),
(7, 'agent', 'download');

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- MediaFiles indexes
CREATE INDEX IF NOT EXISTS idx_mediafiles_tenantid ON MediaFiles(TenantId);
CREATE INDEX IF NOT EXISTS idx_mediafiles_uploadedby ON MediaFiles(UploadedBy);
CREATE INDEX IF NOT EXISTS idx_mediafiles_uploadedat ON MediaFiles(UploadedAt);
CREATE INDEX IF NOT EXISTS idx_mediafiles_isdeleted ON MediaFiles(IsDeleted);

-- MediaAccess indexes
CREATE INDEX IF NOT EXISTS idx_mediaaccess_mediaid ON MediaAccess(MediaId);
CREATE INDEX IF NOT EXISTS idx_mediaaccess_tenantid ON MediaAccess(TenantId);
CREATE INDEX IF NOT EXISTS idx_mediaaccess_roleid ON MediaAccess(RoleId);

-- MediaShareLinks indexes
CREATE INDEX IF NOT EXISTS idx_mediasharelinks_mediid ON MediaShareLinks(MediaId);
CREATE INDEX IF NOT EXISTS idx_mediasharelinks_sharetoken ON MediaShareLinks(ShareToken);
CREATE INDEX IF NOT EXISTS idx_mediasharelinks_createdby ON MediaShareLinks(CreatedBy);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_senderemail ON Messages(SenderEmail);
CREATE INDEX IF NOT EXISTS idx_messages_createdat ON Messages(CreatedAt);
CREATE INDEX IF NOT EXISTS idx_messages_status ON Messages(Status);

-- MessageRecipients indexes
CREATE INDEX IF NOT EXISTS idx_messagerecipients_messageid ON MessageRecipients(MessageId);
CREATE INDEX IF NOT EXISTS idx_messagerecipients_recipientemail ON MessageRecipients(RecipientEmail);
CREATE INDEX IF NOT EXISTS idx_messagerecipients_status ON MessageRecipients(Status);

-- TenantUsers indexes
CREATE INDEX IF NOT EXISTS idx_tenantusers_tenantid ON TenantUsers(TenantId);
CREATE INDEX IF NOT EXISTS idx_tenantusers_email ON TenantUsers(Email);
CREATE INDEX IF NOT EXISTS idx_tenantusers_roleid ON TenantUsers(RoleId);

-- UserRoles indexes
CREATE INDEX IF NOT EXISTS idx_userroles_tenantid ON UserRoles(TenantId);
CREATE INDEX IF NOT EXISTS idx_userroles_email ON UserRoles(Email);
CREATE INDEX IF NOT EXISTS idx_userroles_roleid ON UserRoles(RoleId);

-- SystemLogs indexes
CREATE INDEX IF NOT EXISTS idx_systemlogs_logtype ON SystemLogs(LogType);
CREATE INDEX IF NOT EXISTS idx_systemlogs_timestamp ON SystemLogs(Timestamp);
CREATE INDEX IF NOT EXISTS idx_systemlogs_useremail ON SystemLogs(UserEmail);
CREATE INDEX IF NOT EXISTS idx_systemlogs_tenantid ON SystemLogs(TenantId);

-- Workflows indexes
CREATE INDEX IF NOT EXISTS idx_workflows_tenantid ON Workflows(TenantId);
CREATE INDEX IF NOT EXISTS idx_workflows_initiatoremail ON Workflows(InitiatorEmail);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON Workflows(Status);
CREATE INDEX IF NOT EXISTS idx_workflows_createdat ON Workflows(CreatedAt);

-- UserBlocks indexes
CREATE INDEX IF NOT EXISTS idx_userblocks_blockeremail ON UserBlocks(BlockerEmail);
CREATE INDEX IF NOT EXISTS idx_userblocks_blockedemail ON UserBlocks(BlockedEmail);
CREATE INDEX IF NOT EXISTS idx_userblocks_tenantid ON UserBlocks(TenantId);
CREATE INDEX IF NOT EXISTS idx_userblocks_isactive ON UserBlocks(IsActive);

-- MessageRateLimits indexes
CREATE INDEX IF NOT EXISTS idx_messageratelimits_useremail ON MessageRateLimits(UserEmail);
CREATE INDEX IF NOT EXISTS idx_messageratelimits_resettime ON MessageRateLimits(ResetTime); 