import { useState, useEffect, useCallback } from 'react';
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

  // Fetch unread count when session changes
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Set up polling to refresh unread count every 30 seconds
  useEffect(() => {
    if (!session?.user?.email || session.user.role !== 'subscriber') {
      return;
    }

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [session?.user?.email, session?.user?.role, fetchUnreadCount]);

  return {
    unreadCount,
    isLoading,
    error,
    fetchUnreadCount,
    markAsRead,
    resetCount,
    incrementCount
  };
}
