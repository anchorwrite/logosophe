# Messaging SSE Implementation Plan

## Overview
This document outlines the plan to upgrade the user-facing messaging feature in the Harbor interface to use Server-Sent Events (SSE) for real-time message updates without requiring browser refreshes. This functionality is separate from the Harbor Workflow messaging, which is out of scope for this plan but can be used as a model.

**NEW REQUIREMENTS ADDED:**
- **File Attachments**: Support for attaching one or more files from the media library or uploading from desktop
- Use existing R2 storage bucket by leveraging the Harbor Media Library feature (do not change this feature, but leverage it as-is for file handling).
- **Link Sharing**: Ability to paste and share clickable internet links in message bodies

## Current Architecture
The messaging system currently uses a traditional request-response pattern:
- Messages are sent via POST to `/api/messaging/send`
- Messages are retrieved via GET from `/api/messages` and `/api/messaging/messages`
- UI components manually refresh or poll for updates
- No real-time updates are available
- **Current Limitations**: No file attachment support, no link sharing capabilities

## Target Users
- **Primary**: Subscribers accessing `/[lang]/harbor/messaging`
- **Scope**: Tenant-scoped messaging within the harbor interface
- **Excluded**: Admin dashboard messaging management (remains request-response)

## SSE Implementation Plan

### 1. Core SSE Infrastructure

#### 1.1 SSE Endpoint Creation
- **Endpoint**: `/api/messaging/stream/[tenantId]/route.ts`
- **Purpose**: Establish persistent SSE connections for real-time message updates
- **Security**: Tenant-scoped, user authentication required
- **Pattern**: Follow existing workflow SSE implementation in `/api/workflow/[id]/stream/route.ts`

#### 1.2 Connection Management
- **Tenant Isolation**: Ensure connections are properly scoped to user's tenant
- **Connection Lifecycle**: Handle connection establishment, maintenance, and cleanup

### 2. Event Broadcasting System

#### 2.1 Event Types
- `message:new` - New message received by user
- `message:read` - Message marked as read by user
- `message:delete` - Message deleted (if user has access)
- `message:update` - Message content updated
- `message:attachment:added` - File attachment added to message
- `message:attachment:removed` - File attachment removed from message

#### 2.2 Broadcasting Triggers
- **Message Send**: Broadcast `message:new` when `/api/messaging/send` is called
- **Read Status**: Broadcast `message:read` when marking messages as read
- **Message Actions**: Broadcast appropriate events for delete/update operations
- **File Attachments**: Broadcast `message:attachment:added` when files are attached

#### 2.3 Event Payload Structure
```typescript
interface MessageEvent {
  type: 'message:new' | 'message:read' | 'message:delete' | 'message:update' | 'message:attachment:added' | 'message:attachment:removed';
  data: {
    messageId: number;
    tenantId: string;
    timestamp: string;
    payload: any; // Event-specific data
  };
}
```

### 3. File Attachment System

#### 3.1 Database Schema Updates
**New Table: MessageAttachments**
```sql
CREATE TABLE IF NOT EXISTS MessageAttachments (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    MediaFileId INTEGER NOT NULL,
    AttachmentType TEXT NOT NULL DEFAULT 'media_library' CHECK (AttachmentType IN ('media_library', 'upload')),
    FileName TEXT NOT NULL,
    FileSize INTEGER NOT NULL,
    ContentType TEXT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
    FOREIGN KEY (MediaFileId) REFERENCES MediaFiles(Id) ON DELETE CASCADE
);
```

**Update Messages Table**
```sql
ALTER TABLE Messages ADD COLUMN HasAttachments BOOLEAN DEFAULT FALSE;
ALTER TABLE Messages ADD COLUMN AttachmentCount INTEGER DEFAULT 0;
```

