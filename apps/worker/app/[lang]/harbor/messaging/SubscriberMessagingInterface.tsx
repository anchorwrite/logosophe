"use client";

import { useState, useEffect, useRef } from 'react';
import { Box, Flex, Heading, Text, Button, Card, Badge, TextField, Select } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { MessageThread } from './MessageThread';
import TextArea from '@/common/TextArea';
import { FileAttachmentManager } from '../../../components/harbor/messaging/FileAttachmentManager';
import { UnifiedMessageComposer } from '../../../components/harbor/messaging/UnifiedMessageComposer';
import { MessageAttachments } from '../../../components/harbor/messaging/MessageAttachments';
import { MessageAttachmentDisplay } from '../../../components/harbor/messaging/MessageAttachmentDisplay';
import { CreateAttachmentRequest, SSEEvent, SSEMessageNew, SSEMessageRead, SSEMessageDelete, SSEMessageUpdate, SSEAttachmentAdded, SSEAttachmentRemoved, SSELinkAdded, SSELinkRemoved } from '@/types/messaging';
import type { Locale } from '@/types/i18n';

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
  HasAttachments?: boolean;
  AttachmentCount?: number;
  HasLinks?: boolean;
  LinkCount?: number;
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

interface SubscriberMessagingInterfaceProps {
  userEmail: string;
  userName: string;
  userTenantId: string;
  userTenantName: string;
  recentMessages: RecentMessage[];
  userStats: UserStats;
  recipients: Recipient[];
  systemSettings: SystemSettings;
  lang: string;
}

