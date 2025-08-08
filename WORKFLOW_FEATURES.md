# Workflow Features Documentation

## Overview

The workflow system provides real-time collaboration capabilities for sharing media files and messaging between team members. It has been migrated from a Durable Objects + WebSocket architecture to a simpler Server-Sent Events (SSE) approach with direct database access.

## Architecture

### Database Schema

#### Core Tables

**Workflows**
- `Id` (TEXT, PRIMARY KEY) - Unique workflow identifier
- `TenantId` (TEXT, NOT NULL) - Associated tenant
- `InitiatorEmail` (TEXT, NOT NULL) - Email of workflow creator
- `Title` (TEXT) - Workflow title
- `Status` (TEXT, NOT NULL, DEFAULT 'active') - Current status
- `CreatedAt` (TEXT, NOT NULL) - Creation timestamp
- `UpdatedAt` (TEXT, NOT NULL) - Last update timestamp
- `CompletedAt` (TEXT) - Completion timestamp
- `CompletedBy` (TEXT) - Email of user who completed

**WorkflowMessages**
- `Id` (TEXT, PRIMARY KEY) - Unique message identifier
- `WorkflowId` (TEXT, NOT NULL) - Associated workflow
- `SenderEmail` (TEXT, NOT NULL) - Email of message sender
- `MessageType` (TEXT, NOT NULL) - Type of message
- `Content` (TEXT, NOT NULL) - Message content
- `MediaFileId` (INTEGER) - Associated media file
- `ShareToken` (TEXT) - Share token for media
- `CreatedAt` (TEXT, NOT NULL) - Creation timestamp

**WorkflowParticipants**
- `WorkflowId` (TEXT, PRIMARY KEY) - Associated workflow
- `ParticipantEmail` (TEXT, PRIMARY KEY) - Email of participant
- `Role` (TEXT, NOT NULL) - Participant role (any valid role name)
- `JoinedAt` (TEXT, NOT NULL) - Join timestamp

**WorkflowHistory**
- `Id` (TEXT, PRIMARY KEY) - Unique history record identifier
- `WorkflowId` (TEXT, NOT NULL) - Associated workflow
- `TenantId` (TEXT, NOT NULL) - Associated tenant
- `InitiatorEmail` (TEXT, NOT NULL) - Email of workflow creator
- `Title` (TEXT, NOT NULL) - Workflow title
- `Status` (TEXT, NOT NULL) - Workflow status at time of event
- `CreatedAt` (TEXT, NOT NULL) - Original workflow creation timestamp
- `UpdatedAt` (TEXT, NOT NULL) - Last update timestamp
- `CompletedAt` (TEXT) - Completion timestamp
- `CompletedBy` (TEXT) - Email of user who completed
- `DeletedAt` (TEXT) - Deletion timestamp
- `DeletedBy` (TEXT) - Email of user who deleted
- `EventType` (TEXT, NOT NULL) - Type of event (created, updated, completed, terminated, deleted, reactivated)
- `EventTimestamp` (TEXT, NOT NULL) - When the event occurred
- `EventPerformedBy` (TEXT, NOT NULL) - Email of user who performed the event

**Note**: The `Role` column in `WorkflowParticipants` was updated to allow any role name (e.g., 'author', 'subscriber', 'editor') instead of being limited to legacy 'initiator'/'recipient' roles. Role names are stored as lowercase role IDs (e.g., 'subscriber', 'author', 'reviewer') for consistency.

### API Routes

The workflow system uses a three-tier API structure to separate concerns and prevent route duplication:

#### Core Workflow Routes (`/api/workflow/`)
**Purpose**: General workflow functionality for all authenticated users
**Access**: All authenticated users with appropriate roles
**Used by**: Harbor components, general workflow interfaces

**`/api/workflow`**
- `POST` - Create new workflow
- `GET` - List workflows for tenant

**`/api/workflow/[id]`**
- `GET` - Get workflow details with messages and participants
- `PUT` - Update workflow (status, title, actions including delete)