#### 3.2 File Attachment API Endpoints
- **POST** `/api/messaging/attachments/upload` - Upload new files from desktop
- **POST** `/api/messaging/attachments/attach` - Attach existing media library files
- **DELETE** `/api/messaging/attachments/[id]` - Remove attachment from message
- **GET** `/api/messaging/attachments/[messageId]` - Get attachments for a message

#### 3.3 File Attachment Types
- **Media Library Files**: Select from existing files in user's media library
- **Desktop Uploads**: Upload new files directly from user's device
- **Combined Approach**: Support mixing both types in single message
- **File Validation**: Size limits, type restrictions, virus scanning
- **Access Control**: Ensure user has permission to access attached files

#### 3.4 File Attachment UI Components
- **MediaFileSelector**: Reuse existing component from workflow messaging
- **FileUploadZone**: Drag-and-drop file upload interface
- **AttachmentPreview**: Thumbnail previews for attached files
- **AttachmentList**: Manage multiple attachments per message
- **FileTypeIcons**: Visual indicators for different file types

### 4. Link Sharing System

#### 4.1 Link Detection and Processing
- **Auto-Detection**: Automatically detect URLs in message text
- **Link Validation**: Verify link format and accessibility
- **Link Preview**: Generate preview metadata (title, description, thumbnail)
- **Security**: Sanitize links to prevent XSS and malicious content

#### 4.2 Link Storage and Display
**New Table: MessageLinks**
```sql
CREATE TABLE IF NOT EXISTS MessageLinks (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    Url TEXT NOT NULL,
    Title TEXT,
    Description TEXT,
    ThumbnailUrl TEXT,
    Domain TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE
);
```

#### 4.3 Link Processing API
- **POST** `/api/messaging/links/process` - Process and validate links
- **GET** `/api/messaging/links/preview` - Get link preview metadata
- **Link Preview Service**: External service for fetching link metadata

#### 4.4 Link Display Features
- **Clickable Links**: Convert URLs to clickable links in message display
- **Link Previews**: Show rich previews with title, description, and thumbnail
- **Domain Display**: Show source domain for security awareness
- **Link Safety**: Visual indicators for safe/unsafe links

### 5. Client-Side Integration

#### 5.1 SSE Client Implementation
- **Component**: Update `SubscriberMessagingInterface.tsx`
- **Connection**: Replace manual refresh/polling with EventSource
- **Reconnection**: Implement automatic reconnection with exponential backoff
- **Error Handling**: Graceful fallback to existing behavior on connection failures

#### 5.2 Real-Time UI Updates
- **Message List**: Automatically update message list when new messages arrive
- **Read Status**: Update message badges and styling in real-time
- **Statistics**: Update message counts and stats automatically
- **Notifications**: Show real-time feedback for message actions
- **Attachments**: Real-time updates for file attachment operations
- **Links**: Real-time link preview generation and display

#### 5.3 Enhanced Message Composition
- **File Attachment Interface**: Integrated file selection and upload
- **Link Processing**: Real-time link validation and preview
- **Message Validation**: Enhanced validation for attachments and links
- **Progress Indicators**: Upload progress and processing status

### 6. Harbor Appbar Integration

#### 6.1 Unread Message Indicator
- **Location**: Add messaging navigation item to harbor appbar with unread count badge
- **API Endpoint**: Create `/api/messaging/unread-count/route.ts` for fetching unread count
- **Real-Time Updates**: Use SSE to update unread count badge in real-time
- **Navigation**: Link directly to messaging interface from appbar

#### 6.2 Indicator Behavior
- **Display**: Show unread message count as a badge on the messaging navigation item
- **Auto-Clear**: Badge clears when user visits messaging page or when all messages are read
- **Real-Time**: Count updates automatically via SSE when new messages arrive
- **Fallback**: Graceful degradation if SSE unavailable (fallback to periodic polling)

