'use client';

import { useState, useEffect } from 'react';
import { Container, Heading, Text, Flex, Card, Button, Box, TextField, Badge, Avatar, Separator } from '@radix-ui/themes';
import { MessageThread } from './MessageThread';
import { MessageComposer } from './MessageComposer';

interface RecentMessage {
  Id: number;
  Subject: string;
  Body: string;
  SenderEmail: string;
  SenderName: string;
  CreatedAt: string;
  IsRead: boolean;
  MessageType: string;
  RecipientCount: number;
}

interface UserStats {
  totalMessages: number;
  unreadMessages: number;
  sentMessages: number;
  activeConversations: number;
}

interface Recipient {
  Email: string;
  Name: string;
  TenantId: string;
  RoleId: string;
  IsOnline: boolean;
  IsBlocked: boolean;
}

interface SystemSettings {
  messagingEnabled: boolean;
  rateLimitSeconds: number;
  maxRecipients: number;
  recallWindowSeconds: number;
  messageExpiryDays: number;
}

interface MessagingInterfaceProps {
  userEmail: string;
  userName: string;
  recentMessages: RecentMessage[];
  userStats: UserStats;
  recipients: Recipient[];
  accessibleTenants: string[];
  systemSettings: SystemSettings;
}

export function MessagingInterface({
  userEmail,
  userName,
  recentMessages,
  userStats,
  recipients,
  accessibleTenants,
  systemSettings
}: MessagingInterfaceProps) {
  const [selectedMessage, setSelectedMessage] = useState<RecentMessage | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'sent' | 'received'>('all');
  const [messages, setMessages] = useState<RecentMessage[]>(recentMessages);
  const [isOnline, setIsOnline] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Filter messages based on search and filter
  const filteredMessages = messages.filter(message => {
    const matchesSearch = searchTerm === '' || 
      message.Subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.Body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.SenderName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' ||
      (filterType === 'unread' && !message.IsRead) ||
      (filterType === 'sent' && message.SenderEmail === userEmail) ||
      (filterType === 'received' && message.SenderEmail !== userEmail);
    
    return matchesSearch && matchesFilter;
  });



  const handleSendMessage = async (messageData: {
    subject: string;
    body: string;
    recipients: string[];
    messageType: string;
    tenantId?: string;
  }) => {
    setIsSending(true);
    try {
      const response = await fetch('/api/dashboard/messaging/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...messageData,
          tenantId: messageData.tenantId || accessibleTenants[0]
        }),
      });

      if (response.ok) {
        const result = await response.json() as { success: boolean; message?: string; error?: string };
        if (result.success) {
          // Show success message and close composer
          setIsComposing(false);
          // Optionally refresh the page to show the new message
          window.location.reload();
        } else {
          console.error('Failed to send message:', result.error);
          alert(`Failed to send message: ${result.error}`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send message' })) as { error?: string };
        console.error('Failed to send message:', errorData.error || response.status);
        alert(`Failed to send message: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkAsRead = async (messageId: number) => {
    try {
      const response = await fetch(`/api/dashboard/messaging/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'mark-read' }),
      });

      if (response.ok) {
        setMessages(prev => prev.map(msg => 
          msg.Id === messageId ? { ...msg, IsRead: true } : msg
        ));
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  return (
    <Container size="4">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              Messaging
            </Heading>
            <Text color="gray" size="3">
              Admin messaging interface for system management
            </Text>
          </Box>
          <Flex gap="2" align="center">
            <Badge variant={isOnline ? 'solid' : 'soft'} color={isOnline ? 'green' : 'gray'}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            <Button onClick={() => setIsComposing(true)}>
              Compose Message
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* User Statistics */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Flex gap="4" wrap="wrap">
            <Box style={{ flex: '1', minWidth: '150px' }}>
              <Text size="2" color="gray">Total Messages</Text>
              <Heading size="3">{userStats.totalMessages}</Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '150px' }}>
              <Text size="2" color="gray">Unread</Text>
              <Heading size="3" color="red">{userStats.unreadMessages}</Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '150px' }}>
              <Text size="2" color="gray">Sent</Text>
              <Heading size="3">{userStats.sentMessages}</Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '150px' }}>
              <Text size="2" color="gray">Conversations</Text>
              <Heading size="3">{userStats.activeConversations}</Heading>
            </Box>
          </Flex>
        </Box>
      </Card>

      <Flex gap="4" style={{ height: '600px' }}>
        {/* Message List */}
        <Card style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
          <Box style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-6)' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>
              Recent Messages
            </Heading>
            
            {/* Search and Filters */}
            <Flex gap="2" style={{ marginBottom: '1rem' }}>
              <TextField.Root style={{ flex: '1' }}>
                <TextField.Input 
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </TextField.Root>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid var(--gray-6)',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="sent">Sent</option>
                <option value="received">Received</option>
              </select>
            </Flex>
          </Box>

          {/* Message List */}
          <Box style={{ flex: '1', overflow: 'auto', padding: '0' }}>
            {filteredMessages.length === 0 ? (
              <Box style={{ textAlign: 'center', padding: '2rem' }}>
                <Text color="gray">No recent messages found</Text>
              </Box>
            ) : (
              filteredMessages.map((message) => (
                <Box
                  key={message.Id}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--gray-6)',
                    cursor: 'pointer',
                    backgroundColor: selectedMessage?.Id === message.Id ? 'var(--gray-3)' : 'transparent',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => setSelectedMessage(message)}
                >
                  <Flex justify="between" align="start" style={{ marginBottom: '0.5rem' }}>
                    <Box style={{ flex: '1' }}>
                      <Flex align="center" gap="2" style={{ marginBottom: '0.25rem' }}>
                        <Text weight="medium" size="2">
                          {message.SenderName || message.SenderEmail}
                        </Text>
                        {!message.IsRead && message.SenderEmail !== userEmail && (
                          <Badge size="1" color="red">New</Badge>
                        )}
                        {message.MessageType === 'broadcast' && (
                          <Badge size="1" variant="soft">Broadcast</Badge>
                        )}
                      </Flex>
                      <Text weight="medium" size="3" style={{ marginBottom: '0.25rem' }}>
                        {message.Subject}
                      </Text>
                      <Text size="2" color="gray" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {message.Body}
                      </Text>
                    </Box>
                    <Text size="1" color="gray">
                      {new Date(message.CreatedAt).toLocaleDateString()}
                    </Text>
                  </Flex>
                  {message.RecipientCount > 1 && (
                    <Text size="1" color="gray">
                      {message.RecipientCount} recipients
                    </Text>
                  )}
                </Box>
              ))
            )}
          </Box>
        </Card>

        {/* Message Thread or Composer */}
        <Card style={{ flex: '2', display: 'flex', flexDirection: 'column' }}>
          {isComposing ? (
            <MessageComposer
              recipients={recipients}
              accessibleTenants={accessibleTenants}
              onSend={handleSendMessage}
              onCancel={() => setIsComposing(false)}
              systemSettings={systemSettings}
            />
          ) : selectedMessage ? (
            <MessageThread
              message={selectedMessage}
              userEmail={userEmail}
              onMarkAsRead={handleMarkAsRead}
            />
          ) : (
            <Box style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              color: 'var(--gray-9)'
            }}>
              <Text>Select a message to view details or compose a new message</Text>
            </Box>
          )}
        </Card>
      </Flex>
    </Container>
  );
} 