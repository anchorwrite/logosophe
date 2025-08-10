# Messaging SSE Implementation Plan

## Overview
This document outlines the plan to upgrade the user-facing messaging feature in the harbor interface to use Server-Sent Events (SSE) for real-time message updates without requiring browser refreshes.

## Current Architecture
The messaging system currently uses a traditional request-response pattern:
- Messages are sent via POST to `/api/messaging/send`
- Messages are retrieved via GET from `/api/messages` and `/api/messaging/messages`
- UI components manually refresh or poll for updates
- No real-time updates are available

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
- **Storage**: Use Cloudflare Durable Objects or KV for managing active SSE connections
- **Tenant Isolation**: Ensure connections are properly scoped to user's tenant
- **Connection Lifecycle**: Handle connection establishment, maintenance, and cleanup

### 2. Event Broadcasting System

#### 2.1 Event Types
- `message:new` - New message received by user
- `message:read` - Message marked as read by user
- `message:delete` - Message deleted (if user has access)
- `message:update` - Message content updated

#### 2.2 Broadcasting Triggers
- **Message Send**: Broadcast `message:new` when `/api/messaging/send` is called
- **Read Status**: Broadcast `message:read` when marking messages as read
- **Message Actions**: Broadcast appropriate events for delete/update operations

#### 2.3 Event Payload Structure
```typescript
interface MessageEvent {
  type: 'message:new' | 'message:read' | 'message:delete' | 'message:update';
  data: {
    messageId: number;
    tenantId: string;
    timestamp: string;
    payload: any; // Event-specific data
  };
}
```

### 3. Client-Side Integration

#### 3.1 SSE Client Implementation
- **Component**: Update `SubscriberMessagingInterface.tsx`
- **Connection**: Replace manual refresh/polling with EventSource
- **Reconnection**: Implement automatic reconnection with exponential backoff
- **Error Handling**: Graceful fallback to existing behavior on connection failures

#### 3.2 Real-Time UI Updates
- **Message List**: Automatically update message list when new messages arrive
- **Read Status**: Update message badges and styling in real-time
- **Statistics**: Update message counts and stats automatically
- **Notifications**: Show real-time feedback for message actions

### 4. Harbor Appbar Integration

#### 4.1 Unread Message Indicator
- **Location**: Add messaging navigation item to harbor appbar with unread count badge
- **API Endpoint**: Create `/api/messaging/unread-count/route.ts` for fetching unread count
- **Real-Time Updates**: Use SSE to update unread count badge in real-time
- **Navigation**: Link directly to messaging interface from appbar

#### 4.2 Indicator Behavior
- **Display**: Show unread message count as a badge on the messaging navigation item
- **Auto-Clear**: Badge clears when user visits messaging page or when all messages are read
- **Real-Time**: Count updates automatically via SSE when new messages arrive
- **Fallback**: Graceful degradation if SSE unavailable (fallback to periodic polling)

#### 4.3 Implementation Details
- **Custom Hook**: Create `useUnreadMessageCount` hook for state management
- **Appbar Update**: Modify `/[lang]/harbor/appbar.tsx` to include messaging navigation
- **Badge Component**: Create reusable unread count badge component
- **State Synchronization**: Ensure appbar indicator stays in sync with messaging interface

### 5. Security & Performance

#### 5.1 Security Measures
- **Authentication**: Verify user session on SSE connection
- **Tenant Scoping**: Ensure users only receive events from their tenant
- **Rate Limiting**: Prevent abuse of SSE endpoints
- **Connection Validation**: Verify user permissions on connection establishment

#### 5.2 Performance Optimizations
- **Connection Pooling**: Efficiently manage multiple user connections
- **Event Batching**: Group multiple updates into single events where possible
- **Selective Broadcasting**: Only send relevant events to each user
- **Connection Cleanup**: Remove inactive connections to free resources

## Implementation Phases

