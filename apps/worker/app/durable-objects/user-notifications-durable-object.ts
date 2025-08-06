import { DurableObject, DurableObjectState } from '@cloudflare/workers-types';

// Declare WebSocketPair for Cloudflare Workers environment
declare const WebSocketPair: {
  new(): [WebSocket, WebSocket];
};

// Declare crypto for UUID generation
declare const crypto: Crypto;

interface WebSocketMetadata {
  userEmail: string;
  connectedAt: string;
}

interface StoredNotification {
  id: string;
  workflowId: string;
  messageId: string;
  senderEmail: string;
  messageContent: string;
  timestamp: string;
}

interface NotificationMessage {
  type: 'new_workflow_message';
  data: {
    workflowId: string;
    messageId: string;
    senderEmail: string;
    messageContent: string;
    timestamp: string;
  };
}

export class UserNotificationsDurableObject implements DurableObject {
  private state: DurableObjectState;
  private env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    console.log('UserNotificationsDurableObject: Constructor called. State ID:', state.id.toString());
  }

  // @ts-ignore - Type compatibility issue with DurableObject interface
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log('UserNotificationsDurableObject: fetch called. State ID:', this.state.id.toString());
    console.log('UserNotificationsDurableObject received request:', request.url, 'Path:', path);

    try {
      // Handle WebSocket upgrade requests
      if (path === '/websocket') {
        console.log('Handling WebSocket upgrade in UserNotificationsDurableObject');
        return await this.handleWebSocketUpgrade(request);
      }

      // Handle notifications from the worker
      if (path === '/notification') {
        console.log('Handling notification from worker');
        return await this.handleWorkerNotification(request);
      }

      // Handle clear notifications requests
      if (path === '/clear') {
        console.log('Handling clear notifications request');
        return await this.handleClearNotifications(request);
      }

      // Handle check unread notifications requests
      if (path === '/check') {
        console.log('Handling check unread notifications request');
        return await this.handleCheckNotifications(request);
      }

      // For all other operations, return a message indicating they should be handled by the main worker
      console.log('UserNotificationsDurableObject: Non-WebSocket request, returning error');
      return new Response('Database operations should be handled by the main worker', { status: 400 });
    } catch (error) {
      console.error('UserNotificationsDurableObject error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  // WebSocket message handler - this is called by the Durable Object runtime
  // @ts-ignore - Type compatibility issue with DurableObject interface
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    console.log('UserNotificationsDurableObject: webSocketMessage called with message:', message);
    
    try {
      // Get metadata for this WebSocket
      const metadata = ws.deserializeAttachment() as WebSocketMetadata;
      if (!metadata) {
        console.error('UserNotificationsDurableObject: No metadata found for WebSocket');
        return;
      }

      console.log('UserNotificationsDurableObject: Found metadata for user:', metadata.userEmail);
      
      // For now, we'll just log the message
      // In a real implementation, you might handle user-specific commands
      console.log('UserNotificationsDurableObject: Received message from user:', metadata.userEmail, 'Message:', message);
      
    } catch (error) {
      console.error('UserNotificationsDurableObject: Error handling WebSocket message:', error);
    }
  }

  // WebSocket close handler
  // @ts-ignore - Type compatibility issue with DurableObject interface
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    console.log('UserNotificationsDurableObject: webSocketClose called. Code:', code, 'Reason:', reason, 'WasClean:', wasClean);
    
    try {
      const metadata = ws.deserializeAttachment() as WebSocketMetadata;
      if (metadata) {
        console.log('UserNotificationsDurableObject: User disconnected:', metadata.userEmail);
      }
    } catch (error) {
      console.error('UserNotificationsDurableObject: Error handling WebSocket close:', error);
    }
  }

  // WebSocket error handler
  // @ts-ignore - Type compatibility issue with DurableObject interface
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('UserNotificationsDurableObject: webSocketError called with error:', error);
    
    try {
      const metadata = ws.deserializeAttachment() as WebSocketMetadata;
      if (metadata) {
        console.log('UserNotificationsDurableObject: WebSocket error for user:', metadata.userEmail);
      }
    } catch (closeError) {
      console.error('UserNotificationsDurableObject: Error handling WebSocket error cleanup:', closeError);
    }
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userEmail = url.searchParams.get('userEmail');

    if (!userEmail) {
      return new Response('Missing required parameter: userEmail', { status: 400 });
    }

    console.log('UserNotificationsDurableObject: Upgrading WebSocket for user:', userEmail);

    // Create WebSocket pair
    const [client, server] = new WebSocketPair();

    // Set up metadata for the server WebSocket
    const metadata: WebSocketMetadata = {
      userEmail,
      connectedAt: new Date().toISOString()
    };

    // Attach metadata to the server WebSocket
    server.serializeAttachment(metadata);

    // Accept the WebSocket connection
    server.accept();

    console.log('UserNotificationsDurableObject: WebSocket connection established for user:', userEmail);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleWorkerNotification(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { type: string; data: any };
      const { type, data } = body;

      console.log('UserNotificationsDurableObject: Handling worker notification. Type:', type);

      // Store the notification
      const notification: StoredNotification = {
        id: crypto.randomUUID(),
        workflowId: data.workflowId,
        messageId: data.messageId,
        senderEmail: data.senderEmail,
        messageContent: data.messageContent,
        timestamp: data.timestamp
      };

      // Get existing notifications for this user
      const notifications = await this.state.storage.get('notifications') as StoredNotification[] || [];
      
      // Add new notification
      notifications.push(notification);
      
      // Keep only the last 100 notifications to prevent storage bloat
      if (notifications.length > 100) {
        notifications.splice(0, notifications.length - 100);
      }
      
      // Store updated notifications
      await this.state.storage.put('notifications', notifications);

      // Create notification message for WebSocket clients
      const notificationMessage: NotificationMessage = {
        type: 'new_workflow_message',
        data: {
          workflowId: data.workflowId,
          messageId: data.messageId,
          senderEmail: data.senderEmail,
          messageContent: data.messageContent,
          timestamp: data.timestamp
        }
      };

      // Broadcast to all connected WebSocket clients for this user
      // Note: In a real implementation, you'd maintain WebSocket references
      console.log('UserNotificationsDurableObject: Would broadcast notification to user:', notificationMessage);

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('UserNotificationsDurableObject: Error handling worker notification:', error);
      return new Response('Error processing notification', { status: 500 });
    }
  }

  private async handleClearNotifications(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userEmail = url.searchParams.get('userEmail');

      if (!userEmail) {
        return new Response('Missing required parameter: userEmail', { status: 400 });
      }

      console.log('UserNotificationsDurableObject: Clearing notifications for user:', userEmail);

      // Clear all notifications for this user
      await this.state.storage.put('notifications', []);

      return new Response('Notifications cleared', { status: 200 });
    } catch (error) {
      console.error('UserNotificationsDurableObject: Error clearing notifications:', error);
      return new Response('Error clearing notifications', { status: 500 });
    }
  }

  private async handleCheckNotifications(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userEmail = url.searchParams.get('userEmail');

      if (!userEmail) {
        return new Response('Missing required parameter: userEmail', { status: 400 });
      }

      console.log('UserNotificationsDurableObject: Checking notifications for user:', userEmail);

      // Get notifications for this user
      const notifications = await this.state.storage.get('notifications') as StoredNotification[] || [];

      // Return unread notifications count and list
      return new Response(JSON.stringify({
        count: notifications.length,
        notifications: notifications
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('UserNotificationsDurableObject: Error checking notifications:', error);
      return new Response('Error checking notifications', { status: 500 });
    }
  }
} 