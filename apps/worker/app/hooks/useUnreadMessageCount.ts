import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface UnreadCountResponse {
  unreadCount: number;
  timestamp: string;
}

export function useUnreadMessageCount() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.email || session.user.role !== 'subscriber') {
      setUnreadCount(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/messaging/unread-count');
      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const data: UnreadCountResponse = await response.json();
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Error fetching unread count:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch unread count');
      // Don't update the count on error to avoid showing 0 when there might be unread messages
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.email, session?.user?.role]);

  const markAsRead = useCallback((count: number = 1) => {
    setUnreadCount(prev => Math.max(0, prev - count));
  }, []);

  const resetCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const incrementCount = useCallback((count: number = 1) => {
    setUnreadCount(prev => prev + count);
  }, []);

  // SSE Connection for real-time updates
  useEffect(() => {
    if (!session?.user?.email || session.user.role !== 'subscriber') {
      return;
    }

    // Get user's tenant ID for SSE connection
    const connectSSE = async () => {
      try {
        // First, get the user's tenant ID
        const response = await fetch('/api/messaging/unread-count');
        if (!response.ok) {
          throw new Error('Failed to get tenant info');
        }
        
        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Get tenant ID from the response headers or make another call
        const tenantResponse = await fetch('/api/user/tenants');
        if (!tenantResponse.ok) {
          throw new Error('Failed to get tenant info');
        }
        
        const tenantData = await tenantResponse.json() as { tenants?: Array<{ id: string; name: string }> };
        const userTenantId = tenantData.tenants?.[0]?.id;
        
        if (!userTenantId) {
          throw new Error('No tenant found');
        }

        // Connect to SSE stream
        const sseUrl = `/api/messaging/stream/${userTenantId}`;
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setSseConnected(true);
          console.log('SSE connection established for unread count');
        };

        eventSource.onmessage = (event) => {
          try {
            const sseEvent = JSON.parse(event.data);
            
            // Handle SSE events that affect unread count
            switch (sseEvent.type) {
              case 'message:new':
                // Increment count if user is a recipient
                if (sseEvent.data.recipients.includes(session.user.email)) {
                  incrementCount(1);
                }
                break;
              case 'message:read':
                // Decrement count if user read the message
                if (sseEvent.data.readBy === session.user.email) {
                  markAsRead(1);
                }
                break;
              case 'message:delete':
                // Decrement count if user was a recipient of deleted message
                // We'll need to check if this affects the count
                break;
              case 'connection:established':
                console.log('SSE connection confirmed for unread count');
                break;
            }
          } catch (error) {
            console.error('Error parsing SSE message in unread count hook:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE connection error in unread count hook:', error);
          setSseConnected(false);
          
          // Retry connection with exponential backoff
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            connectSSE();
          }, 5000);
        };
      } catch (error) {
        console.error('Error establishing SSE connection for unread count:', error);
        setSseConnected(false);
      }
    };

    connectSSE();

    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [session?.user?.email, session?.user?.role, incrementCount, markAsRead]);

  // Fetch unread count when session changes
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Set up polling as fallback (reduced frequency when SSE is connected)
  useEffect(() => {
    if (!session?.user?.email || session.user.role !== 'subscriber') {
      return;
    }

    // Use longer interval when SSE is connected, shorter when not
    const pollInterval = sseConnected ? 60000 : 15000; // 1 min when SSE connected, 15s when not

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [session?.user?.email, session?.user?.role, fetchUnreadCount, sseConnected]);

  return {
    unreadCount,
    isLoading,
    error,
    sseConnected,
    fetchUnreadCount,
    markAsRead,
    resetCount,
    incrementCount
  };
}