### Phase 1: Core SSE Infrastructure (Week 1)
1. Create `/api/messaging/stream/[tenantId]/route.ts`
2. Implement connection management system
3. Set up event broadcasting framework
4. Add basic event types and payloads

### Phase 2: Event Integration (Week 2)
1. Update `/api/messaging/send/route.ts` to broadcast events
2. Integrate event broadcasting with existing message operations
3. Test event flow and connection management
4. Implement error handling and fallbacks

### Phase 3: Client Integration (Week 3)
1. Update `SubscriberMessagingInterface.tsx` to use SSE
2. Implement real-time UI updates
3. Add connection management and reconnection logic
4. Test real-time functionality end-to-end

### Phase 4: Harbor Appbar Integration (Week 4)
1. Create `/api/messaging/unread-count/route.ts` endpoint
2. Implement `useUnreadMessageCount` custom hook
3. Update harbor appbar to include messaging navigation with unread indicator
4. Integrate SSE updates for real-time badge updates
5. Test appbar integration and badge behavior

### Phase 5: Testing & Optimization (Week 5)
1. Performance testing with multiple concurrent users
2. Security testing and validation
3. Error handling and edge case testing
4. Documentation and deployment preparation

## Technical Requirements

### Dependencies
- Cloudflare Workers (already in use)
- D1 Database (already in use)
- Durable Objects or KV for connection management
- Existing authentication and authorization systems

### Browser Support
- Modern browsers with EventSource support
- Graceful fallback for older browsers
- Mobile device compatibility

### Scalability Considerations
- Support for multiple concurrent users per tenant
- Efficient memory usage for connection management
- Horizontal scaling capabilities

## Success Metrics

### User Experience
- **Real-time Updates**: Messages appear without manual refresh
- **Response Time**: Message updates within 1-2 seconds
- **Reliability**: 99%+ uptime for SSE connections
- **Fallback**: Graceful degradation when SSE unavailable
- **Appbar Integration**: Unread message count visible at all times in harbor interface

### Technical Performance
- **Connection Stability**: Minimal connection drops
- **Resource Usage**: Efficient memory and CPU utilization
- **Scalability**: Support for 100+ concurrent users per tenant
- **Error Rate**: <1% error rate for SSE operations

## Risk Mitigation

### Technical Risks
- **Connection Stability**: Implement robust reconnection logic
- **Memory Leaks**: Proper connection cleanup and resource management
- **Performance Impact**: Monitor and optimize resource usage
- **Browser Compatibility**: Test across different browsers and devices

### Security Risks
- **Data Leakage**: Strict tenant isolation and access controls
- **Connection Hijacking**: Secure authentication and validation
- **Resource Abuse**: Rate limiting and connection quotas
- **Information Disclosure**: Careful event payload design

## Testing Strategy

### Unit Testing
- SSE endpoint functionality
- Event broadcasting logic
- Connection management
- Security validation
- Unread count API endpoint
- Appbar integration components

### Integration Testing
- End-to-end message flow
- Real-time updates across multiple users
- Error scenarios and fallbacks
- Performance under load
- Appbar indicator synchronization

### User Acceptance Testing
- Real user scenarios and workflows
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

### Long-term Considerations
- **WebSocket Migration**: Potential upgrade to WebSockets for bi-directional communication
- **Push Notifications**: Browser push notifications for offline users
- **Message Encryption**: End-to-end encryption for sensitive communications
- **Advanced Analytics**: Real-time messaging analytics and insights

## Conclusion

This SSE implementation will significantly improve the user experience for harbor messaging by providing real-time updates without requiring manual refreshes. The addition of the unread message indicator in the harbor appbar will provide immediate visibility of new messages, further enhancing the user experience.

The phased approach ensures a stable, secure, and scalable solution that maintains the existing security model while adding modern real-time capabilities. The appbar integration will make messaging more discoverable and provide users with at-a-glance information about their unread messages.

The implementation follows established patterns in the codebase and leverages Cloudflare's infrastructure for optimal performance and reliability.