**`/api/workflow/[id]/stream`**
- `GET` - SSE endpoint for real-time updates

**`/api/workflow/history`**
- `GET` - Get workflow history for user

**`/api/workflow/history/detail/[id]`**
- `GET` - Get detailed workflow history

#### Harbor-Specific Routes (`/api/harbor/workflow/`)
**Purpose**: Harbor interface-specific functionality
**Access**: Harbor users with appropriate roles
**Used by**: Harbor workflow components only

**`/api/harbor/workflow/messages`**
- `POST` - Send message to workflow

**`/api/harbor/workflow/stats`**
- `GET` - Get workflow statistics for tenant

#### Dashboard-Specific Routes (`/api/dashboard/workflow/`)
**Purpose**: Admin-focused functionality for system management
**Access**: System admins and tenant admins only
**Used by**: Dashboard admin components only

**`/api/dashboard/workflow/list`**
- `GET` - List workflows with admin filtering

**`/api/dashboard/workflow/[id]`**
- `GET` - Admin workflow details and management
- `PUT` - Admin workflow updates

**`/api/dashboard/workflow/stats`**
- `GET` - System-wide workflow statistics

**`/api/dashboard/workflow/analytics`**
- `GET` - Workflow analytics

**`/api/dashboard/workflow/reports`**
- `GET` - Workflow reports

**`/api/dashboard/workflow/history`**
- `GET` - Admin workflow history

**`/api/dashboard/workflow/bulk`**
- `POST` - Bulk workflow operations

**`/api/dashboard/workflow/health`**
- `GET` - System health checks

**`/api/dashboard/workflow/settings`**
- `GET` - System settings
- `PUT` - Update system settings

**Note**: The `/api/harbor/workflow/websocket-url` endpoint has been removed. Frontend components now connect directly to `/api/workflow/[id]/stream` for SSE connections.

### API Usage Guidelines

To prevent route duplication and ensure proper API usage:

#### For Harbor Components
- **Core functionality**: Use `/api/workflow/` endpoints
- **Harbor-specific features**: Use `/api/harbor/workflow/` endpoints
- **Examples**:
  - Workflow creation: `/api/workflow` (POST)
  - Workflow details: `/api/workflow/[id]` (GET)
  - Workflow actions: `/api/workflow/[id]` (PUT with action parameter)
  - Real-time updates: `/api/workflow/[id]/stream` (GET)
  - Send messages: `/api/harbor/workflow/messages` (POST)
  - Get stats: `/api/harbor/workflow/stats` (GET)

#### For Dashboard Components
- **Admin functionality**: Use `/api/dashboard/workflow/` endpoints
- **Examples**:
  - List workflows: `/api/dashboard/workflow/list` (GET)
  - Admin workflow details: `/api/dashboard/workflow/[id]` (GET/PUT)
  - System analytics: `/api/dashboard/workflow/analytics` (GET)
  - System reports: `/api/dashboard/workflow/reports` (GET)
  - Bulk operations: `/api/dashboard/workflow/bulk` (POST)

#### Important Rules
- **DO NOT create new workflow routes** - Use existing routes based on the interface context
- **Check existing APIs first** - Before creating a new route, verify if functionality already exists
- **Use the appropriate tier** - Core APIs for general functionality, Harbor APIs for Harbor features, Dashboard APIs for admin features
- **Maintain separation** - Keep Harbor and Dashboard APIs separate to avoid confusion
- **Use PUT with actions** - All workflow state changes use PUT requests with action parameters, not separate HTTP methods

### Real-Time Communication

#### Server-Sent Events (SSE)

The system uses SSE for real-time updates instead of WebSockets:

```typescript
// Client-side connection
const eventSource = new EventSource(`/api/workflow/${workflowId}/stream`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'connected':
      console.log('Connected to workflow stream');
      break;
    case 'message':
      // Handle new message
      break;
    case 'status_update':
      // Handle status change
      break;
  }
};
```

