"use client";

import { Box, Badge, Flex, Text } from '@radix-ui/themes';
import { useMessaging } from '@/contexts/MessagingContext';

interface UnreadMessageBadgeProps {
  showConnectionStatus?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'minimal' | 'detailed';
}

export function UnreadMessageBadge({ 
  showConnectionStatus = true, 
  size = 'medium',
  variant = 'default' 
}: UnreadMessageBadgeProps) {
  const { unreadCount, sseConnected, isLoading, error } = useMessaging();

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

  // Don't show anything if there's an error or no unread messages
  if (error || unreadCount === 0) {
    return null;
  }

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
      <Badge 
        color="red" 
        size="1" 
        style={{ 
          minWidth: badgeSize.width, 
          height: badgeSize.height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: badgeSize.fontSize,
          fontWeight: 'bold',
          borderRadius: '50%'
        }}
      >
        {unreadCount > 99 ? '99+' : unreadCount}
      </Badge>
      
      {variant === 'detailed' && (
        <Text size="1" color="gray" style={{ marginLeft: '4px' }}>
          {unreadCount === 1 ? 'message' : 'messages'}
        </Text>
      )}
      
      {showConnectionStatus && (
        <Box 
          style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            backgroundColor: sseConnected ? 'var(--green-9)' : 'var(--orange-9)',
            opacity: 0.8,
            marginLeft: '4px'
          }} 
          title={sseConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}
        />
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
