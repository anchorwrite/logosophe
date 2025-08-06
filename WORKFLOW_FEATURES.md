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

**Note**: The `Role` column in `WorkflowParticipants` was updated to allow any role name (e.g., 'author', 'subscriber', 'editor') instead of being limited to legacy 'initiator'/'recipient' roles.

### API Routes

#### Core Workflow Routes

**`/api/workflow`**
- `POST` - Create new workflow
- `GET` - List workflows for tenant

**`/api/workflow/[id]`**
- `GET` - Get workflow details with messages and participants
- `PUT` - Update workflow (status, title, actions)

**`/api/workflow/[id]/stream`**
- `GET` - SSE endpoint for real-time updates

#### Harbor-Specific Routes

**`/api/harbor/workflow/messages`**
- `POST` - Send message to workflow

**`/api/harbor/workflow/stats`**
- `GET` - Get workflow statistics for tenant

**Note**: The `/api/harbor/workflow/websocket-url` endpoint has been removed. Frontend components now connect directly to `/api/workflow/[id]/stream` for SSE connections.

#### History Routes

**`/api/workflow/history`**
- `GET` - Get workflow history for user

**`/api/workflow/history/detail/[id]`**
- `GET` - Get detailed workflow history

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

- **Polling Interval**: 2 seconds
- **Duplicate Prevention**: Uses both `Id` and `CreatedAt` for precise message tracking
- **Connection Management**: Automatic reconnection on errors
- **Access Control**: Full RBAC validation for stream access

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

#### Actions
- `complete` - Mark workflow as completed
- `terminate` - Terminate workflow
- `reactivate` - Reactivate completed/terminated workflow

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

**Access Control Errors**
- Comprehensive RBAC validation
- Clear error messages for permission issues
- Fallback to subscriber role when appropriate

### Performance Considerations

#### Database Optimization
- Direct database access eliminates API call overhead
- Efficient queries with proper indexing
- Minimal polling interval (2 seconds) balances responsiveness and performance

#### Frontend Optimization
- Efficient React state management
- Proper cleanup of EventSource connections
- Optimized re-rendering with proper key props

### Security

#### Data Protection
- All database queries use parameterized statements
- Input validation on all API endpoints
- RBAC ensures proper data isolation between tenants

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

### Development Workflow

#### Local Development
- Use `yarn dev` to start development server
- Database migrations applied automatically
- Hot reloading for frontend changes

#### Production Deployment
- GitHub Actions handles deployment
- Database migrations applied with `--remote` flag
- Proper environment configuration

### Troubleshooting

#### Common Issues
1. **403 Access Denied**: Check user roles in both `TenantUsers` and `UserRoles` tables
2. **Duplicate Messages**: Verify SSE polling logic and frontend duplicate detection
3. **Connection Errors**: Check network connectivity and EventSource implementation
4. **Role Display Issues**: Ensure database migration has been applied to allow proper role names

#### Debug Tools
- Browser developer tools for SSE connection monitoring
- Database queries for role verification
- System logs for activity tracking