#### SSE Message Types

- `connected` - Initial connection confirmation
- `message` - New workflow message
- `status_update` - Workflow status change
- `error` - Error notification

#### SSE Implementation Details

- **Polling Interval**: 15 seconds (reduced from 2 seconds for better performance)
- **Duplicate Prevention**: Uses both `Id` and `CreatedAt` for precise message tracking
- **Connection Management**: Automatic reconnection on errors with exponential backoff
- **Access Control**: Full RBAC validation for stream access
- **Error Handling**: Tracks consecutive errors and closes connection after 3 failures
- **Heartbeat**: Sends heartbeat messages every 45 seconds to keep connection alive

### Access Control

#### Role-Based Access Control (RBAC)

The system implements comprehensive RBAC:

**System Admins** (Credentials table, admin role)
- Full access to all workflows across all tenants
- Can create, view, modify, and delete any workflow

**Tenant Admins** (Credentials table, tenant role)
- Full access within their assigned tenants
- Can manage workflows in their tenant scope

**Regular Users** (UserRoles table)
- Access based on role assignments in specific tenants
- Roles: author, editor, agent, reviewer, subscriber
- Must be participants in workflows to send messages

#### Access Validation Flow

1. **Authentication Check** - Verify user is authenticated
2. **Admin Check** - Check if user is system admin
3. **Tenant Access** - Verify user has access to workflow's tenant
4. **Participant Check** - Verify user is workflow participant (for messaging)
5. **Role Validation** - Check if user's role allows the operation

#### RBAC Implementation

The system checks both `TenantUsers` (for base role) and `UserRoles` (for additional roles) tables:

```typescript
// 1. Check TenantUsers table for base role
const tenantUserCheck = await db.prepare(`
  SELECT RoleId FROM TenantUsers WHERE Email = ? AND TenantId = ?
`).bind(access.email, tenantId).first<{ RoleId: string }>();

// 2. Check UserRoles table for additional roles
const userRolesCheck = await db.prepare(`
  SELECT RoleId FROM UserRoles WHERE Email = ? AND TenantId = ?
`).bind(access.email, tenantId).all<{ RoleId: string }>();

// 3. Collect all user roles
const userRoles: string[] = [];
if (tenantUserCheck) {
  userRoles.push(tenantUserCheck.RoleId);
}
if (userRolesCheck.results) {
  userRoles.push(...userRolesCheck.results.map(r => r.RoleId));
}

// 4. Check if user has any role that allows the operation
const hasAllowedRole = userRoles.some(role => allowedRoles.includes(role));
```

### Workflow Lifecycle

#### States
- `active` - Workflow is ongoing
- `completed` - Workflow has been completed
- `terminated` - Workflow has been terminated
- `deleted` - Workflow has been soft deleted

#### Actions
- `complete` - Mark workflow as completed
- `terminate` - Terminate workflow
- `reactivate` - Reactivate completed/terminated workflow
- `delete` - Soft delete workflow (updates status to 'deleted')

**Note**: All actions are performed via `PUT` requests with an `action` parameter, not separate HTTP methods.

### Message Types

#### System Messages
- `request` - Initial workflow request
- `response` - User response
- `share_link` - Media file attachment
- `upload` - File upload notification
- `review` - Review/feedback message

### Client Functions

#### Core Functions

```typescript
// Complete a workflow
completeWorkflowClient(workflowId, userEmail, tenantId)

// Terminate a workflow
terminateWorkflowClient(workflowId, userEmail, tenantId)

// Delete a workflow
deleteWorkflowClient(workflowId, userEmail, tenantId)

// Send a message
sendWorkflowMessage(workflowId, tenantId, content, messageType, mediaFileIds)

// Create SSE connection
createWorkflowSSEConnection(workflowId)
```

### Frontend Components

#### Harbor Workflow Pages

**`/[lang]/harbor/workflow/`**
- Main workflow dashboard
- Shows active workflows and quick actions

