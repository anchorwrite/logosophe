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
- `Role` (TEXT, NOT NULL) - Participant role (initiator/recipient)
- `JoinedAt` (TEXT, NOT NULL) - Join timestamp

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

**`/api/harbor/workflow/websocket-url`**
- `GET` - Get SSE URL (renamed from websocket-url)

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

**Metadata Fields**
- Participant count
- Media file count
- Action details
- User context

### Error Handling

#### Graceful Degradation
- Logging failures don't prevent workflow operations
- SSE connection failures trigger reconnection attempts
- Database errors return appropriate HTTP status codes

#### Error Types
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Workflow not found
- `400` - Bad request (missing parameters)
- `500` - Internal server error

### Performance Considerations

#### Database Optimization
- Indexes on frequently queried columns
- Efficient JOIN operations for participant and message queries
- Pagination for large result sets

#### SSE Optimization
- 2-second polling interval for updates
- Efficient querying to minimize database load
- Connection cleanup on page unload

### Security Features

#### Input Validation
- All user inputs are validated
- SQL injection prevention through parameterized queries
- XSS protection through proper escaping

#### Access Control
- Tenant isolation
- Role-based permissions
- Participant-only messaging

#### Audit Trail
- Comprehensive logging of all activities
- IP address and user agent tracking
- Metadata preservation for compliance

### Migration Notes

#### From Durable Objects to SSE
- Removed all `env.WORKFLOW_DO` references
- Replaced WebSocket connections with SSE streams
- Simplified real-time update mechanism
- Maintained same user experience with simpler architecture

#### Database Access
- Direct database access from worker
- No more API calls between frontend and separate worker
- Improved performance and reliability

### Future Enhancements

#### Potential Improvements
- WebSocket support for lower latency (if needed)
- Push notifications for workflow updates
- Advanced workflow templates
- Bulk operations for workflow management
- Enhanced media file handling
- Workflow analytics and reporting

#### Scalability Considerations
- Database connection pooling
- Caching layer for frequently accessed data
- Horizontal scaling for high-traffic scenarios
- CDN integration for media file delivery

## Usage Examples

### Creating a Workflow

```typescript
const response = await fetch('/api/workflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Project Review',
    description: 'Review the latest design mockups',
    tenantId: 'tenant-001',
    initiatorRole: 'editor',
    participants: [
      { email: 'user1@example.com', role: 'reviewer' },
      { email: 'user2@example.com', role: 'author' }
    ],
    mediaFileIds: [123, 124, 125]
  })
});
```

### Sending a Message

```typescript
const response = await fetch('/api/harbor/workflow/messages?tenantId=tenant-001&workflowId=workflow-123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'I've reviewed the designs and have some feedback.',
    messageType: 'response',
    mediaFileIds: [126]
  })
});
```

### Real-Time Updates

```typescript
const eventSource = new EventSource('/api/workflow/workflow-123/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'message') {
    // Add new message to UI
    addMessageToUI(data.data);
  } else if (data.type === 'status_update') {
    // Update workflow status
    updateWorkflowStatus(data.data.status);
  }
};
```

This documentation provides a comprehensive overview of the workflow system's architecture, features, and usage patterns after the migration to SSE. 