export function SubscriberMessagingInterface({
  userEmail,
  userName,
  userTenantId,
  userTenantName,
  recentMessages,
  userStats,
  recipients,
  systemSettings,
  lang
}: SubscriberMessagingInterfaceProps) {
  const { t } = useTranslation('translations');
  const [selectedMessage, setSelectedMessage] = useState<RecentMessage | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<CreateAttachmentRequest[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<RecentMessage[]>(recentMessages);
  const [stats, setStats] = useState<UserStats>(userStats);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // SSE Connection Management
  useEffect(() => {
    if (!userTenantId || !userEmail) {
      return;
    }

    const connectEventSource = async () => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      try {
        // Connect to the SSE stream endpoint
        const sseUrl = `/api/messaging/stream/${userTenantId}`;
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setSseConnected(true);
          console.log('SSE connection established for messaging');
        };

        eventSource.onmessage = (event) => {
          try {
            const sseEvent: SSEEvent = JSON.parse(event.data);
            handleSSEEvent(sseEvent);
          } catch (error) {
            console.error('Error parsing SSE message:', error);
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
            connectEventSource();
          }, 2000);
        };
      } catch (error) {
        console.error('Error creating SSE connection:', error);
        setSseConnected(false);
      }
    };

    // Connect when component mounts
    connectEventSource();

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
  }, [userTenantId, userEmail]);

  // Handle SSE events
  const handleSSEEvent = (event: SSEEvent) => {
    switch (event.type) {
      case 'message:new':
        handleNewMessage(event.data);
        break;
      case 'message:read':
        handleMessageRead(event.data);
        break;
      case 'message:delete':
        handleMessageDelete(event.data);
        break;
      case 'message:update':
        handleMessageUpdate(event.data);
        break;
      case 'message:attachment:added':
        handleAttachmentAdded(event.data);
        break;
      case 'message:attachment:removed':
        handleAttachmentRemoved(event.data);
        break;
      case 'message:link:added':
        handleLinkAdded(event.data);
        break;
      case 'message:link:removed':
        handleLinkRemoved(event.data);
        break;
      case 'connection:established':
        console.log('SSE connection confirmed:', event.data);
        break;
      default:
        console.log('Unhandled SSE event type:', (event as any).type);
    }
  };

  // Handle new message event
  const handleNewMessage = (data: SSEMessageNew['data']) => {
    // Only add if it's not from the current user and the current user is a recipient
    if (data.senderEmail !== userEmail && data.recipients.includes(userEmail)) {
      const newMessage: RecentMessage = {
        Id: data.messageId,
        Subject: data.subject,
        Body: data.body,
        SenderEmail: data.senderEmail,
        SenderName: data.senderEmail, // Will be updated when we fetch the actual message
        CreatedAt: data.timestamp,
        IsRead: false,
        MessageType: 'subscriber',
        RecipientCount: data.recipients.length,
        HasAttachments: data.hasAttachments,
        AttachmentCount: data.attachmentCount
      };

      setMessages(prev => [newMessage, ...prev]);
      setStats(prev => ({
        ...prev,
        totalMessages: prev.totalMessages + 1,
        unreadMessages: prev.unreadMessages + 1
      }));

      // Show notification
      setSuccess(t('messaging.newMessageReceived'));
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  // Handle message read event
  const handleMessageRead = (data: SSEMessageRead['data']) => {
    if (data.readBy === userEmail) {
      setMessages(prev => prev.map(msg => 
        msg.Id === data.messageId 
          ? { ...msg, IsRead: true }
          : msg
      ));
      
      setStats(prev => ({
        ...prev,
        unreadMessages: Math.max(0, prev.unreadMessages - 1)
      }));
    }
  };

  // Handle message delete event
  const handleMessageDelete = (data: SSEMessageDelete['data']) => {
    setMessages(prev => prev.filter(msg => msg.Id !== data.messageId));
    
    // Update stats if needed
    const deletedMessage = messages.find(msg => msg.Id === data.messageId);
    if (deletedMessage) {
      setStats(prev => ({
        ...prev,
        totalMessages: Math.max(0, prev.totalMessages - 1),
        unreadMessages: deletedMessage.IsRead ? prev.unreadMessages : Math.max(0, prev.unreadMessages - 1)
      }));
    }
  };

  // Handle message update event
  const handleMessageUpdate = (data: SSEMessageUpdate['data']) => {
    setMessages(prev => prev.map(msg => 
      msg.Id === data.messageId 
        ? { ...msg, ...data.changes }
        : msg
    ));
  };

  // Handle attachment added event
  const handleAttachmentAdded = (data: SSEAttachmentAdded['data']) => {
    // Update message to reflect new attachment
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.Id === data.messageId 
          ? { 
              ...msg, 
              HasAttachments: true, 
              AttachmentCount: (msg.AttachmentCount || 0) + 1 
            }
          : msg
      )
    );
  };

  // Handle attachment removed event
  const handleAttachmentRemoved = (data: SSEAttachmentRemoved['data']) => {
    // Update message to reflect removed attachment
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.Id === data.messageId 
          ? { 
              ...msg, 
              AttachmentCount: Math.max(0, (msg.AttachmentCount || 0) - 1),
              HasAttachments: (msg.AttachmentCount || 0) > 1
            }
          : msg
      )
    );
  };

  // Handle link added event
  const handleLinkAdded = (data: SSELinkAdded['data']) => {
    // Handle link added event - could update UI to show link previews
    console.log('Link added to message:', data);
  };

  // Handle link removed event
  const handleLinkRemoved = (data: SSELinkRemoved['data']) => {
    // Handle link removed event
    console.log('Link removed from message:', data);
  };

  const handleSendMessage = async () => {
    if (!composeSubject.trim() || (!composeBody.trim() && selectedAttachments.length === 0) || selectedRecipients.length === 0) {
      setError(t('messaging.fillAllFields'));
      return;
    }

    if (selectedRecipients.length > systemSettings.maxRecipients) {
      setError(t('messaging.tooManyRecipients').replace('{max}', systemSettings.maxRecipients.toString()));
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch('/api/messaging/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: composeSubject,
          body: composeBody,
          recipients: selectedRecipients,
          messageType: 'subscriber',
          tenantId: userTenantId,
          attachments: selectedAttachments
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || t('messaging.sendError'));
      }

      const result = await response.json() as { messageId: number };
      
      // Add the new message to the list
      const newMessage: RecentMessage = {
        Id: result.messageId,
        Subject: composeSubject,
        Body: composeBody,
        SenderEmail: userEmail,
        SenderName: userName,
        CreatedAt: new Date().toISOString(),
        IsRead: false,
        MessageType: 'subscriber',
        RecipientCount: selectedRecipients.length
      };

      setMessages([newMessage, ...messages]);
      setStats(prev => ({
        ...prev,
        totalMessages: prev.totalMessages + 1,
        sentMessages: prev.sentMessages + 1
      }));

      // Reset compose form
      setComposeSubject('');
      setComposeBody('');
      setSelectedRecipients([]);
      setSelectedAttachments([]);
      setIsComposing(false);
      setSuccess(t('messaging.messageSent'));
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messaging.sendError'));
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkAsRead = async (messageId: number) => {
    try {
      const response = await fetch(`/api/messaging/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageId }),
      });

      if (response.ok) {
        setMessages(prev => 
          prev.map(msg => 
            msg.Id === messageId ? { ...msg, IsRead: true } : msg
          )
        );
        setStats(prev => ({
          ...prev,
          unreadMessages: Math.max(0, prev.unreadMessages - 1)
        }));
      }
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm(t('messaging.confirmDelete'))) {
      return;
    }

    try {
      const response = await fetch(`/api/messaging/messages/${messageId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setMessages(prev => prev.filter(msg => msg.Id !== messageId));
        setStats(prev => ({
          ...prev,
          totalMessages: Math.max(0, prev.totalMessages - 1),
          sentMessages: prev.sentMessages - (messages.find(m => m.Id === messageId)?.SenderEmail === userEmail ? 1 : 0)
        }));
        setSuccess(t('messaging.messageDeleted'));
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json() as { error?: string };
        setError(errorData.error || t('messaging.deleteError'));
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      setError(t('messaging.deleteError'));
    }
  };

  const handleArchiveMessage = async (messageId: number) => {
    try {
      const response = await fetch(`/api/messaging/messages/${messageId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setMessages(prev => 
          prev.map(msg => 
            msg.Id === messageId ? { ...msg, IsArchived: true } : msg
          )
        );
        setSuccess(t('messaging.messageArchived'));
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json() as { error?: string };
        setError(errorData.error || t('messaging.archiveError'));
      }
    } catch (err) {
      console.error('Error archiving message:', err);
      setError(t('messaging.archiveError'));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) // (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return t('messaging.yesterday');
    } else {
      return date.toLocaleDateString();
    }
  };

  const availableRecipients = recipients.filter(r => !r.IsBlocked);

  return (
    <Box p="6" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Flex direction="column" gap="6">
        {/* Header */}
        <Box>
          <Flex justify="between" align="center" mb="2">
            <Heading size="6">{t('messaging.subscriberMessaging')}</Heading>
            <Flex gap="2" align="center">
              <Badge 
                color={sseConnected ? "green" : "red"} 
                size="2"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem' 
                }}
              >
                <Box 
                  style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: sseConnected ? 'var(--green-9)' : 'var(--red-9)' 
                  }} 
                />
                {sseConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </Flex>
          </Flex>
          <Text size="3" color="gray">
            {t('messaging.tenantOnly').replace('{tenant}', userTenantName)}
          </Text>
        </Box>

        {/* Stats */}
        <Flex gap="4" wrap="wrap">
          <Card key="total-messages" size="2">
            <Flex direction="column" gap="1">
              <Text size="2" color="gray">{t('messaging.totalMessages')}</Text>
              <Text size="4" weight="bold">{stats.totalMessages}</Text>
            </Flex>
          </Card>
          <Card key="unread-messages" size="2">
            <Flex direction="column" gap="1">
              <Text size="2" color="gray">{t('messaging.unreadMessages')}</Text>
              <Text size="4" weight="bold">{stats.unreadMessages}</Text>
            </Flex>
          </Card>
          <Card key="sent-messages" size="2">
            <Flex direction="column" gap="1">
              <Text size="2" color="gray">{t('messaging.sentMessages')}</Text>
              <Text size="4" weight="bold">{stats.sentMessages}</Text>
            </Flex>
          </Card>
          <Card key="active-conversations" size="2">
            <Flex direction="column" gap="1">
              <Text size="2" color="gray">{t('messaging.activeConversations')}</Text>
              <Text size="4" weight="bold">{stats.activeConversations}</Text>
            </Flex>
          </Card>
        </Flex>

        {/* Error/Success Messages */}
        {error && (
          <Card size="2" style={{ backgroundColor: 'var(--red-3)', border: '1px solid var(--red-6)' }}>
            <Text color="red">{error}</Text>
          </Card>
        )}
        {success && (
          <Card size="2" style={{ backgroundColor: 'var(--green-3)', border: '1px solid var(--green-6)' }}>
            <Text color="green">{success}</Text>
          </Card>
        )}

        {/* Compose Message */}
        {isComposing && (
          <Card size="3">
            <UnifiedMessageComposer
              tenantId={userTenantId}
              userEmail={userEmail}
              recipients={recipients.map(r => r.Email)}
              onSend={async (messageData) => {
                try {
                  const response = await fetch('/api/messaging/send', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                                          body: JSON.stringify({
                        subject: messageData.subject,
                        body: messageData.body,
                        recipients: messageData.recipients,
                        messageType: 'subscriber',
                        tenantId: userTenantId,
                        attachments: messageData.attachments,
                        links: messageData.links
                      }),
                  });

                  if (!response.ok) {
                    const errorData = await response.json() as { error?: string };
                    throw new Error(errorData.error || t('messaging.sendError'));
                  }

                  const result = await response.json() as { messageId: number };
                  
                  // Add the new message to the list
                  const newMessage: RecentMessage = {
                    Id: result.messageId,
                    Subject: messageData.subject,
                    Body: messageData.body,
                    SenderEmail: userEmail,
                    SenderName: userName,
                    CreatedAt: new Date().toISOString(),
                    IsRead: false,
                    MessageType: 'subscriber',
                    RecipientCount: messageData.recipients.length,
                    HasAttachments: messageData.attachments.length > 0,
                    AttachmentCount: messageData.attachments.length,
                    HasLinks: messageData.links.length > 0,
                    LinkCount: messageData.links.length
                  };

                  setMessages([newMessage, ...messages]);
                  setStats(prev => ({
                    ...prev,
                    totalMessages: prev.totalMessages + 1,
                    sentMessages: prev.sentMessages + 1
                  }));

                  // Reset compose form
                  setIsComposing(false);
                  setSuccess(t('messaging.messageSent'));
                  setTimeout(() => setSuccess(null), 3000);
                } catch (error) {
                  console.error('Error sending message:', error);
                  setError(error instanceof Error ? error.message : t('messaging.sendError'));
                  setTimeout(() => setError(null), 5000);
                }
              }}
              onCancel={() => setIsComposing(false)}
              isSending={isSending}
              maxRecipients={systemSettings.maxRecipients}
              lang={lang}
            />
          </Card>
        )}

        {/* Action Buttons */}
        {!isComposing && (
          <Flex gap="3">
            <Button onClick={() => setIsComposing(true)}>
              {t('messaging.newMessage')}
            </Button>
          </Flex>
        )}

        {/* Messages List */}
        <Card size="3">
          <Flex direction="column" gap="4">
            <Heading size="4">{t('messaging.recentMessages')}</Heading>
            
            {messages.length === 0 ? (
              <Box p="6" style={{ textAlign: 'center' }}>
                <Text size="3" color="gray">{t('messaging.noMessages')}</Text>
              </Box>
            ) : (
              <Flex direction="column" gap="3">
                {messages.map((message) => (
                  <Card 
                    key={message.Id} 
                    size="2" 
                    style={{ 
                      cursor: 'pointer',
                      backgroundColor: message.IsRead ? 'var(--gray-2)' : 'var(--blue-2)',
                      border: message.IsRead ? '1px solid var(--gray-6)' : '1px solid var(--blue-6)'
                    }}
                    onClick={() => {
                      setSelectedMessage(message);
                      if (!message.IsRead && message.SenderEmail !== userEmail) {
                        handleMarkAsRead(message.Id);
                      }
                    }}
                  >
                    <Flex direction="column" gap="2">
                      <Flex justify="between" align="center">
                        <Flex gap="2" align="center">
                          <Text weight="bold" size="3">
                            {message.SenderName || message.SenderEmail}
                          </Text>
                          {message.SenderEmail === userEmail && (
                            <Badge color="blue" size="1">{t('messaging.sent')}</Badge>
                          )}
                          {!message.IsRead && message.SenderEmail !== userEmail && (
                            <Badge color="red" size="1">{t('messaging.unread')}</Badge>
                          )}
                        </Flex>
                        <Text size="2" color="gray">
                          {formatDate(message.CreatedAt)}
                        </Text>
                      </Flex>
                      
                      <Text weight="bold" size="3">{message.Subject}</Text>
                      <Text size="2" color="gray" style={{ 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {message.Body}
                      </Text>
                      
                      {/* Attachments and Links Indicators */}
                      <Flex gap="2" align="center" wrap="wrap">
                        {message.HasAttachments && message.AttachmentCount && message.AttachmentCount > 0 && (
                          <Flex gap="1" align="center">
                            <Text size="1" color="blue">
                              📎 {message.AttachmentCount} {message.AttachmentCount === 1 ? t('messaging.attachment') : t('messaging.attachments')}
                            </Text>
                          </Flex>
                        )}
                        {message.HasLinks && message.LinkCount && message.LinkCount > 0 && (
                          <Flex gap="1" align="center">
                            <Text size="1" color="green">
                              🔗 {message.LinkCount} {message.LinkCount === 1 ? t('messaging.link') : t('messaging.links')}
                            </Text>
                          </Flex>
                        )}
                      </Flex>
                      
                      <Flex justify="between" align="center">
                        <Text size="1" color="gray">
                          {t('messaging.recipientCount').replace('{count}', message.RecipientCount.toString())}
                        </Text>
                        <Flex gap="1">
                          <Text size="1" color="gray">
                            {message.MessageType}
                          </Text>
                          <Button 
                            size="1" 
                            variant="soft" 
                            color="gray"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveMessage(message.Id);
                            }}
                          >
                            {t('messaging.archive')}
                          </Button>
                          <Button 
                            size="1" 
                            variant="soft" 
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMessage(message.Id);
                            }}
                          >
                            {t('messaging.delete')}
                          </Button>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Card>
                ))}
              </Flex>
            )}
          </Flex>
        </Card>

        {/* Message Thread Modal */}
        {selectedMessage && (
          <MessageThread
            message={selectedMessage}
            userEmail={userEmail}
            onClose={() => setSelectedMessage(null)}
            onMessageUpdate={(updatedMessage) => {
              setMessages(prev => 
                prev.map(msg => 
                  msg.Id === updatedMessage.Id ? updatedMessage : msg
                )
              );
            }}
          />
        )}

        <div ref={messagesEndRef} />
      </Flex>
    </Box>
  );
} 