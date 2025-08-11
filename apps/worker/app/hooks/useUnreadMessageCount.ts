import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

// Singleton SSE connection to prevent multiple connections
let globalEventSource: EventSource | null = null;
let globalConnectionCount = 0;
let globalConnectionTenantId: string | null = null;

interface UnreadCountResponse {
  unreadCount: number;
  tenantId: string;
  tenantName: string;
  recentUnreadMessages: Array<{
    Id: number;
    Subject: string;
    SenderEmail: string;
    SenderName: string;
    CreatedAt: string;
    HasAttachments: boolean;
    AttachmentCount: number;
  }>;
  timestamp: string;
}

export function useUnreadMessageCount() {
  const { data: session, status } = useSession();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    // Don't fetch if session is still loading or not authenticated
    if (status === 'loading' || !session?.user?.email || session.user.role !== 'subscriber') {
      setUnreadCount(0);
      setError(null);
      return;
    }

    // Don't fetch if session is not available
    if (!session) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/messaging/unread-count', {
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // User is not authenticated, don't set error
          setUnreadCount(0);
          setError(null);
          return;
        }
        if (response.status === 403) {
          // User is forbidden, don't set error
          setUnreadCount(0);
          setError(null);
          return;
        }
        throw new Error(`Failed to fetch unread count: ${response.status}`);
      }

      const data: UnreadCountResponse = await response.json();
      setUnreadCount(data.unreadCount);
      setError(null); // Clear any previous errors on success
    } catch (err) {
      console.error('Error fetching unread count:', err);
      // Only set error for non-authentication related issues
      if (err instanceof Error && !err.message.includes('401') && !err.message.includes('403')) {
        setError(err.message);
      } else {
        setError(null);
      }
      // Don't update the count on error to avoid showing 0 when there might be unread messages
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.email, session?.user?.role, session, status]);

  const markAsRead = useCallback((count: number = 1) => {
    setUnreadCount(prev => Math.max(0, prev - count));
  }, []);

  const resetCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const incrementCount = useCallback((count: number = 1) => {
    setUnreadCount(prev => prev + count);
  }, []);

  // Singleton SSE connection to prevent multiple connections
  useEffect(() => {
    // Don't connect if session is still loading or not authenticated
    if (status === 'loading' || !session?.user?.email || session.user.role !== 'subscriber') {
      return;
    }

    // Get user's tenant ID for SSE connection
    const connectSSE = async () => {
      try {
        // First, get the user's tenant ID from the unread count endpoint
        const response = await fetch('/api/messaging/unread-count', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            // User is not authenticated, don't proceed with SSE
            return;
          }
          if (response.status === 403) {
            // User is forbidden, don't proceed with SSE
            return;
          }
          throw new Error('Failed to get tenant info');
        }
        
        const unreadData = await response.json() as UnreadCountResponse;
        let userTenantId = unreadData.tenantId;
        
        // Fallback: if tenantId is not available from unread count API, try to get it from user/tenants
        if (!userTenantId) {
          try {
            const tenantResponse = await fetch('/api/user/tenants', {
              credentials: 'include',
            });
            
            if (tenantResponse.ok) {
              const tenantData = await tenantResponse.json() as Array<{ Id: string; Name: string }>;
              userTenantId = tenantData[0]?.Id;
            }
          } catch (fallbackError) {
            console.warn('Failed to get tenant info from fallback endpoint:', fallbackError);
          }
        }
        
        if (!userTenantId) {
          console.warn('No valid tenant found for user, skipping SSE connection');
          return;
        }

        // Check if we already have a connection to this tenant
        if (globalEventSource && globalConnectionTenantId === userTenantId) {
          // Reuse existing connection
          globalConnectionCount++;
          setSseConnected(true);
          console.log('Reusing existing SSE connection for tenant:', userTenantId);
          return;
        }

        // Close existing connection if it's to a different tenant
        if (globalEventSource && globalConnectionTenantId !== userTenantId) {
          globalEventSource.close();
          globalEventSource = null;
          globalConnectionCount = 0;
          globalConnectionTenantId = null;
        }

        // Create new SSE connection
        const sseUrl = `/api/messaging/stream/${userTenantId}`;
        globalEventSource = new EventSource(sseUrl);
        globalConnectionTenantId = userTenantId;
        globalConnectionCount = 1;

        globalEventSource.onopen = () => {
          setSseConnected(true);
          console.log('SSE connection established for tenant:', userTenantId);
        };

        globalEventSource.onmessage = (event) => {
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

        globalEventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
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
      if (globalEventSource && globalConnectionCount > 0) {
        globalConnectionCount--;
        
        // Only close the connection if no other hooks are using it
        if (globalConnectionCount === 0) {
          globalEventSource.close();
          globalEventSource = null;
          globalConnectionTenantId = null;
        }
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [session?.user?.email, session?.user?.role, incrementCount, markAsRead, status]);

  // Fetch unread count when session changes
  useEffect(() => {
    // Only fetch if we have a valid session
    if (session?.user?.email && session.user.role === 'subscriber') {
      fetchUnreadCount();
    } else {
      // Reset count when no valid session
      setUnreadCount(0);
      setError(null);
    }
  }, [fetchUnreadCount, session?.user?.email, session?.user?.role]);

  // Set up polling as fallback (reduced frequency when SSE is connected)
  useEffect(() => {
    // Don't poll if session is still loading or not authenticated
    if (status === 'loading' || !session?.user?.email || session.user.role !== 'subscriber') {
      return;
    }

    // Use longer interval when SSE is connected, shorter when not
    const pollInterval = sseConnected ? 120000 : 30000; // 2 min when SSE connected, 30s when not

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [session?.user?.email, session?.user?.role, fetchUnreadCount, sseConnected, status]);

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
