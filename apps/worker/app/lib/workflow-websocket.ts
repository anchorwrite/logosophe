export interface WorkflowWebSocketMessage {
  type: 'message' | 'status_update' | 'participant_joined' | 'participant_left' | 'workflow_completed' | 'typing_start' | 'typing_stop';
  data: any;
  timestamp: string;
}

export interface WorkflowWebSocketOptions {
  userEmail: string;
  workflowId: string;
  tenantId: string;
  onMessage?: (message: WorkflowWebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (error: Event) => void;
}

export class WorkflowWebSocket {
  private ws: WebSocket | null = null;
  private options: WorkflowWebSocketOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(options: WorkflowWebSocketOptions) {
    this.options = options;
  }

  connect(): void {
    try {
      // Create WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/workflow/${this.options.workflowId}/websocket?userEmail=${encodeURIComponent(this.options.userEmail)}&tenantId=${encodeURIComponent(this.options.tenantId)}`;

      console.log('Connecting to workflow WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Workflow WebSocket connected');
        this.reconnectAttempts = 0;
        this.options.onOpen?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WorkflowWebSocketMessage = JSON.parse(event.data);
          console.log('Workflow WebSocket message received:', message);
          this.options.onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('Workflow WebSocket closed:', event.code, event.reason);
        this.options.onClose?.(event.code, event.reason);
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Workflow WebSocket error:', error);
        this.options.onError?.(error);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close(1000, 'User initiated close');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export interface UserNotificationsWebSocketMessage {
  type: 'new_workflow_message';
  data: {
    workflowId: string;
    messageId: string;
    senderEmail: string;
    messageContent: string;
    timestamp: string;
  };
}

export interface UserNotificationsWebSocketOptions {
  userEmail: string;
  onMessage?: (message: UserNotificationsWebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (error: Event) => void;
}

export class UserNotificationsWebSocket {
  private ws: WebSocket | null = null;
  private options: UserNotificationsWebSocketOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(options: UserNotificationsWebSocketOptions) {
    this.options = options;
  }

  connect(): void {
    try {
      // Create WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/notifications/${encodeURIComponent(this.options.userEmail)}/websocket?userEmail=${encodeURIComponent(this.options.userEmail)}`;

      console.log('Connecting to notifications WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Notifications WebSocket connected');
        this.reconnectAttempts = 0;
        this.options.onOpen?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: UserNotificationsWebSocketMessage = JSON.parse(event.data);
          console.log('Notifications WebSocket message received:', message);
          this.options.onMessage?.(message);
        } catch (error) {
          console.error('Error parsing notifications WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('Notifications WebSocket closed:', event.code, event.reason);
        this.options.onClose?.(event.code, event.reason);
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Notifications WebSocket error:', error);
        this.options.onError?.(error);
      };

    } catch (error) {
      console.error('Error creating notifications WebSocket connection:', error);
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close(1000, 'User initiated close');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
} 