"use client";

import { Box, Flex, Text, Badge } from '@radix-ui/themes';
import { useMessaging } from '@/contexts/MessagingContext';

interface ConnectionStatusIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
}

export function ConnectionStatusIndicator({ 
  size = 'medium', 
  showText = false,
  variant = 'minimal' 
}: ConnectionStatusIndicatorProps) {
  const { sseConnected, isLoading, unreadCount } = useMessaging();

  const getIndicatorSize = () => {
    switch (size) {
      case 'small':
        return { width: '6px', height: '6px' };
      case 'large':
        return { width: '10px', height: '10px' };
      default:
        return { width: '8px', height: '8px' };
    }
  };

  const indicatorSize = getIndicatorSize();

  const getStatusColor = () => {
    if (isLoading) return 'var(--blue-9)';
    if (sseConnected) return 'var(--green-9)';
    return 'var(--orange-9)';
  };

  const getStatusText = () => {
    if (isLoading) return 'Connecting...';
    if (sseConnected) return 'Real-time active';
    return 'Real-time disconnected';
  };

  const getStatusTitle = () => {
    if (isLoading) return 'Establishing real-time connection...';
    if (sseConnected) return 'Real-time messaging updates are active';
    return 'Real-time messaging updates are disconnected - using fallback polling';
  };

  if (variant === 'minimal') {
    return (
      <Box 
        style={{ 
          width: indicatorSize.width, 
          height: indicatorSize.height, 
          borderRadius: '50%', 
          backgroundColor: getStatusColor(),
          opacity: 0.8
        }} 
        title={getStatusTitle()}
      />
    );
  }

  return (
    <Flex align="center" gap="2">
      <Box 
        style={{ 
          width: indicatorSize.width, 
          height: indicatorSize.height, 
          borderRadius: '50%', 
          backgroundColor: getStatusColor(),
          opacity: 0.8
        }} 
        title={getStatusTitle()}
      />
      
      {showText && (
        <Text 
          size="1" 
          color={sseConnected ? "green" : isLoading ? "blue" : "orange"}
          style={{ fontSize: '11px' }}
        >
          {getStatusText()}
        </Text>
      )}
      
      {variant === 'full' && unreadCount > 0 && (
        <Badge 
          color="red" 
          size="1" 
          style={{ 
            minWidth: '16px', 
            height: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 'bold'
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Flex>
  );
}
