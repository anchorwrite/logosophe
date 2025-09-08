# Messaging System Implementation

## Overview

This document describes the messaging system implementation for the Logosophe platform. The system provides tenant-aware messaging with real-time capabilities, user blocking, rate limiting, and admin controls.

## Database Schema

### Core Tables

#### Messages
- **Id**: Primary key
- **Subject**: Message subject
- **Body**: Message content
- **SenderEmail**: Email of the sender
- **TenantId**: Tenant the message belongs to
- **MessageType**: 'direct', 'broadcast', or 'announcement'
- **Priority**: 'low', 'normal', 'high', or 'urgent'
- **CreatedAt**: Timestamp when message was created
- **ExpiresAt**: Optional expiration timestamp
- **IsDeleted**: Soft delete flag
- **IsRecalled**: Whether message was recalled
- **RecalledAt**: When message was recalled
- **RecallReason**: Reason for recall

#### MessageRecipients
- **Id**: Primary key
- **MessageId**: Foreign key to Messages
- **RecipientEmail**: Email of recipient
- **IsRead**: Whether message was read
- **ReadAt**: When message was read
- **IsDeleted**: Soft delete flag for recipient
- **DeletedAt**: When message was deleted by recipient
- **IsForwarded**: Whether message was forwarded
- **ForwardedAt**: When message was forwarded
- **IsSaved**: Whether message was saved
- **SavedAt**: When message was saved
- **IsReplied**: Whether message was replied to
- **RepliedAt**: When message was replied to

#### MessageAttachments
- **Id**: Primary key
- **MessageId**: Foreign key to Messages
- **MediaId**: Foreign key to MediaFiles
- **CreatedAt**: When attachment was added

#### UserBlocks
- **Id**: Primary key
- **BlockerEmail**: Email of user doing the blocking
- **BlockedEmail**: Email of blocked user
- **TenantId**: Tenant where blocking occurs
- **Reason**: Optional reason for blocking
- **CreatedAt**: When block was created
- **IsActive**: Whether block is active

#### MessageRateLimits
- **Id**: Primary key
- **SenderEmail**: Email of sender
- **LastMessageAt**: When last message was sent
- **MessageCount**: Number of messages sent
- **ResetAt**: When rate limit resets

#### SystemSettings
- **Key**: Setting name
- **Value**: Setting value
- **UpdatedAt**: When setting was last updated
- **UpdatedBy**: Who updated the setting

## API Endpoints

### Core Messaging

#### POST /api/messages
Send a new message.

**Request Body:**
```json
{
  "subject": "Message Subject",
  "body": "Message content",
  "recipients": ["user1@example.com", "user2@example.com"],
  "tenantId": "tenant-001",
  "messageType": "direct",
  "priority": "normal",
  "attachments": [1, 2, 3],
  "replyToMessageId": 123
}
```

**Response:**
```json
{
  "success": true,
  "messageId": 456,
  "rateLimitInfo": {
    "allowed": true,
    "waitSeconds": 0
  }
}
```

#### GET /api/messages
Get messages for the current user.

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Messages per page (default: 20)
- `messageType`: 'inbox' or 'sent' (default: 'inbox')
- `isRead`: Filter by read status ('true' or 'false')
- `search`: Search in subject and body
- `tenantId`: Filter by tenant

**Response:**
```json
{
  "messages": [
    {
      "Id": 123,
      "Subject": "Message Subject",
      "Body": "Message content",
      "SenderEmail": "sender@example.com",
      "TenantId": "tenant-001",
      "MessageType": "direct",
      "Priority": "normal",
      "CreatedAt": "2024-01-01T12:00:00Z",
      "IsRead": false,
      "attachments": []
    }
  ],
  "totalCount": 50,
  "unreadCount": 10
}
```

### Individual Message Management

#### GET /api/messages/[id]
Get a specific message.

#### PUT /api/messages/[id]
Update message status.

**Request Body:**
```json
{
  "action": "mark_read",
  "value": true
}
```

Actions: `mark_read`, `mark_unread`, `save`, `unsave`

#### DELETE /api/messages/[id]
Delete a message (soft delete).

#### POST /api/messages/[id]/recall
Recall a message.

