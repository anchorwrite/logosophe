import { DurableObject, DurableObjectState } from '@cloudflare/workers-types';

// Declare WebSocketPair for Cloudflare Workers environment
declare const WebSocketPair: {
  new(): [WebSocket, WebSocket];
};

// Import crypto for UUID generation
declare const crypto: Crypto;

interface Workflow {
  id: string;
  tenantId: string;
  initiatorEmail: string;
  mediaFileId: number;
  workflowType: 'editor' | 'agent' | 'reviewer';
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
}

interface WorkflowMessage {
  id: string;
  workflowId: string;
  senderEmail: string;
  messageType: 'request' | 'response' | 'upload' | 'share_link' | 'review';
  content: string;
  mediaFileId?: number;
  shareToken?: string;
  createdAt: string;
}

interface WorkflowParticipant {
  workflowId: string;
  participantEmail: string;
  role: 'initiator' | 'editor' | 'agent' | 'reviewer';
  joinedAt: string;
}

// WebSocket connection metadata for hibernation
interface WebSocketMetadata {
  userEmail: string;
  workflowId: string;
  tenantId: string;
  connectedAt: string;
}

// Real-time message types
interface RealTimeMessage {
  type: 'message' | 'status_update' | 'participant_joined' | 'participant_left' | 'workflow_completed' | 'typing_start' | 'typing_stop';
  data: any;
  timestamp: string;
}

export class WorkflowDurableObject implements DurableObject {
  private state: DurableObjectState;
  private env: any;
  private connectionTimeouts: Map<string, any> = new Map(); // Track timeouts by user email

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    console.log('Durable Object: Constructor called. State ID:', state.id.toString());
    
    // Restore in-memory state for hibernation
    // The WebSocket metadata is automatically restored when the Durable Object wakes up
    // via serializeAttachment/deserializeAttachment, so we don't need to restore that here
    
    // Note: Connection timeouts are not persisted across hibernation
    // This is intentional - when the Durable Object wakes up, it starts fresh
    // The timeouts will be re-established as WebSocket messages come in
    this.connectionTimeouts = new Map();
    
