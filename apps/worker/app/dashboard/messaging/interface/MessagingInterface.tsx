'use client';

import { useState, useEffect } from 'react';
import { Container, Heading, Text, Flex, Card, Button, Box, TextField, Badge, Avatar, Separator } from '@radix-ui/themes';
import { MessageThread } from './MessageThread';
import { MessageComposer } from './MessageComposer';
import { UnifiedMessageComposer } from './UnifiedMessageComposer';
import { useToast } from '@/components/Toast';
import type { RecentMessage, UserStats, Recipient, SystemSettings, Tenant, Role } from './types';

interface MessagingInterfaceProps {
  userEmail: string;
  userName: string;
  recentMessages: RecentMessage[];
  userStats: UserStats;
  recipients: Recipient[];
  tenants: Tenant[];
  roles: Role[];
  accessibleTenants: string[];
  systemSettings: SystemSettings;
}

export function MessagingInterface({
  userEmail,
  userName,
  recentMessages,
  userStats,
  recipients,
  tenants,
  roles,
  accessibleTenants,
  systemSettings
}: MessagingInterfaceProps) {
  const { showToast } = useToast();
  const [selectedMessage, setSelectedMessage] = useState<RecentMessage | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [useRoleBasedMessaging, setUseRoleBasedMessaging] = useState(true); // Default to role-based messaging
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'sent' | 'received'>('all');
  const [messages, setMessages] = useState<RecentMessage[]>(recentMessages);
  const [isOnline, setIsOnline] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastStatusCheck, setLastStatusCheck] = useState<Date | null>(null);
  const [lastMessageRefresh, setLastMessageRefresh] = useState<Date | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<RecentMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<RecentMessage | null>(null);

  // Check system status
  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/dashboard/messaging/status');
      if (response.ok) {
        const statusData = await response.json() as { isOnline: boolean; messagingEnabled: boolean; timestamp: string };
        setIsOnline(statusData.isOnline);
        setLastStatusCheck(new Date());
      } else {
        console.error('Failed to fetch system status:', response.status);
        setIsOnline(false);
      }
    } catch (error) {
      console.error('Error checking system status:', error);
      setIsOnline(false);
    }
  };

  // Refresh message list
  const refreshMessages = async () => {
    try {
      const response = await fetch('/api/dashboard/messaging/messages');
      if (response.ok) {
        const messagesData = await response.json() as { messages: RecentMessage[] };
        setMessages(messagesData.messages);
        setLastMessageRefresh(new Date());
      } else {
        console.error('Failed to fetch messages:', response.status);
      }
    } catch (error) {
      console.error('Error refreshing messages:', error);
    }
  };

  // Check system status on mount and every 60 seconds
  useEffect(() => {
    checkSystemStatus();
    
    const interval = setInterval(checkSystemStatus, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Refresh messages on mount and every 30 seconds
  useEffect(() => {
    refreshMessages();
    
    const interval = setInterval(refreshMessages, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, []);

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
    tenantId?: string | string[];
  }) => {
    setIsSending(true);
    try {
      // Handle multiple tenants by sending to each one separately
      const tenantIds = Array.isArray(messageData.tenantId) ? messageData.tenantId : [messageData.tenantId || accessibleTenants[0]];
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const tenantId of tenantIds) {
        try {
          const response = await fetch('/api/dashboard/messaging/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...messageData,
              tenantId: tenantId
            }),
          });

          if (response.ok) {
            const result = await response.json() as { success: boolean; message?: string; error?: string };
            if (result.success) {
              successCount++;
            } else {
              errorCount++;
              console.error(`Failed to send message to tenant ${tenantId}:`, result.error);
            }
          } else {
            errorCount++;
            const errorData = await response.json().catch(() => ({ error: 'Failed to send message' })) as { error?: string };
            console.error(`Failed to send message to tenant ${tenantId}:`, errorData.error || response.status);
          }
        } catch (error) {
          errorCount++;
          console.error(`Error sending message to tenant ${tenantId}:`, error);
        }
      }

      // Show results and handle success/failure
      if (successCount > 0) {
        if (errorCount > 0) {
          showToast({
            type: 'warning',
            title: 'Partial Success',
            content: `Message sent to ${successCount} tenant(s) successfully. Failed to send to ${errorCount} tenant(s).`
          });
        } else {
          showToast({
            type: 'success',
            title: 'Message Sent',
            content: `Message sent to ${successCount} tenant(s) successfully!`
          });
        }
        // Close composer and refresh page
        setIsComposing(false);
        window.location.reload();
      } else {
        showToast({
          type: 'error',
          title: 'Send Failed',
          content: 'Failed to send message to any tenants. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showToast({
        type: 'error',
        title: 'Send Error',
        content: 'Error sending message. Please try again.'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendRoleBasedMessage = async (messageData: {
    subject: string;
    body: string;
    tenants: string[];
    roles: string[];
    individualRecipients: string[];
    messageType: string;
  }) => {
    setIsSending(true);
    try {
      const response = await fetch('/api/dashboard/messaging/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        const result = await response.json() as { success: boolean; message?: string; error?: string };
        if (result.success) {
          showToast({
            type: 'success',
            title: 'Message Sent',
            content: 'Message sent successfully!'
          });
          // Close composer and refresh page
          setIsComposing(false);
          window.location.reload();
        } else {
          showToast({
            type: 'error',
            title: 'Send Failed',
            content: result.error || 'Failed to send message'
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send message' })) as { error?: string };
        showToast({
          type: 'error',
          title: 'Send Failed',
          content: errorData.error || 'Failed to send message'
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showToast({
        type: 'error',
        title: 'Send Error',
        content: 'Error sending message. Please try again.'
      });
    } finally {
      setIsSending(false);
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
            <Badge 
              variant={isOnline ? 'solid' : 'soft'} 
              color={isOnline ? 'green' : 'red'}
              title={isOnline ? 
                'Messaging system is operational and accessible' : 
                'Messaging system is disabled or experiencing issues'
              }
            >
              {isOnline ? 'System Online' : 'System Offline'}
            </Badge>
            <Button variant="soft" onClick={refreshMessages} title="Refresh message list">
              Refresh
            </Button>
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
            <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
              <Heading size="4">Recent Messages</Heading>
              {lastMessageRefresh && (
                <Text size="1" color="gray">
                  Last updated: {lastMessageRefresh.toLocaleTimeString()}
                </Text>
              )}
            </Flex>
            
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
                <option value="all">All ({messages.length})</option>
                <option value="unread">Unread ({messages.filter(m => !m.IsRead && m.SenderEmail !== userEmail).length})</option>
                <option value="sent">Sent ({messages.filter(m => m.SenderEmail === userEmail).length})</option>
                <option value="received">Received ({messages.filter(m => m.SenderEmail !== userEmail).length})</option>
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
                    borderLeft: !message.IsRead && message.SenderEmail !== userEmail ? '3px solid var(--red-9)' : 'none',
                    cursor: 'pointer',
                    backgroundColor: selectedMessage?.Id === message.Id ? 'var(--gray-3)' : 'transparent',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => {
                    setSelectedMessage(message);
                    // If this is an unread received message, refresh the message list to update read status
                    if (!message.IsRead && message.SenderEmail !== userEmail) {
                      // Refresh messages after a short delay to allow the mark-read API to complete
                      setTimeout(() => refreshMessages(), 500);
                    }
                  }}
                >
                  <Flex justify="between" align="start" style={{ marginBottom: '0.5rem' }}>
                    <Box style={{ flex: '1' }}>
                      <Flex align="center" gap="2" style={{ marginBottom: '0.25rem' }}>
                        <Text weight="medium" size="2">
                          {message.SenderName || message.SenderEmail}
                        </Text>
                        {!message.IsRead && message.SenderEmail !== userEmail && (
                          <Badge size="1" color="red">Unread</Badge>
                        )}
                        {message.MessageType === 'broadcast' && (
                          <Badge size="1" variant="soft">Broadcast</Badge>
                        )}
                        {message.MessageType === 'announcement' && (
                          <Badge size="1" variant="soft">Announcement</Badge>
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
            <>
              {/* Composer Type Toggle */}
              <Box style={{ 
                padding: '1rem', 
                borderBottom: '1px solid var(--gray-6)',
                backgroundColor: 'var(--gray-2)'
              }}>
                <Flex gap="2" align="center">
                  <Text size="2" weight="medium">Composer Type:</Text>
                  <Button 
                    size="1" 
                    variant={useRoleBasedMessaging ? 'solid' : 'soft'}
                    onClick={() => setUseRoleBasedMessaging(true)}
                  >
                    Role-Based Messaging
                  </Button>
                  <Button 
                    size="1" 
                    variant={!useRoleBasedMessaging ? 'solid' : 'soft'}
                    onClick={() => setUseRoleBasedMessaging(false)}
                  >
                    Simple Messaging
                  </Button>
                </Flex>
              </Box>
              
              {useRoleBasedMessaging ? (
                <UnifiedMessageComposer
                  tenants={tenants}
                  roles={roles}
                  recipients={recipients}
                  userEmail={userEmail}
                  onSend={handleSendRoleBasedMessage}
                  onCancel={() => {
                    setIsComposing(false);
                    setReplyToMessage(null);
                    setForwardMessage(null);
                  }}
                  systemSettings={systemSettings}
                  replyToMessage={replyToMessage || undefined}
                  forwardMessage={forwardMessage || undefined}
                />
              ) : (
                <MessageComposer
                  recipients={recipients}
                  accessibleTenants={accessibleTenants}
                  userEmail={userEmail}
                  onSend={handleSendMessage}
                  onCancel={() => {
                    setIsComposing(false);
                    setReplyToMessage(null);
                    setForwardMessage(null);
                  }}
                  systemSettings={systemSettings}
                  replyToMessage={replyToMessage || undefined}
                  forwardMessage={forwardMessage || undefined}
                  hideTenantSelection={!!replyToMessage}
                />
              )}
            </>
          ) : selectedMessage ? (
            <MessageThread
              message={selectedMessage}
              userEmail={userEmail}
              onReply={(message) => {
                // Switch to compose mode with reply data
                setReplyToMessage(message);
                setForwardMessage(null);
                setIsComposing(true);
              }}
              onForward={(message) => {
                // Switch to compose mode with forward data
                setForwardMessage(message);
                setReplyToMessage(null);
                setIsComposing(true);
              }}
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