**Request Body:**
```json
{
  "reason": "Sent to wrong person"
}
```

### User Blocking

#### GET /api/messages/blocks
Get user's blocking relationships.

**Query Parameters:**
- `tenantId`: Required tenant ID

#### POST /api/messages/blocks
Block a user.

**Request Body:**
```json
{
  "blockedEmail": "user@example.com",
  "tenantId": "tenant-001",
  "reason": "Spam messages"
}
```

#### DELETE /api/messages/blocks
Unblock a user.

**Query Parameters:**
- `blockedEmail`: Email of user to unblock
- `tenantId`: Tenant ID

### System Controls (Admin Only)

#### GET /api/messages/system
Get system status and settings.

**Response:**
```json
{
  "messagingEnabled": true,
  "rateLimitSeconds": 60,
  "maxRecipients": 100,
  "recallWindowSeconds": 3600,
  "messageExpirySeconds": 2592000,
  "totalMessages": 1500,
  "activeUsers": 250,
  "blockedUsers": 5
}
```

#### PUT /api/messages/system
Update system settings.

**Request Body:**
```json
{
  "action": "toggle_system",
  "value": false
}
```

Actions: `toggle_system`, `set_rate_limit`, `set_max_recipients`, `set_recall_window`

#### POST /api/messages/system/cleanup
Clean up old data.

**Request Body:**
```json
{
  "action": "cleanup_expired_messages"
}
```

Actions: `cleanup_expired_messages`, `cleanup_rate_limits`

### Recipients

#### GET /api/messages/recipients
Get available recipients for messaging.

**Query Parameters:**
- `tenantId`: Filter by specific tenant
- `includeInactive`: Include inactive users ('true' or 'false')

**Response:**
```json
{
  "users": [
    {
      "email": "user@example.com",
      "name": "User Name",
      "tenantId": "tenant-001",
      "roleId": "author",
      "isOnline": false,
      "isBlocked": false,
      "isActive": true,
      "isBanned": false
    }
  ],
  "tenants": [
    {
      "id": "tenant-001",
      "name": "Tenant Name",
      "userCount": 25
    }
  ]
}
```

## Access Control

### Message Permissions

- **System Admins**: Can send any type of message to any user
- **Tenant Admins**: Can send broadcast/announcement messages within their tenants
- **Regular Users**: Can only send direct messages to users in their tenants

### Rate Limiting

- Default: 1 message per minute per user
- Configurable via system settings
- Rate limits are per-user and reset after the configured time period

### User Blocking

- One-way blocking (blocked users can still receive messages from blockers)
- Blocking is tenant-specific
- Regular users can only block within their own tenant
- Admins can block users across all tenants

## System Features

### Message Recall

- Users can recall unread messages within a configurable time window
- Default recall window: 1 hour
- Recalled messages are marked but not deleted (for audit trail)

### Message Expiration

- Messages are automatically deleted after a configurable time period
- Default expiration: 30 days
- Expired messages are permanently deleted

### Real-time Delivery

- Uses Cloudflare Durable Objects for WebSocket connections
- Fallback to polling for offline users
- Cost-optimized to minimize database queries

## Security Features

- All endpoints require authentication
- Tenant isolation ensures users can only access messages within their tenants
- Rate limiting prevents spam
- User blocking prevents harassment
- Audit logging for all messaging activities

## Cost Optimization

- No polling - messages are only fetched when requested
- Efficient database queries with proper indexing
- Batch operations for multiple messages
- Lazy loading of attachments and recipients
- Minimal Durable Object usage

## Testing

Run the test script to verify API endpoints:

```bash
node scripts/test-messaging.js
```

This will test that all endpoints are properly secured and return appropriate error responses for unauthenticated requests.

## Next Steps

1. **Phase 2**: Implement admin message management UI
2. **Phase 3**: Add real-time WebSocket connections
3. **Phase 4**: Create message composition interface
4. **Phase 5**: Add advanced features like message templates and bulk operations

## Database Migration

The messaging system schema is created by running:

```bash
yarn wrangler d1 execute DB --local --file=migrations/0020_messaging_system.sql
```

For production:

```bash
yarn wrangler d1 execute DB --file=migrations/0020_messaging_system.sql
``` 