#### 6.3 Implementation Details
- **Custom Hook**: Create `useUnreadMessageCount` hook for state management
- **Appbar Update**: Modify `/[lang]/harbor/appbar.tsx` to include messaging navigation
- **Badge Component**: Create reusable unread count badge component
- **State Synchronization**: Ensure appbar indicator stays in sync with messaging interface

### 7. Security & Performance

#### 7.1 Security Measures
- **Authentication**: Verify user session on SSE connection
- **Tenant Scoping**: Ensure users only receive events from their tenant unless a message is being sent by a global admin, in which case the sender can choose 1, some, or all tenants (e.g. for broadcast messages)
- **Rate Limiting**: Prevent abuse of SSE endpoints
- **Connection Validation**: Verify user permissions on connection establishment
- **File Security**: Validate file types, scan for malware, enforce size limits which are settable by a global or tenant admin in the dashboard/messaging code (future development)
- **Link Security**: Sanitize URLs, prevent XSS, validate external links

#### 7.2 Performance Optimizations
- **Connection Pooling**: Efficiently manage multiple user connections
- **Event Batching**: Group multiple updates into single events where possible
- **Selective Broadcasting**: Only send relevant events to each user
- **Connection Cleanup**: Remove inactive connections to free resources
- **File Processing**: Asynchronous file upload and processing
- **Link Caching**: Cache link previews to reduce external API calls

## Implementation Phases

### Phase 1: Core SSE Infrastructure & Database Schema (Week 1)
1. Create database migration for new attachment and link tables
2. Create `/api/messaging/stream/[tenantId]/route.ts`
3. Implement connection management system
4. Set up event broadcasting framework
5. Add basic event types and payloads

### Phase 2: File Attachment System (Week 2)
1. Implement file upload API endpoints
2. Create media library file attachment system
3. Build attachment management UI components
4. Integrate file validation and access control
5. Test file attachment functionality

### Phase 3: Link Sharing System (Week 3)
1. Implement link detection and processing
2. Create link preview generation service
3. Build link display and interaction components
4. Add link security and validation
5. Test link sharing functionality

### Phase 4: Event Integration & SSE Broadcasting (Week 4)
1. Update `/api/messaging/send/route.ts` to broadcast events
2. Integrate event broadcasting with file attachments and links
3. Test event flow and connection management
4. Implement error handling and fallbacks

### Phase 5: Client Integration (Week 5)
1. Update `SubscriberMessagingInterface.tsx` to use SSE
2. Implement real-time UI updates for all features
3. Add connection management and reconnection logic
4. Integrate file attachment and link sharing UI
5. Test real-time functionality end-to-end

### Phase 6: Harbor Appbar Integration (Week 6)
1. Create `/api/messaging/unread-count/route.ts` endpoint
2. Implement `useUnreadMessageCount` custom hook
3. Update harbor appbar to include messaging navigation with unread indicator
4. Integrate SSE updates for real-time badge updates
5. Test appbar integration and badge behavior

### Phase 7: Testing & Optimization (Week 7)
1. Performance testing with multiple concurrent users
2. Security testing and validation
3. Error handling and edge case testing
4. File upload and link processing optimization
5. Documentation and deployment preparation

## Technical Requirements

### Dependencies
- Cloudflare Workers (already in use)
- D1 Database (already in use)
- SSE for connection management
- Existing authentication and authorization systems
- File upload and processing capabilities using Harbor Media Library (not Dashboard Media Library, which is a separate function)
- Link preview and metadata services

### Browser Support
- Modern browsers with EventSource support
- File upload and drag-and-drop support
- Graceful fallback for older browsers
- Mobile device compatibility

### Scalability Considerations
- Support for multiple concurrent users per tenant
- Efficient memory usage for connection management
- File storage and processing scalability
- Link preview service performance
- Horizontal scaling capabilities

## Success Metrics

