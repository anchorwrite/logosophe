# Durable Objects Migration: Anchorwrite → Logosophe

## Overview

This document describes the migration of the harbor/workflow system from the split architecture in anchorwrite to a unified single-worker architecture in logosophe using Cloudflare Durable Objects.

## Architecture Changes

### Anchorwrite (Original)
- **Worker**: Separate Cloudflare Worker with Durable Objects
- **Frontend**: Cloudflare Pages with API routes that forward to worker
- **Configuration**: Split between `wrangler.toml` (worker) and frontend config

### Logosophe (New)
- **Single Worker**: OpenNext.js-based worker with integrated Durable Objects
- **Direct Database Access**: No API forwarding, direct database operations
- **Unified Configuration**: Single `wrangler.jsonc` configuration

## Implementation Details

### 1. Durable Objects Configuration

**File**: `apps/worker/wrangler.jsonc`
```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "WORKFLOW_DO",
        "class_name": "WorkflowDurableObject"
      },
      {
        "name": "USER_NOTIFICATIONS_DO",
        "class_name": "UserNotificationsDurableObject"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["WorkflowDurableObject"]
    },
    {
      "tag": "v2",
      "new_sqlite_classes": ["UserNotificationsDurableObject"]
    }
  ]
}
```

### 2. Durable Object Classes

**WorkflowDurableObject** (`apps/worker/app/durable-objects/workflow-durable-object.ts`)
- Handles real-time workflow messaging
- WebSocket connections for live updates
- Tenant-aware workflow management
- Integration with logosophe's RBAC system

**UserNotificationsDurableObject** (`apps/worker/app/durable-objects/user-notifications-durable-object.ts`)
- Manages user-specific notifications
- WebSocket connections for notification updates
- Persistent notification storage

### 3. Worker Entry Point

**File**: `apps/worker/app/worker-entry.ts`
- Custom worker entry point that handles both Next.js and Durable Object requests
- Routes `/workflow/*` and `/notifications/*` to Durable Objects
- Delegates all other requests to Next.js

### 4. API Route Updates

All workflow API routes now call Durable Objects directly instead of forwarding to external workers:

- `POST /api/workflow` - Creates workflow and notifies Durable Object
- `GET /api/workflow` - Lists workflows from database
- `GET /api/workflow/[id]` - Gets workflow details from database
- `PUT /api/workflow/[id]` - Updates workflow and notifies Durable Object
- `GET /api/workflow/messages` - Gets messages from database
- `POST /api/workflow/messages` - Creates message and notifies Durable Object

### 5. Database Schema (Existing)

The following tables already exist in the logosophe database:

**Workflows** - Main workflow table
- `Id` (TEXT, PK)
- `TenantId` (TEXT, NOT NULL)
- `InitiatorEmail` (TEXT, NOT NULL)
- `Title` (TEXT)
- `Status` (TEXT, NOT NULL, DEFAULT 'active')
- `CreatedAt` (TEXT, NOT NULL)
- `UpdatedAt` (TEXT, NOT NULL)
- `CompletedAt` (TEXT)
- `CompletedBy` (TEXT)

**WorkflowParticipants** - Workflow participants
- `WorkflowId` (TEXT, PK)
- `ParticipantEmail` (TEXT, NOT NULL)
- `Role` (TEXT, NOT NULL)
- `JoinedAt` (TEXT, NOT NULL)

**WorkflowMessages** - Real-time messages
- `Id` (TEXT, PK)
- `WorkflowId` (TEXT, NOT NULL)
- `SenderEmail` (TEXT, NOT NULL)
- `MessageType` (TEXT, NOT NULL)
- `Content` (TEXT, NOT NULL)
- `MediaFileId` (INTEGER) - References MediaFiles table
- `ShareToken` (TEXT)
- `CreatedAt` (TEXT, NOT NULL)

**WorkflowHistory** - Workflow audit trail
- `Id` (TEXT, PK)
- `WorkflowId` (TEXT, NOT NULL)
- `TenantId` (TEXT, NOT NULL)
- `InitiatorEmail` (TEXT, NOT NULL)
- `Title` (TEXT, NOT NULL)
- `Status` (TEXT, NOT NULL)
- `CreatedAt` (TEXT, NOT NULL)
- `UpdatedAt` (TEXT, NOT NULL)
- `CompletedAt` (TEXT)
- `CompletedBy` (TEXT)
- `DeletedAt` (TEXT)
- `DeletedBy` (TEXT)
- `EventType` (TEXT, NOT NULL)
- `EventTimestamp` (TEXT, NOT NULL)
- `EventPerformedBy` (TEXT, NOT NULL)

**Media Files Integration**
- Media files are referenced directly in `WorkflowMessages` via `MediaFileId`
- No separate `WorkflowMediaFiles` table exists
- Each media file creates a separate message with `MessageType = 'share_link'`

### 6. Frontend Integration

**File**: `apps/worker/app/lib/workflow-websocket.ts`
- `WorkflowWebSocket` - Connects to workflow Durable Objects
- `UserNotificationsWebSocket` - Connects to user notifications
- Automatic reconnection and error handling

## URL Structure

### Durable Object Routes
- `/workflow/{workflowId}/websocket` - WebSocket connection for workflow
- `/workflow/{workflowId}/notification` - Notifications to workflow
- `/notifications/{userEmail}/websocket` - WebSocket connection for user notifications
- `/notifications/{userEmail}/clear` - Clear user notifications
- `/notifications/{userEmail}/check` - Check user notifications

### API Routes (Next.js)
- `/api/workflow` - Workflow CRUD operations
- `/api/workflow/[id]` - Individual workflow operations
- `/api/workflow/messages` - Message operations

## Benefits

1. **Unified Architecture**: Single worker handles everything
2. **Direct Database Access**: No API forwarding overhead
3. **Real-time Capabilities**: WebSocket support for live updates
4. **Tenant Isolation**: Proper RBAC integration
5. **Simplified Deployment**: One service to manage
6. **Better Performance**: Reduced network hops

## Migration Steps

1. ✅ Add Durable Objects configuration to `wrangler.jsonc`
2. ✅ Create Durable Object classes
3. ✅ Update worker entry point
4. ✅ Update API routes to call Durable Objects directly
5. ✅ Verify existing database schema compatibility
6. ✅ Add WebSocket helpers for frontend
7. ✅ Update frontend components to use WebSocket connections

## Testing

### Local Development
```bash
# Start local development server
yarn dev

# Test WebSocket connections
# Open browser console and connect to workflow WebSocket
```

### Production Deployment
```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Test Durable Objects
# Verify WebSocket connections work in production
```

## Troubleshooting

### Common Issues

1. **Durable Objects not found**: Ensure migrations are applied
2. **WebSocket connection failed**: Check CORS and routing configuration
3. **Database errors**: Verify table schema matches existing structure
4. **Authentication issues**: Ensure proper RBAC integration

### Debug Commands

```bash
# Check Durable Object migrations
wrangler d1 migrations list

# View worker logs
wrangler tail

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
  "https://logosophe.workers.dev/workflow/test/websocket"
```

## Future Enhancements

1. **Message Persistence**: Store messages in Durable Object storage
2. **Typing Indicators**: Real-time typing status
3. **File Sharing**: Direct file upload to workflows
4. **Notification Preferences**: User-configurable notification settings
5. **Workflow Templates**: Predefined workflow configurations 