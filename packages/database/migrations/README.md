# Database Migrations

This directory contains database migrations for the Logosophe project.

## Migration Files

### 001-initial-schema.sql
- **Status**: Applied to both local and remote databases
- **Date**: 2025-08-01
- **Description**: Initial database schema with all tables, indexes, and initial data

## Database Schema Overview

### Authentication Tables
- `Credentials` - Admin/tenant users with password authentication
- `Subscribers` - Regular users with OAuth authentication
- `accounts`, `sessions`, `users`, `verification_tokens` - NextAuth.js tables

### Tenant Management
- `Tenants` - Multi-tenant organization structure
- `TenantUsers` - User-tenant relationships with base roles
- `UserRoles` - Additional role assignments for users

### Roles and Permissions
- `Roles` - Available roles in the system
- `Permissions` - Available permissions
- `RolePermissions` - Role-permission mappings

### Media Management
- `MediaFiles` - File storage metadata
- `MediaAccess` - Role-based access control for media
- `MediaAccessTemplates` - Default access patterns
- `MediaShareLinks` - Temporary sharing links

### Messaging System
- `Messages` - Core message storage
- `MessageRecipients` - Message delivery tracking
- `MessageAttachments` - Media file attachments
- `MessageThreads` - Reply threading
- `MessageRateLimits` - Rate limiting per user
- `UserBlocks` - User blocking functionality

### Workflow System
- `Workflows` - Workflow instances
- `WorkflowHistory` - Audit trail for workflows
- `WorkflowMessages` - Workflow communication
- `WorkflowParticipants` - Workflow participants

### System Tables
- `SystemLogs` - Audit logging
- `SystemSettings` - System configuration
- `UserActivity` - User activity tracking
- `UserAvatars` - User profile pictures
- `TestSessions` - Testing sessions

### Resource Management
- `Resources` - System resources
- `ResourceAccess` - Resource access control
- `TenantResources` - Tenant-resource relationships
- `PublishedContent` - Content publishing
- `Preferences` - User preferences

## Applying Migrations

### Local Development
```bash
cd apps/worker
yarn wrangler d1 execute logosophe --file=../../packages/database/migrations/001-initial-schema.sql
```

### Remote Database
```bash
cd apps/worker
yarn wrangler d1 execute logosophe --remote --file=../../packages/database/migrations/001-initial-schema.sql
```

## Migration Guidelines

1. **Use IF NOT EXISTS** - All CREATE TABLE statements should use `IF NOT EXISTS`
2. **Use INSERT OR IGNORE** - All INSERT statements should use `OR IGNORE` to avoid conflicts
3. **Include Indexes** - Add performance indexes for frequently queried columns
4. **Document Changes** - Update this README when adding new migrations
5. **Test Locally First** - Always test migrations on local database before applying to remote

## Database Commands

### List Tables
```bash
yarn wrangler d1 execute logosophe --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

### Check Table Structure
```bash
yarn wrangler d1 execute logosophe --command "PRAGMA table_info(TABLE_NAME);"
```

### Count Records
```bash
yarn wrangler d1 execute logosophe --command "SELECT COUNT(*) FROM TABLE_NAME;"
```

### Backup Database
```bash
yarn wrangler d1 export logosophe --output=backup.sql
```

## Foreign Key Relationships

### User Management
- `TenantUsers` → `Tenants` (TenantId)
- `TenantUsers` → `Roles` (RoleId)
- `UserRoles` → `TenantUsers` (TenantId, Email)
- `UserRoles` → `Roles` (RoleId)

### Media Management
- `MediaFiles` → `Tenants` (TenantId)
- `MediaFiles` → `Subscribers` (UploadedBy)
- `MediaAccess` → `MediaFiles` (MediaId)
- `MediaAccess` → `Roles` (RoleId)
- `MediaShareLinks` → `MediaFiles` (MediaId)
- `MediaShareLinks` → `Subscribers` (CreatedBy)

### Messaging
- `Messages` → `Subscribers` (SenderEmail)
- `MessageRecipients` → `Messages` (MessageId)
- `MessageRecipients` → `Subscribers` (RecipientEmail)
- `MessageAttachments` → `Messages` (MessageId)
- `MessageAttachments` → `MediaFiles` (MediaFileId)
- `UserBlocks` → `Subscribers` (BlockerEmail, BlockedEmail)
- `UserBlocks` → `Tenants` (TenantId)

### Workflows
- `Workflows` → `Tenants` (TenantId)
- `WorkflowMessages` → `Workflows` (WorkflowId)
- `WorkflowParticipants` → `Workflows` (WorkflowId)

## Performance Considerations

- Indexes are created on frequently queried columns
- Foreign key constraints ensure data integrity
- Soft deletes are used where appropriate (IsDeleted flag)
- Audit trails are maintained for important operations

## Security Notes

- Passwords are hashed using bcrypt
- Session tokens are securely managed by NextAuth.js
- Access control is enforced at the database level
- Audit logging tracks all important operations 