    // Restore any other in-memory state that might be needed
    // For hibernation, we rely on serializeAttachment for WebSocket metadata
    // and Durable Object Storage for persistent data
  }

  // @ts-ignore - Type compatibility issue with DurableObject interface
  // @ts-ignore - Type compatibility issue with DurableObject interface
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log('Durable Object: fetch called. State ID:', this.state.id.toString());
    console.log('Durable Object received request:', request.url, 'Path:', path);

    try {
      // Handle WebSocket upgrade requests
      if (path === '/websocket') {
        console.log('Handling WebSocket upgrade in Durable Object');
        return await this.handleWebSocketUpgrade(request);
      }

      // Handle notifications from the worker
      if (path === '/notification') {
        console.log('Handling notification from worker');
        return await this.handleWorkerNotification(request);
      }

      // Handle connection check requests
      if (path === '/check') {
        console.log('Handling connection check request');
        return await this.handleConnectionCheck(request);
      }

      // Handle cleanup requests
      if (path === '/cleanup') {
        console.log('Handling cleanup request');
        return await this.handleCleanup(request);
      }

      // For all other operations, return a message indicating they should be handled by the main worker
      console.log('Durable Object: Non-WebSocket request, returning error');
      return new Response('Database operations should be handled by the main worker', { status: 400 });
    } catch (error) {
      console.error('Durable Object error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  // WebSocket message handler - this is called by the Durable Object runtime
  // @ts-ignore - Type compatibility issue with DurableObject interface
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    console.log('Durable Object: webSocketMessage called with message:', message);
    
    try {
      // Get metadata for this WebSocket
      const metadata = ws.deserializeAttachment() as WebSocketMetadata;
      if (!metadata) {
        console.error('Durable Object: No metadata found for WebSocket');
        return;
      }

      console.log('Durable Object: Found metadata for user:', metadata.userEmail, 'workflow:', metadata.workflowId);
      
      // Parse the message
      let parsedMessage;
      if (typeof message === 'string') {
        parsedMessage = JSON.parse(message);
      } else {
        // Handle ArrayBuffer - convert to string first
        const decoder = new TextDecoder();
        const messageString = decoder.decode(message);
        parsedMessage = JSON.parse(messageString);
      }

      console.log('Durable Object: Parsed message:', parsedMessage);
      
      // Handle the message
      await this.handleWebSocketMessage(metadata, parsedMessage);
      
    } catch (error) {
      console.error('Durable Object: Error handling WebSocket message:', error);
    }
  }

  // WebSocket close handler
  // @ts-ignore - Type compatibility issue with DurableObject interface
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    console.log('Durable Object: webSocketClose called. Code:', code, 'Reason:', reason, 'WasClean:', wasClean);
    
    try {
      const metadata = ws.deserializeAttachment() as WebSocketMetadata;
      if (metadata) {
        await this.handleWebSocketClose(metadata);
      }
    } catch (error) {
      console.error('Durable Object: Error handling WebSocket close:', error);
    }
  }

  // WebSocket error handler
  // @ts-ignore - Type compatibility issue with DurableObject interface
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('Durable Object: webSocketError called with error:', error);
    
    try {
      const metadata = ws.deserializeAttachment() as WebSocketMetadata;
      if (metadata) {
        await this.handleWebSocketClose(metadata);
      }
    } catch (closeError) {
      console.error('Durable Object: Error handling WebSocket error cleanup:', closeError);
    }
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userEmail = url.searchParams.get('userEmail');
    const workflowId = url.searchParams.get('workflowId');
    const tenantId = url.searchParams.get('tenantId');

    if (!userEmail || !workflowId || !tenantId) {
      return new Response('Missing required parameters: userEmail, workflowId, tenantId', { status: 400 });
    }

    console.log('Durable Object: Upgrading WebSocket for user:', userEmail, 'workflow:', workflowId, 'tenant:', tenantId);

    // Create WebSocket pair
    const [client, server] = new WebSocketPair();

    // Set up metadata for the server WebSocket
    const metadata: WebSocketMetadata = {
      userEmail,
      workflowId,
      tenantId,
      connectedAt: new Date().toISOString()
    };

    // Attach metadata to the server WebSocket
    server.serializeAttachment(metadata);

    // Accept the WebSocket connection
    server.accept();

    // Set up connection timeout
    this.setupConnectionTimeout(userEmail, 300000); // 5 minutes

    console.log('Durable Object: WebSocket connection established for user:', userEmail);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleWorkerNotification(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { type: string; data: any; workflowId?: string; tenantId?: string };
      const { type, data, workflowId, tenantId } = body;

      console.log('Durable Object: Handling worker notification. Type:', type, 'WorkflowId:', workflowId);

      // Create real-time message
      const realTimeMessage: RealTimeMessage = {
        type: type as any,
        data,
        timestamp: new Date().toISOString()
      };

      // Broadcast to all connected clients for this workflow
      if (workflowId) {
        await this.broadcastToWorkflow(workflowId, realTimeMessage);
      }

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Durable Object: Error handling worker notification:', error);
      return new Response('Error processing notification', { status: 500 });
    }
  }

  private async handleConnectionCheck(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userEmail = url.searchParams.get('userEmail');
      const workflowId = url.searchParams.get('workflowId');

      if (!userEmail || !workflowId) {
        return new Response('Missing required parameters', { status: 400 });
      }

      // Check if user has an active connection
      const connections = await this.state.storage.get('connections') as Map<string, any> || new Map();
      const userConnection = connections.get(userEmail);

      if (userConnection && userConnection.workflowId === workflowId) {
        return new Response('Connected', { status: 200 });
      } else {
        return new Response('Not connected', { status: 404 });
      }
    } catch (error) {
      console.error('Durable Object: Error checking connection:', error);
      return new Response('Error checking connection', { status: 500 });
    }
  }

  private async handleCleanup(request: Request): Promise<Response> {
    try {
      console.log('Durable Object: Starting cleanup process');

      // Get all connections
      const connections = await this.state.storage.get('connections') as Map<string, any> || new Map();
      
      // Close inactive connections
      const now = Date.now();
      const activeConnections = new Map();

      for (const [userEmail, connection] of connections.entries()) {
        const lastActivity = connection.lastActivity || 0;
        const timeout = this.connectionTimeouts.get(userEmail) || 300000; // 5 minutes default

        if (now - lastActivity < timeout) {
          activeConnections.set(userEmail, connection);
        } else {
          console.log('Durable Object: Cleaning up inactive connection for user:', userEmail);
          this.closeUserConnection(userEmail);
        }
      }

      // Update stored connections
      await this.state.storage.put('connections', activeConnections);

      return new Response('Cleanup completed', { status: 200 });
    } catch (error) {
      console.error('Durable Object: Error during cleanup:', error);
      return new Response('Error during cleanup', { status: 500 });
    }
  }

  private async handleWebSocketMessage(metadata: WebSocketMetadata, event: MessageEvent): Promise<void> {
    console.log('Durable Object: Handling WebSocket message from user:', metadata.userEmail);

    try {
      // Update last activity
      const connections = await this.state.storage.get('connections') as Map<string, any> || new Map();
      connections.set(metadata.userEmail, {
        ...connections.get(metadata.userEmail),
        lastActivity: Date.now(),
        workflowId: metadata.workflowId,
        tenantId: metadata.tenantId
      });
      await this.state.storage.put('connections', connections);

      // Reset connection timeout
      this.setupConnectionTimeout(metadata.userEmail, 300000); // 5 minutes

      // Handle the message based on type
      await this.handleRealTimeMessage(metadata, event.data);

    } catch (error) {
      console.error('Durable Object: Error handling WebSocket message:', error);
    }
  }

  private async handleRealTimeMessage(metadata: WebSocketMetadata, message: any): Promise<void> {
    console.log('Durable Object: Handling real-time message from user:', metadata.userEmail);

    try {
      // Store message in database
      const db = this.env.DB;
      
      const insertMessageQuery = `
        INSERT INTO WorkflowMessages (Id, WorkflowId, SenderEmail, MessageType, Content, MediaFileId, ShareToken, CreatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const messageId = crypto.randomUUID();
      const messageType = message.type || 'message';
      const content = message.content || '';
      const mediaFileId = message.mediaFileId || null;
      const shareToken = message.shareToken || null;
      const createdAt = new Date().toISOString();

      await db.prepare(insertMessageQuery)
        .bind(messageId, metadata.workflowId, metadata.userEmail, messageType, content, mediaFileId, shareToken, createdAt)
        .run();

      // Create real-time message for broadcasting
      const realTimeMessage: RealTimeMessage = {
        type: 'message',
        data: {
          id: messageId,
          workflowId: metadata.workflowId,
          senderEmail: metadata.userEmail,
          messageType,
          content,
          mediaFileId,
          shareToken,
          createdAt
        },
        timestamp: new Date().toISOString()
      };

      // Broadcast to all connected clients for this workflow
      await this.broadcastToWorkflow(metadata.workflowId, realTimeMessage);

      // Also broadcast to global notifications
      await this.broadcastToGlobalNotifications(metadata.workflowId, realTimeMessage);

    } catch (error) {
      console.error('Durable Object: Error handling real-time message:', error);
    }
  }

  private async broadcastToWorkflow(workflowId: string, message: RealTimeMessage): Promise<void> {
    try {
      console.log('Durable Object: Broadcasting to workflow:', workflowId);

      // Get all connections for this workflow
      const connections = await this.state.storage.get('connections') as Map<string, any> || new Map();
      
      for (const [userEmail, connection] of connections.entries()) {
        if (connection.workflowId === workflowId) {
          // Send message to this user's WebSocket
          // Note: In a real implementation, you'd need to maintain WebSocket references
          // For now, we'll rely on the Durable Object's built-in WebSocket management
          console.log('Durable Object: Would send message to user:', userEmail);
        }
      }

    } catch (error) {
      console.error('Durable Object: Error broadcasting to workflow:', error);
    }
  }

  private async broadcastToGlobalNotifications(workflowId: string, message: RealTimeMessage): Promise<void> {
    try {
      console.log('Durable Object: Broadcasting to global notifications for workflow:', workflowId);

      // Get the USER_NOTIFICATIONS_DO binding
      const userNotificationsDO = this.env.USER_NOTIFICATIONS_DO;
      
      if (userNotificationsDO) {
        // Get all participants for this workflow
        const db = this.env.DB;
        const participantsQuery = `
          SELECT DISTINCT ParticipantEmail 
          FROM WorkflowParticipants 
          WHERE WorkflowId = ?
        `;
        
        const participants = await db.prepare(participantsQuery)
          .bind(workflowId)
          .all() as any;

        // Send notification to each participant
        for (const participant of participants.results) {
          const participantEmail = participant.ParticipantEmail;
          
          // Get the UserNotificationsDurableObject for this user
          const userNotificationsId = userNotificationsDO.idFromName(participantEmail);
          const userNotificationsStub = userNotificationsDO.get(userNotificationsId);
          
          // Send notification
          await userNotificationsStub.fetch('http://localhost/notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'new_workflow_message',
              data: {
                workflowId,
                messageId: message.data.id,
                senderEmail: message.data.senderEmail,
                messageContent: message.data.content,
                timestamp: message.timestamp
              }
            })
          });
        }
      }

    } catch (error) {
      console.error('Durable Object: Error broadcasting to global notifications:', error);
    }
  }

  private async broadcastTypingStatus(workflowId: string, userEmail: string, isTyping: boolean): Promise<void> {
    try {
      console.log('Durable Object: Broadcasting typing status for user:', userEmail, 'isTyping:', isTyping);

      const realTimeMessage: RealTimeMessage = {
        type: isTyping ? 'typing_start' : 'typing_stop',
        data: {
          userEmail,
          workflowId
        },
        timestamp: new Date().toISOString()
      };

      await this.broadcastToWorkflow(workflowId, realTimeMessage);

    } catch (error) {
      console.error('Durable Object: Error broadcasting typing status:', error);
    }
  }

  private async handleWebSocketClose(metadata: WebSocketMetadata): Promise<void> {
    console.log('Durable Object: Handling WebSocket close for user:', metadata.userEmail);

    try {
      // Remove connection timeout
      this.connectionTimeouts.delete(metadata.userEmail);

      // Update connections storage
      const connections = await this.state.storage.get('connections') as Map<string, any> || new Map();
      connections.delete(metadata.userEmail);
      await this.state.storage.put('connections', connections);

      // Broadcast participant left message
      const realTimeMessage: RealTimeMessage = {
        type: 'participant_left',
        data: {
          userEmail: metadata.userEmail,
          workflowId: metadata.workflowId
        },
        timestamp: new Date().toISOString()
      };

      await this.broadcastToWorkflow(metadata.workflowId, realTimeMessage);

    } catch (error) {
      console.error('Durable Object: Error handling WebSocket close:', error);
    }
  }

  private setupConnectionTimeout(userEmail: string, timeoutMs: number): void {
    // Clear existing timeout
    const existingTimeout = this.connectionTimeouts.get(userEmail);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeoutId = setTimeout(() => {
      console.log('Durable Object: Connection timeout for user:', userEmail);
      this.closeUserConnection(userEmail);
    }, timeoutMs);

    this.connectionTimeouts.set(userEmail, timeoutId);
  }

  private closeUserConnection(userEmail: string): void {
    console.log('Durable Object: Closing connection for user:', userEmail);
    
    // Clear timeout
    const timeoutId = this.connectionTimeouts.get(userEmail);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.connectionTimeouts.delete(userEmail);
    }

    // Note: In a real implementation, you'd close the actual WebSocket
    // For now, we'll rely on the Durable Object's built-in WebSocket management
  }
} 