**`/[lang]/harbor/workflow/active/`**
- List of active workflows
- Actions: complete, terminate, view details

**`/[lang]/harbor/workflow/create/`**
- Create new workflow form
- Participant selection
- Media file attachment

**`/[lang]/harbor/workflow/[id]/`**
- Individual workflow detail view
- Real-time messaging interface
- Media file display
- Participant management

**`/[lang]/harbor/workflow/history/`**
- Workflow history view
- Filtering and search capabilities

### Database Management

#### Clear Workflow Data Script

A SQL script is available to clear all workflow data for testing purposes:

**File**: `apps/worker/scripts/clear-workflow-data.sql`

```sql
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

-- Verify the tables are empty
SELECT 'Workflows' as table_name, COUNT(*) as count FROM Workflows
UNION ALL
SELECT 'WorkflowMessages' as table_name, COUNT(*) as count FROM WorkflowMessages
UNION ALL
SELECT 'WorkflowParticipants' as table_name, COUNT(*) as count FROM WorkflowParticipants
UNION ALL
SELECT 'WorkflowHistory' as table_name, COUNT(*) as count FROM WorkflowHistory;
```

**Usage**:
```bash
# Clear local database
yarn wrangler d1 execute logosophe --local --file=scripts/clear-workflow-data.sql

# Clear remote database
yarn wrangler d1 execute logosophe --remote --file=scripts/clear-workflow-data.sql
```

### Logging

#### System Logs

All workflow activities are logged to the `SystemLogs` table:

**Log Types**
- `ACTIVITY` - General workflow activities
- `MESSAGING` - Message-related activities

**Activity Types**
- `workflow_created` - New workflow creation
- `workflow_updated` - Workflow modifications
- `workflow_message_sent` - Message sending
- `workflow_completed` - Workflow completion
- `workflow_terminated` - Workflow termination
- `workflow_deleted` - Workflow deletion

#### WorkflowHistory Audit Trail

The `WorkflowHistory` table provides a complete audit trail of all workflow lifecycle events:

**Event Types**
- `created` - Workflow creation
- `updated` - Workflow modifications
- `completed` - Workflow completion
- `terminated` - Workflow termination
- `deleted` - Workflow deletion
- `reactivated` - Workflow reactivation

**History Records Include**
- Complete workflow state at time of event
- User who performed the action
- Timestamp of the event
- All relevant workflow metadata

### Error Handling

#### Common Issues and Solutions

**Duplicate Messages**
- Frontend checks for existing messages by `Id` before adding
- Messages are sorted by `CreatedAt` and `Id` for consistent ordering
- SSE polling uses both `Id` and `CreatedAt` for precise tracking

**Connection Issues**
- Automatic EventSource reconnection on errors
- Graceful handling of network interruptions
- Proper cleanup on component unmount
- Heartbeat messages to detect connection issues

**Access Control Errors**
- Comprehensive RBAC validation
- Clear error messages for permission issues
- Fallback to subscriber role when appropriate

**React Hydration Errors**
- Fixed nested `<h1>` elements in dialog components
- `ConfirmationDialog` components use `Text size="3" weight="bold"` instead of `Heading` to avoid nested heading tags
- Ensures proper heading hierarchy in dialog contexts

**Role Consistency Issues**
- Role names are stored as lowercase role IDs (e.g., 'subscriber', 'author', 'reviewer')
- The `/api/tenant/members` endpoint returns role IDs instead of role names for consistency
- Existing workflows may have mixed case role names that should be updated for consistency

### Performance Considerations

#### Database Optimization
- Direct database access eliminates API call overhead
- Efficient queries with proper indexing
- Optimized polling interval (15 seconds) balances responsiveness and performance
- WorkflowHistory table provides audit trail without impacting main workflow operations

#### Frontend Optimization
- Efficient React state management
- Proper cleanup of EventSource connections
- Optimized re-rendering with proper key props
- Fixed hydration errors for better rendering performance

