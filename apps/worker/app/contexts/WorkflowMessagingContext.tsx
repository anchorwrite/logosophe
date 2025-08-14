"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface WorkflowMessagingContextType {
  unreadCount: number;
  sseConnected: boolean;
  isLoading: boolean;
  error: string | null;
  markWorkflowAsRead: (workflowId: string, messageIds?: string[]) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const WorkflowMessagingContext = createContext<WorkflowMessagingContextType | undefined>(undefined);

// Global variables for singleton SSE connection
let globalWorkflowEventSource: EventSource | null = null;
let globalWorkflowConnectionCount = 0;
let globalWorkflowConnectionTenantId: string | null = null;

export function WorkflowMessagingProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [sseConnected, setSseConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Get user's tenant ID
  useEffect(() => {
    const getUserTenant = async () => {
      if (!session?.user?.email) {
        setTenantId(null);
        return;
      }

      try {
        const response = await fetch('/api/user/tenants');
        if (response.ok) {
          const tenants = await response.json() as Array<{ Id: string; Name: string }>;
          // Use the first tenant (most users will have one tenant)
          if (tenants && tenants.length > 0) {
            setTenantId(tenants[0].Id);
          } else {
            setTenantId(null);
          }
        } else {
          setTenantId(null);
        }
      } catch (error) {
        console.error('Error fetching user tenant:', error);
        setTenantId(null);
      }
    };

    getUserTenant();
  }, [session?.user?.email]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.email || !tenantId) {
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/harbor/workflow/unread-count?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json() as { 
          unreadCount: number; 
          tenantId: string; 
          recentUnreadWorkflows: any[]; 
          timestamp: string 
        };
        setUnreadCount(data.unreadCount);
        setError(null);
      } else {
        setError('Failed to fetch unread count');
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.email, tenantId]);

  // Initialize SSE connection
  useEffect(() => {
    if (!session?.user?.email || !tenantId) {
      return;
    }

    // Increment connection count
    globalWorkflowConnectionCount++;

    // If we already have a connection for this tenant, reuse it
    if (globalWorkflowEventSource && globalWorkflowConnectionTenantId === tenantId) {
      setSseConnected(true);
      return;
    }

    // Close existing connection if it's for a different tenant
    if (globalWorkflowEventSource && globalWorkflowConnectionTenantId !== tenantId) {
      globalWorkflowEventSource.close();
      globalWorkflowEventSource = null;
      globalWorkflowConnectionTenantId = null;
    }

    // Create new SSE connection
    if (!globalWorkflowEventSource) {
      globalWorkflowEventSource = new EventSource(`/api/harbor/workflow/stream/${tenantId}`);
      globalWorkflowConnectionTenantId = tenantId;

      globalWorkflowEventSource.onopen = () => {
        setSseConnected(true);
        setError(null);
      };

      globalWorkflowEventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'workflow_message') {
            // Refresh unread count when new workflow message arrives
            fetchUnreadCount();
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      globalWorkflowEventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setSseConnected(false);
        setError('Connection lost');
        
        // Close the connection
        if (globalWorkflowEventSource) {
          globalWorkflowEventSource.close();
          globalWorkflowEventSource = null;
          globalWorkflowConnectionTenantId = null;
        }
      };
    }

    // Cleanup function
    return () => {
      globalWorkflowConnectionCount--;
      
      // Only close the connection if no other components are using it
      if (globalWorkflowConnectionCount === 0 && globalWorkflowEventSource) {
        globalWorkflowEventSource.close();
        globalWorkflowEventSource = null;
        globalWorkflowConnectionTenantId = null;
      }
    };
  }, [session?.user?.email, tenantId, fetchUnreadCount]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Polling fallback when SSE is not connected
  useEffect(() => {
    if (!sseConnected || !session?.user?.email || !tenantId) {
      return;
    }

    const pollInterval = setInterval(() => {
      fetchUnreadCount();
    }, 60000); // Poll every minute when SSE is connected

    return () => clearInterval(pollInterval);
  }, [sseConnected, session?.user?.email, tenantId, fetchUnreadCount]);

  // More frequent polling when SSE is not connected
  useEffect(() => {
    if (sseConnected || !session?.user?.email || !tenantId) {
      return;
    }

    const pollInterval = setInterval(() => {
      fetchUnreadCount();
    }, 15000); // Poll every 15 seconds when SSE is not connected

    return () => clearInterval(pollInterval);
  }, [sseConnected, session?.user?.email, tenantId, fetchUnreadCount]);

  // Mark workflow as read
  const markWorkflowAsRead = useCallback(async (workflowId: string, messageIds?: string[]) => {
    if (!session?.user?.email) {
      return;
    }

    try {
      const response = await fetch('/api/harbor/workflow/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId,
          messageIds,
        }),
      });

      if (response.ok) {
        // Refresh unread count after marking as read
        await fetchUnreadCount();
      } else {
        console.error('Failed to mark workflow as read');
      }
    } catch (error) {
      console.error('Error marking workflow as read:', error);
    }
  }, [session?.user?.email, fetchUnreadCount]);

  const refreshUnreadCount = useCallback(async () => {
    await fetchUnreadCount();
  }, [fetchUnreadCount]);

  const value: WorkflowMessagingContextType = {
    unreadCount,
    sseConnected,
    isLoading,
    error,
    markWorkflowAsRead,
    refreshUnreadCount,
  };

  return (
    <WorkflowMessagingContext.Provider value={value}>
      {children}
    </WorkflowMessagingContext.Provider>
  );
}

export function useWorkflowMessaging() {
  const context = useContext(WorkflowMessagingContext);
  if (context === undefined) {
    throw new Error('useWorkflowMessaging must be used within a WorkflowMessagingProvider');
  }
  return context;
}
