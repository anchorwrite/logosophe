'use client';

import { useState, useEffect, useRef } from 'react';
import { Box, Badge } from '@radix-ui/themes';
import { Bell } from 'lucide-react';

interface NotificationIndicatorProps {
  userEmail: string;
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

export function NotificationIndicator({ userEmail }: NotificationIndicatorProps) {
  const [hasNotifications, setHasNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connectToNotificationWebSocket = async () => {
      try {
        // Get the WebSocket URL from our API
        const response = await fetch('/api/harbor/notifications/websocket-url');
        const data = await response.json() as { success: boolean; wsUrl?: string; error?: string };
        
        if (!data.success) {
          console.error('Failed to get WebSocket URL for notifications:', data.error);
          return;
        }

        // Connect to a global notification WebSocket
        const wsUrl = data.wsUrl + `/notifications?userEmail=${encodeURIComponent(userEmail)}`;
        
        console.log('Connecting to notification WebSocket:', wsUrl);
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Notification WebSocket connected successfully');
          setIsConnected(true);
        };
        
        ws.onmessage = (event) => {
          console.log('Notification WebSocket message received:', event.data);
          try {
            const data = JSON.parse(event.data) as NotificationMessage;
            console.log('Parsed notification message:', data);
            
            if (data.type === 'new_workflow_message') {
              console.log('New workflow message notification received');
              setHasNotifications(true);
              setNotificationCount(prev => prev + 1);
            }
          } catch (error) {
            console.error('Error parsing notification message:', error);
          }
        };

        ws.onclose = () => {
          console.log('Notification WebSocket disconnected');
          setIsConnected(false);
          // Attempt to reconnect after a delay
          setTimeout(() => {
            if (wsRef.current === ws) {
              connectToNotificationWebSocket();
            }
          }, 5000);
        };

        ws.onerror = (error) => {
          console.error('Notification WebSocket error:', error);
          setIsConnected(false);
        };
      } catch (error) {
        console.error('Error connecting to notification WebSocket:', error);
      }
    };

    if (userEmail) {
      connectToNotificationWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [userEmail]);

  // Listen for notification clear events
  useEffect(() => {
    const handleNotificationClear = (event: CustomEvent) => {
      console.log('NotificationIndicator: Received notification clear event');
      setHasNotifications(false);
      setNotificationCount(0);
    };

    // Listen for custom event when notifications are cleared
    window.addEventListener('notifications-cleared', handleNotificationClear as EventListener);

    return () => {
      window.removeEventListener('notifications-cleared', handleNotificationClear as EventListener);
    };
  }, []);

  // Clear notifications when user clicks on the indicator
  const handleNotificationClick = () => {
    setHasNotifications(false);
    setNotificationCount(0);
  };

  if (!hasNotifications) {
    return null;
  }

  return (
    <Box style={{ position: 'relative' }}>
      <Bell 
        size={20} 
        style={{ cursor: 'pointer' }}
        onClick={handleNotificationClick}
      />
      <Badge 
        color="red" 
        size="1" 
        style={{ 
          position: 'absolute', 
          top: '-8px', 
          right: '-8px',
          minWidth: '16px',
          height: '16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 'bold'
        }}
      >
        {notificationCount > 9 ? '9+' : notificationCount}
      </Badge>
    </Box>
  );
} 