### User Experience
- **Real-time Updates**: Messages appear without manual refresh
- **File Attachments**: Seamless file sharing from media library or desktop
- **Link Sharing**: Easy sharing of clickable internet links
- **Response Time**: Message updates within 1-2 seconds
- **Reliability**: 99%+ uptime for SSE connections
- **Fallback**: Graceful degradation when SSE unavailable
- **Appbar Integration**: Unread message count visible at all times in harbor interface

### Technical Performance
- **Connection Stability**: Minimal connection drops
- **Resource Usage**: Efficient memory and CPU utilization
- **File Processing**: Fast file upload and attachment processing
- **Link Processing**: Quick link validation and preview generation
- **Scalability**: Support for 100+ concurrent users per tenant
- **Error Rate**: <1% error rate for SSE operations

## Risk Mitigation

### Technical Risks
- **Connection Stability**: Implement robust reconnection logic
- **Memory Leaks**: Proper connection cleanup and resource management
- **Performance Impact**: Monitor and optimize resource usage
- **File Upload Issues**: Implement retry logic and progress tracking
- **Link Processing Failures**: Graceful fallback for link preview failures
- **Browser Compatibility**: Test across different browsers and devices

### Security Risks
- **Data Leakage**: Strict tenant isolation and access controls
- **Connection Hijacking**: Secure authentication and validation
- **Resource Abuse**: Rate limiting and connection quotas
- **Information Disclosure**: Careful event payload design
- **File Security**: Malware scanning and file type validation
- **Link Security**: URL sanitization and XSS prevention

## Testing Strategy

### Unit Testing
- SSE endpoint functionality
- Event broadcasting logic
- Connection management
- Security validation
- File attachment processing
- Link processing and validation
- Unread count API endpoint
- Appbar integration components

### Integration Testing
- End-to-end message flow with attachments and links
- Real-time updates across multiple users
- File upload and attachment workflows
- Link sharing and preview functionality
- Error scenarios and fallbacks
- Performance under load
- Appbar indicator synchronization

### User Acceptance Testing
- Real user scenarios and workflows
- File attachment usability testing
- Link sharing functionality testing
- Different device and browser testing
- Performance and reliability validation
- User experience feedback
- Appbar navigation and indicator usability

## Future Enhancements

### Phase 2 Features (Post-Initial Implementation)
- **Typing Indicators**: Show when users are composing messages
- **Online Status**: Real-time user online/offline indicators
- **Message Delivery Confirmations**: Track message delivery status
- **Advanced Notifications**: Rich notification system for messages
- **File Versioning**: Track file attachment versions and updates
- **Link Collections**: Organize and categorize shared links
- **Advanced File Preview**: In-browser preview for supported file types

### Long-term Considerations
- **WebSocket Migration**: Potential upgrade to WebSockets for bi-directional communication
- **Push Notifications**: Browser push notifications for offline users
- **Message Encryption**: End-to-end encryption for sensitive communications
- **Advanced Analytics**: Real-time messaging analytics and insights
- **File Collaboration**: Real-time collaborative editing of shared documents
- **Link Analytics**: Track link engagement and click-through rates

## Conclusion

This SSE implementation will significantly improve the user experience for harbor messaging by providing real-time updates without requiring manual refreshes. The addition of file attachments and link sharing capabilities will make messaging more powerful and useful for team collaboration.

The file attachment system leverages the existing harbor media library infrastructure (not the separate dashboard media architecture) while adding desktop upload capabilities, providing users with flexible options for sharing files. The link sharing system enables easy sharing of internet content with automatic preview generation and clickable links.

The addition of the unread message indicator in the harbor appbar will provide immediate visibility of new messages, further enhancing the user experience.

The phased approach ensures a stable, secure, and scalable solution that maintains the existing security model while adding modern real-time capabilities and enhanced messaging features. The appbar integration will make messaging more discoverable and provide users with at-a-glance information about their unread messages.

The implementation follows established patterns in the codebase and leverages Cloudflare's infrastructure for optimal performance and reliability.
