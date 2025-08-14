"use client";

import { useEffect } from 'react';
import { useWorkflowMessaging } from '@/contexts/WorkflowMessagingContext';

interface UseWorkflowReadTrackingProps {
  workflowId: string;
  messageIds?: string[];
  autoMarkAsRead?: boolean;
}

export function useWorkflowReadTracking({ 
  workflowId, 
  messageIds, 
  autoMarkAsRead = true 
}: UseWorkflowReadTrackingProps) {
  const { markWorkflowAsRead } = useWorkflowMessaging();

  useEffect(() => {
    if (!autoMarkAsRead || !workflowId) {
      return;
    }

    // Mark workflow as read when component mounts
    const markAsRead = async () => {
      try {
        await markWorkflowAsRead(workflowId, messageIds);
      } catch (error) {
        console.error('Error marking workflow as read:', error);
      }
    };

    // Small delay to ensure the page is fully loaded
    const timeoutId = setTimeout(markAsRead, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [workflowId, messageIds, autoMarkAsRead, markWorkflowAsRead]);

  return {
    markAsRead: () => markWorkflowAsRead(workflowId, messageIds)
  };
}
