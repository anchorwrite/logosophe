"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

interface MessagingContextType {
  unreadCount: number;
  sseConnected: boolean;
  isLoading: boolean;
  error: string | null;
  markAsRead: (count?: number) => void;
  incrementCount: (count?: number) => void;
  resetCount: () => void;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

interface MessagingProviderProps {
  children: ReactNode;
}

export function MessagingProvider({ children }: MessagingProviderProps) {
  const { data: session, status } = useSession();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUnreadCountRef = useRef<number>(0);

  const fetchUnreadCount = async () => {
    // Don't fetch if session is still loading or not authenticated
    if (status === 'loading' || !session?.user?.email || session.user.role !== 'subscriber') {
      setUnreadCount(0);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/messaging/unread-count', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setUnreadCount(0);
          setError(null);
          return;
        }
        throw new Error(`Failed to fetch unread count: ${response.status}`);
      }

      const data = await response.json() as { unreadCount: number; tenantId: string; tenantName: string; recentUnreadMessages: any[]; timestamp: string };
      setUnreadCount(data.unreadCount);
      lastUnreadCountRef.current = data.unreadCount;
      setError(null);
    } catch (err) {
      console.error('Error fetching unread count:', err);
      if (err instanceof Error && !err.message.includes('401') && !err.message.includes('403')) {
        setError(err.message);
      } else {
        setError(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = (count: number = 1) => {
    setUnreadCount(prev => Math.max(0, prev - count));
  };

  const incrementCount = (count: number = 1) => {
    setUnreadCount(prev => prev + count);
  };

  const resetCount = () => {
    setUnreadCount(0);
  };

  // SSE Connection Management
  useEffect(() => {
    if (!session?.user?.email || session.user.role !== 'subscriber') {
      return;
    }

    const connectSSE = async () => {
      try {
        // Get user's tenant ID from the unread count endpoint
        const response = await fetch('/api/messaging/unread-count', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            return;
          }
          throw new Error('Failed to get tenant info');
        }
        
        const unreadData = await response.json() as { unreadCount: number; tenantId: string; tenantName: string; recentUnreadMessages: any[]; timestamp: string };
        const userTenantId = unreadData.tenantId;
        
        if (!userTenantId) {
          console.warn('No valid tenant found for user, skipping SSE connection');
          return;
        }

        // Create SSE connection
        const sseUrl = `/api/messaging/stream/${userTenantId}`;
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setSseConnected(true);
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
              case 'unread:update':
                // Update count from server
                const newCount = sseEvent.data.count;
                if (newCount !== lastUnreadCountRef.current) {
                  lastUnreadCountRef.current = newCount;
                  setUnreadCount(newCount);
                }
                break;
              case 'connection:established':
                setSseConnected(true);
                break;
            }
          } catch (error) {
            console.error('Error parsing SSE message in messaging context:', error);
          }
        };

        eventSource.onerror = (error) => {
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
        console.error('Error establishing SSE connection:', error);
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
  }, [session?.user?.email, session?.user?.role, status]);

  // Fetch unread count when session changes
  useEffect(() => {
    if (session?.user?.email && session.user.role === 'subscriber') {
      fetchUnreadCount();
    } else {
      setUnreadCount(0);
      setError(null);
    }
  }, [session?.user?.email, session?.user?.role]);

  // Set up polling as fallback (reduced frequency when SSE is connected)
  useEffect(() => {
    if (status === 'loading' || !session?.user?.email || session.user.role !== 'subscriber') {
      return;
    }

    // Use longer interval when SSE is connected, shorter when not
    const pollInterval = sseConnected ? 120000 : 30000; // 2 min when SSE connected, 30s when not

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [session?.user?.email, session?.user?.role, sseConnected, status]);

  const value: MessagingContextType = {
    unreadCount,
    sseConnected,
    isLoading,
    error,
    markAsRead,
    incrementCount,
    resetCount
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
}
