"use client";

import { Box, Badge, Flex, Text } from '@radix-ui/themes';
import { useWorkflowMessaging } from '@/contexts/WorkflowMessagingContext';

interface UnreadWorkflowBadgeProps {
  showConnectionStatus?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'minimal' | 'detailed';
}

export function UnreadWorkflowBadge({ 
  showConnectionStatus = true, 
  size = 'medium',
  variant = 'default' 
}: UnreadWorkflowBadgeProps) {
  const { unreadCount, sseConnected, isLoading, error } = useWorkflowMessaging();

  // Show loading indicator if still loading
  if (isLoading) {
    return (
      <Flex align="center" gap="1">
        <Box 
          style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--blue-9)',
            opacity: 0.8
          }} 
          title="Loading unread count..."
        />
        {variant === 'detailed' && (
          <Text size="1" color="gray" style={{ marginLeft: '4px' }}>
            Loading...
          </Text>
        )}
      </Flex>
    );
  }

  // Don't show anything if there's an error
  if (error) {
    return null;
  }

  // Always show the badge, even when count is 0
  const getBadgeSize = () => {
    switch (size) {
      case 'small':
        return { width: '16px', height: '16px', fontSize: '10px' };
      case 'large':
        return { width: '24px', height: '24px', fontSize: '12px' };
      default:
        return { width: '20px', height: '20px', fontSize: '11px' };
    }
  };

  const badgeSize = getBadgeSize();

  return (
    <Flex align="center" gap="1">
      {/* Asterisk indicators with connection status color */}
      <Box 
        style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px'
        }}
        title={sseConnected ? 'Workflow updates active' : 'Workflow updates disconnected'}
      >
        {/* Left square */}
        <Box 
          style={{
            width: '6px',
            height: '6px',
            backgroundColor: sseConnected ? 'var(--green-9)' : 'var(--orange-9)',
            opacity: 0.8
          }}
        />
        
        {/* Unread count number - always show, even when 0 */}
        <Badge 
          color={unreadCount > 0 ? "red" : "gray"} 
          size="1" 
          style={{ 
            minWidth: badgeSize.width, 
            height: badgeSize.height, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: badgeSize.fontSize,
            fontWeight: 'bold',
            borderRadius: '4px',
            border: '1px solid white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            margin: '0 2px'
          }}
          title={unreadCount > 0 ? `${unreadCount} unread workflow message${unreadCount === 1 ? '' : 's'}` : 'No unread workflow messages'}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
        
        {/* Right square */}
        <Box 
          style={{
            width: '6px',
            height: '6px',
            backgroundColor: sseConnected ? 'var(--green-9)' : 'var(--orange-9)',
            opacity: 0.8
          }}
        />
      </Box>
      
      {variant === 'detailed' && (
        <Text size="1" color="gray" style={{ marginLeft: '4px' }}>
          {unreadCount === 1 ? 'workflow' : 'workflows'}
        </Text>
      )}
      

      
      {isLoading && (
        <Box 
          style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--blue-9)',
            opacity: 0.8,
            marginLeft: '4px'
          }} 
          title="Loading..."
        />
      )}
    </Flex>
  );
}