### Security

#### Data Protection
- All database queries use parameterized statements
- Input validation on all API endpoints
- RBAC ensures proper data isolation between tenants
- Soft delete for workflows preserves audit trail

#### Authentication
- NextAuth v5 integration
- Session-based authentication
- Secure token handling

### Migration Notes

#### From Durable Objects to SSE
- **Removed**: All Durable Object references and WebSocket logic
- **Added**: SSE streaming endpoint with polling mechanism
- **Simplified**: Architecture now uses direct database access
- **Enhanced**: RBAC implementation with full role checking

#### Database Schema Updates
- **Migration**: `003-update-workflow-participants-role-constraint.sql`
- **Change**: Removed `CHECK` constraint limiting roles to 'initiator'/'recipient'
- **Result**: Now supports any valid role name (author, subscriber, editor, etc.)

#### WorkflowHistory Implementation
- **Added**: Complete audit trail functionality
- **Events**: All workflow lifecycle events are recorded
- **Integration**: Automatic history updates on workflow operations
- **Benefits**: Complete audit trail for compliance and debugging

### Usage Examples

#### Creating a Workflow
```typescript
const response = await fetch('/api/workflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Review Project Files',
    participants: [
      { email: 'user1@example.com', role: 'author' },
      { email: 'user2@example.com', role: 'reviewer' }
    ],
    description: 'Please review the attached files'
  })
});
```

#### Sending a Message
```typescript
const response = await fetch('/api/harbor/workflow/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflowId: 'workflow-id',
    content: 'Here are my comments',
    messageType: 'response',
    mediaFileIds: [123, 456]
  })
});
```

#### Real-Time Updates
```typescript
const eventSource = createWorkflowSSEConnection('workflow-id');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'message') {
    // Add new message to UI
    setMessages(prev => [...prev, data.data]);
  }
};
```

#### Deleting a Workflow
```typescript
const response = await fetch(`/api/workflow/${workflowId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'delete'
  })
});
```

### Development Workflow

#### Local Development
- Use `yarn dev` to start development server
- Database migrations applied automatically
- Hot reloading for frontend changes

#### Production Deployment
- GitHub Actions handles deployment
- Database migrations applied with `--remote` flag
- Proper environment configuration

#### Testing
- Use `clear-workflow-data.sql` script to reset workflow data
- Test all workflow lifecycle events
- Verify WorkflowHistory audit trail functionality

### Troubleshooting

#### Common Issues
1. **403 Access Denied**: Check user roles in both `TenantUsers` and `UserRoles` tables
2. **Duplicate Messages**: Verify SSE polling logic and frontend duplicate detection
3. **Connection Errors**: Check network connectivity and EventSource implementation
4. **Role Display Issues**: Ensure database migration has been applied to allow proper role names
5. **React Hydration Errors**: Ensure dialog components use proper heading hierarchy
6. **Workflow Deletion Issues**: Verify that deletion uses PUT with `action: 'delete'` parameter
7. **Role Consistency**: Check that role names are stored as lowercase role IDs

#### Debug Tools
- Browser developer tools for SSE connection monitoring
- Database queries for role verification
- System logs for activity tracking
- WorkflowHistory table for audit trail analysis

#### Database Queries for Debugging

```sql
-- Check workflow history
SELECT * FROM WorkflowHistory WHERE WorkflowId = 'your-workflow-id' ORDER BY EventTimestamp DESC;

-- Check user roles
SELECT * FROM TenantUsers WHERE Email = 'user@example.com';
SELECT * FROM UserRoles WHERE Email = 'user@example.com';

-- Check workflow participants
SELECT * FROM WorkflowParticipants WHERE WorkflowId = 'your-workflow-id';

-- Check recent workflow messages
SELECT * FROM WorkflowMessages WHERE WorkflowId = 'your-workflow-id' ORDER BY CreatedAt DESC LIMIT 10;
```