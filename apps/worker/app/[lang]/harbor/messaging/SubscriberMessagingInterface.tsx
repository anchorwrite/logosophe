"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Flex, Heading, Text, Button, Card, Badge, TextField, Select, Dialog } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { MessageThread } from './MessageThread';
import TextArea from '@/common/TextArea';
import { FileAttachmentManager } from '../../../components/harbor/messaging/FileAttachmentManager';
import { UnifiedMessageComposer } from '../../../components/harbor/messaging/UnifiedMessageComposer';
import { MessageAttachments } from '../../../components/harbor/messaging/MessageAttachments';
import { CreateAttachmentRequest, SSEEvent, SSEMessageNew, SSEMessageRead, SSEMessageDelete, SSEMessageUpdate, SSEAttachmentAdded, SSEAttachmentRemoved, SSELinkAdded, SSELinkRemoved } from '@/types/messaging';
import type { Locale } from '@/types/i18n';
import { useMessaging } from '@/contexts/MessagingContext';

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
  attachments?: any[];
  links?: any[];
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
  TenantName: string;
  RoleId: string;
  IsOnline: boolean;
  IsBlocked: boolean;
  BlockerEmail?: string;
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
  userTenants: { TenantId: string; TenantName: string; UserRoles: string[] }[];
  recentMessages: RecentMessage[];
  userStats: UserStats;
  recipients: Recipient[];
  roles: { TenantId: string; RoleId: string; UserCount: number }[];
  systemSettings: SystemSettings;
  lang: string;
}

export function SubscriberMessagingInterface({
  userEmail,
  userName,
  userTenantId,
  userTenantName,
  userTenants,
  recentMessages,
  userStats,
  recipients,
  roles,
  systemSettings,
  lang
}: SubscriberMessagingInterfaceProps) {
  const { t } = useTranslation('translations');
  const { unreadCount } = useMessaging();
  const router = useRouter();
  const [selectedMessage, setSelectedMessage] = useState<RecentMessage | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<CreateAttachmentRequest[]>([]);
  const [isSending, setIsSending] = useState(false);
  // Deduplicate initial messages to prevent React key conflicts
  const deduplicatedMessages = recentMessages.filter((message, index, self) => 
    index === self.findIndex(m => m.Id === message.Id)
  );
  
  // Log if there were duplicates in the initial load
  if (deduplicatedMessages.length !== recentMessages.length) {
    console.warn('Duplicate messages found in initial load:', {
      original: recentMessages.length,
      deduplicated: deduplicatedMessages.length,
      duplicates: recentMessages.length - deduplicatedMessages.length
    });
  }
  
  const [messages, setMessages] = useState<RecentMessage[]>(deduplicatedMessages);
  const [stats, setStats] = useState<UserStats>(userStats);

  // Poll for new messages periodically to ensure real-time updates
  useEffect(() => {
    const pollForNewMessages = async () => {
      try {
        // Fetch recent messages to check for updates
        const response = await fetch(`/api/harbor/messaging/get?tenantId=${userTenantId}&limit=50`);
        if (response.ok) {
          const data = await response.json() as { success: boolean; messages?: RecentMessage[] };
          if (data.success && data.messages) {
            // Only update messages if there are actual changes
            setMessages(prev => {
              const newMessages = data.messages!.filter((newMsg: RecentMessage) => 
                !prev.some(existingMsg => existingMsg.Id === newMsg.Id)
              );
              
              // Check if existing messages need updates (e.g., new attachments)
              let hasUpdates = false;
              const updatedMessages = prev.map(existingMsg => {
                const updatedMsg = data.messages!.find(newMsg => newMsg.Id === existingMsg.Id);
                if (updatedMsg) {
                  // Check if there are actual changes (new attachments, etc.)
                  const hasAttachmentChanges = updatedMsg.attachments && 
                    (!existingMsg.attachments || 
                     JSON.stringify(updatedMsg.attachments) !== JSON.stringify(existingMsg.attachments));
                  
                  if (hasAttachmentChanges) {
                    hasUpdates = true;
                  }
                  
                  // Merge the data, keeping existing properties but updating with new ones
                  return { ...existingMsg, ...updatedMsg };
                }
                return existingMsg;
              });
              
              if (newMessages.length > 0) {
                return [...newMessages, ...updatedMessages];
              }
              
              // Only return updated messages if there are actual changes
              if (hasUpdates) {
                return updatedMessages;
              }
              
              // No changes, return the same array reference to prevent re-renders
              return prev;
            });
          }
        }
      } catch (error) {
        console.error('Error polling for new messages:', error);
      }
    };

    // Poll every 30 seconds for new messages (reduced frequency to prevent excessive re-renders)
    const pollInterval = setInterval(pollForNewMessages, 30000);
    
    // Initial poll
    pollForNewMessages();
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [userTenantId]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { sseConnected } = useMessaging();
  const lastUnreadCountRef = useRef<number>(userStats.unreadMessages);

  // Removed auto-scroll behavior to prevent page jumping

  // SSE connection is now handled by the shared MessagingContext

  // Handle SSE events
  const handleSSEEvent = (event: SSEEvent) => {
    try {
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
          // Connection status is now handled by the shared MessagingContext
          break;
        case 'unread:update':
          handleUnreadUpdate(event.data);
          break;
        default:
          console.log('Unhandled SSE event type:', (event as any).type);
      }
    } catch (error) {
      console.error('Error handling SSE event:', error, event);
      // Don't set error state for SSE event handling failures to avoid disrupting the UI
    }
  };

  // Handle unread count update
  const handleUnreadUpdate = (data: { count: number; timestamp: string }) => {
    try {
      // Debounce unread count updates to prevent rapid re-renders
      if (lastUnreadCountRef.current === data.count) {
        return;
      }
      
      lastUnreadCountRef.current = data.count;
      
      setStats(prev => {
        // Only update if the count actually changed
        if (prev.unreadMessages === data.count) {
          return prev;
        }
        return {
          ...prev,
          unreadMessages: data.count
        };
      });
    } catch (error) {
      console.error('Error handling unread update:', error);
    }
  };

    // Handle new message event
  const handleNewMessage = (data: SSEMessageNew['data']) => {
    try {
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
          MessageType: 'direct',
          RecipientCount: data.recipients.length,
          HasAttachments: data.hasAttachments,
          AttachmentCount: data.attachmentCount
        };

        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const messageExists = prev.some(msg => msg.Id === data.messageId);
          if (messageExists) {
            return prev;
          }
          return [newMessage, ...prev];
        });
        
        setStats(prev => ({
          ...prev,
          totalMessages: prev.totalMessages + 1,
          unreadMessages: prev.unreadMessages + 1
        }));

        // Show notification
        setSuccess(t('messaging.newMessageReceived'));
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (error) {
      console.error('Error handling new message event:', error, data);
    }
  };

  // Handle message read event
  const handleMessageRead = (data: SSEMessageRead['data']) => {
    try {
      if (data.readBy === userEmail) {
        setMessages(prev => {
          const messageIndex = prev.findIndex(msg => msg.Id === data.messageId);
          if (messageIndex === -1 || prev[messageIndex].IsRead) {
            return prev; // Message not found or already read
          }
          
          const newMessages = [...prev];
          newMessages[messageIndex] = { ...newMessages[messageIndex], IsRead: true };
          return newMessages;
        });
        
        setStats(prev => {
          if (prev.unreadMessages <= 0) {
            return prev;
          }
          return {
            ...prev,
            unreadMessages: prev.unreadMessages - 1
          };
        });
      }
    } catch (error) {
      console.error('Error handling message read event:', error, data);
    }
  };

  // Handle message delete event
  const handleMessageDelete = (data: SSEMessageDelete['data']) => {
    try {
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
    } catch (error) {
      console.error('Error handling message delete event:', error, data);
    }
  };

  // Handle message update event
  const handleMessageUpdate = (data: SSEMessageUpdate['data']) => {
    try {
      setMessages(prev => prev.map(msg => 
        msg.Id === data.messageId 
          ? { ...msg, ...data.changes }
          : msg
      ));
    } catch (error) {
      console.error('Error handling message update event:', error, data);
    }
  };

  // Handle attachment added event
  const handleAttachmentAdded = (data: SSEAttachmentAdded['data']) => {
    try {
      // Update message to reflect new attachment
      setMessages(prevMessages => {
        const messageIndex = prevMessages.findIndex(msg => msg.Id === data.messageId);
        if (messageIndex === -1) {
          return prevMessages;
        }
        
        const message = prevMessages[messageIndex];
        const newAttachmentCount = (message.AttachmentCount || 0) + 1;
        
        // Only update if the attachment count actually changed
        if (message.HasAttachments && message.AttachmentCount === newAttachmentCount) {
          return prevMessages;
        }
        
        const newMessages = [...prevMessages];
        newMessages[messageIndex] = {
          ...message,
          HasAttachments: true,
          AttachmentCount: newAttachmentCount
        };
        return newMessages;
      });
    } catch (error) {
      console.error('Error handling attachment added event:', error, data);
    }
  };

  // Handle attachment removed event
  const handleAttachmentRemoved = (data: SSEAttachmentRemoved['data']) => {
    try {
      // Update message to reflect removed attachment
      setMessages(prevMessages => {
        const messageIndex = prevMessages.findIndex(msg => msg.Id === data.messageId);
        if (messageIndex === -1) {
          return prevMessages;
        }
        
        const message = prevMessages[messageIndex];
        const newAttachmentCount = Math.max(0, (message.AttachmentCount || 0) - 1);
        const newHasAttachments = newAttachmentCount > 0;
        
        // Only update if the attachment count actually changed
        if (message.AttachmentCount === newAttachmentCount && message.HasAttachments === newHasAttachments) {
          return prevMessages;
        }
        
        const newMessages = [...prevMessages];
        newMessages[messageIndex] = {
          ...message,
          AttachmentCount: newAttachmentCount,
          HasAttachments: newHasAttachments
        };
        return newMessages;
      });
    } catch (error) {
      console.error('Error handling attachment removed event:', error, data);
    }
  };

  // Handle link added event
  const handleLinkAdded = (data: SSELinkAdded['data']) => {
    try {
      // Handle link added event - could update UI to show link previews
      console.log('Link added to message:', data);
      // TODO: Update message to reflect new link count
    } catch (error) {
      console.error('Error handling link added event:', error, data);
    }
  };

  // Handle link removed event
  const handleLinkRemoved = (data: SSELinkRemoved['data']) => {
    try {
      // Handle link removed event
      console.log('Link removed from message:', data);
      // TODO: Update message to reflect removed link count
    } catch (error) {
      console.error('Error handling link removed event:', error, data);
    }
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
              const response = await fetch('/api/harbor/messaging/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: composeSubject,
          body: composeBody,
          recipients: selectedRecipients,
          messageType: 'direct',
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
        MessageType: 'direct',
        RecipientCount: selectedRecipients.length
      };

      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const messageExists = prev.some(msg => msg.Id === result.messageId);
        if (messageExists) {
          console.log('Message already exists, not adding duplicate');
          return prev;
        }
        return [newMessage, ...prev];
      });
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
              const response = await fetch(`/api/harbor/messaging/mark-read`, {
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

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; messageId: number | null }>({
    isOpen: false,
    messageId: null
  });

  const handleDeleteMessage = async (messageId: number) => {
    setDeleteDialog({ isOpen: true, messageId });
  };

  const confirmDeleteMessage = async () => {
    if (!deleteDialog.messageId) return;

          try {
              const response = await fetch(`/api/harbor/messaging/messages/${deleteDialog.messageId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setMessages(prev => prev.filter(msg => msg.Id !== deleteDialog.messageId));
        setStats(prev => ({
          ...prev,
          totalMessages: Math.max(0, prev.totalMessages - 1),
          sentMessages: prev.sentMessages - (messages.find(m => m.Id === deleteDialog.messageId)?.SenderEmail === userEmail ? 1 : 0)
        }));
        setSuccess(t('messaging.messageDeleted'));
        setTimeout(() => setSuccess(null), 3000);
        setDeleteDialog({ isOpen: false, messageId: null });
      } else {
        const errorData = await response.json() as { error?: string };
        setError(errorData.error || t('messaging.deleteError'));
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      setError(t('messaging.deleteError'));
    } finally {
      setDeleteDialog({ isOpen: false, messageId: null });
    }
  };

  const handleArchiveMessage = async (messageId: number) => {
    try {
              const response = await fetch(`/api/harbor/messaging/messages/${messageId}/archive`, {
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
    // Ensure proper timezone handling by explicitly parsing the date
    let date: Date;
    
    // Handle different date string formats
    if (dateString.includes('T')) {
      // ISO format (e.g., "2025-01-15T10:30:00.000Z")
      date = new Date(dateString);
    } else if (dateString.includes(' ')) {
      // SQLite datetime format (e.g., "2025-01-15 10:30:00")
      // Convert to ISO format for proper timezone handling
      const isoString = dateString.replace(' ', 'T') + '.000Z';
      date = new Date(isoString);
    } else {
      // Fallback
      date = new Date(dateString);
    }
    
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    } else if (diffInHours < 48) {
      return t('messaging.yesterday');
    } else {
      return date.toLocaleDateString([], {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    }
  };

  const availableRecipients = recipients.filter(r => !r.IsBlocked);

  // Memoize the messages list to prevent unnecessary re-renders
  const memoizedMessages = useMemo(() => messages, [messages]);
  
  // Memoize stats to prevent unnecessary re-renders
  const memoizedStats = useMemo(() => stats, [stats]);

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
                {sseConnected ? t('messaging.realTimeConnected') : t('messaging.realTimeDisconnected')}
              </Badge>
              {/* Connection status is now handled by the shared MessagingContext */}
            </Flex>
          </Flex>
          <Text size="3" color="gray">
            {t('messaging.tenantOnly').replace('{tenant}', userTenantName)}
            {sseConnected && (
              <span style={{ color: 'var(--green-9)', marginLeft: '0.5rem' }}>
                {t('messaging.realTimeUpdatesActive')}
              </span>
            )}
          </Text>
        </Box>

        {/* Stats */}
        <Flex key="stats-container" gap="4" wrap="wrap">
          <Card key="total-messages" size="2">
            <Flex key="total-messages-content" direction="column" gap="1">
              <Text size="2" color="gray">{t('messaging.totalMessages')}</Text>
              <Text size="4" weight="bold">{memoizedStats.totalMessages}</Text>
            </Flex>
          </Card>
          <Card key="unread-messages" size="2">
            <Flex key="unread-messages-content" direction="column" gap="1">
              <Text size="2" color="gray">{t('messaging.unreadMessages')}</Text>
              <Text size="4" weight="bold">{memoizedStats.unreadMessages}</Text>
            </Flex>
          </Card>
          <Card key="sent-messages" size="2">
            <Flex key="sent-messages-content" direction="column" gap="1">
              <Text size="2" color="gray">{t('messaging.sentMessages')}</Text>
              <Text size="4" weight="bold">{memoizedStats.sentMessages}</Text>
            </Flex>
          </Card>
          <Card key="active-conversations" size="2">
            <Flex key="active-conversations-content" direction="column" gap="1">
              <Text size="2" color="gray">{t('messaging.activeConversations')}</Text>
              <Text size="4" weight="bold">{memoizedStats.activeConversations}</Text>
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
        {isComposing && userTenantId && (
          <Card size="3">
            <UnifiedMessageComposer
              userTenants={userTenants}
              userEmail={userEmail}
              recipients={recipients}
              roles={roles}
              onSend={async (messageData) => {
                try {
                  const requestBody = {
                    subject: messageData.subject,
                    body: messageData.body,
                    tenants: messageData.tenants,
                    roles: messageData.roles,
                    individualRecipients: messageData.individualRecipients,
                    messageType: 'direct',
                    attachments: messageData.attachments,
                    links: messageData.links
                  };
                  
                  const response = await fetch('/api/harbor/messaging/send', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                  });

                  if (!response.ok) {
                    const errorData = await response.json() as { error?: string };
                    throw new Error(errorData.error || t('messaging.sendError'));
                  }

                  const result = await response.json() as { success: boolean; messageId: number; recipients: string[] };
                  
                  console.log('Message data being sent:', messageData);
                  console.log('Attachments in messageData:', messageData.attachments);
                  
                  // Add the new message to the list
                  const newMessage: RecentMessage = {
                    Id: result.messageId,
                    Subject: messageData.subject,
                    Body: messageData.body,
                    SenderEmail: userEmail,
                    SenderName: userName,
                    CreatedAt: new Date().toISOString(),
                    IsRead: false,
                    MessageType: 'direct',
                    RecipientCount: result.recipients.length,
                    HasAttachments: messageData.attachments.length > 0,
                    AttachmentCount: messageData.attachments.length,
                    attachments: messageData.attachments.map(att => ({
                      Id: att.mediaId || 0,
                      MessageId: result.messageId,
                      AttachmentType: att.attachmentType,
                      FileName: att.fileName || att.file?.name || 'Unknown file',
                      FileSize: att.fileSize || att.file?.size || 0,
                      ContentType: att.contentType || att.file?.type || 'application/octet-stream',
                      CreatedAt: new Date().toISOString(),
                      R2Key: att.r2Key || '', // Use the R2Key from the uploaded file
                      UploadDate: new Date().toISOString()
                    })),
                    links: messageData.links || []
                  };

                  console.log('New message created:', newMessage);
                  console.log('Message ID:', newMessage.Id);
                  console.log('New message attachments:', newMessage.attachments);
                  console.log('New message HasAttachments:', newMessage.HasAttachments);
                  console.log('New message AttachmentCount:', newMessage.AttachmentCount);

                  setMessages(prev => {
                    // Check if message already exists to prevent duplicates
                    const messageExists = prev.some(msg => msg.Id === result.messageId);
                    if (messageExists) {
                      console.log('Message already exists, not adding duplicate');
                      return prev;
                    }
                    return [newMessage, ...prev];
                  });
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
            <Button 
              variant="soft" 
              onClick={() => router.push(`/${lang}/harbor/messaging/blocks`)}
            >
              {t('messaging.blockedUsers')}
            </Button>
          </Flex>
        )}

        {/* Messages List */}
        <Card size="3">
          <Flex direction="column" gap="4">
            <Heading size="4">{t('messaging.recentMessages')}</Heading>
            
            {memoizedMessages.length === 0 ? (
              <Box p="6" style={{ textAlign: 'center' }}>
                <Text size="3" color="gray">{t('messaging.noMessages')}</Text>
              </Box>
            ) : (
              <Flex direction="column" gap="3">
                {memoizedMessages.map((message) => (
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
                    <Flex key={`message-${message.Id}-container`} direction="column" gap="2">
                      <Flex key={`message-${message.Id}-header`} justify="between" align="center">
                        <Flex key={`message-${message.Id}-sender`} gap="2" align="center">
                          <Text weight="bold" size="3">
                            {message.SenderName ? `${message.SenderName} (${message.SenderEmail})` : message.SenderEmail}
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
                      
                      {/* Attachments Indicators */}
                      <Flex key={`message-${message.Id}-indicators`} gap="2" align="center" wrap="wrap">
                        {message.HasAttachments && message.AttachmentCount && message.AttachmentCount > 0 && (
                          <Flex key={`message-${message.Id}-attachments`} gap="1" align="center">
                            <Text size="1" color="blue">
                              📎 {message.AttachmentCount} {message.AttachmentCount === 1 ? t('messaging.attachment') : t('messaging.attachments')}
                            </Text>
                          </Flex>
                        )}
                      </Flex>
                      
                      <Flex key={`message-${message.Id}-footer`} justify="between" align="center">
                        <Text size="1" color="gray">
                          {t('messaging.recipientCount').replace('{count}', message.RecipientCount.toString())}
                        </Text>
                        <Flex key={`message-${message.Id}-actions`} gap="1">
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
            tenantId={userTenantId}
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

        {/* Delete Confirmation Dialog */}
        <Dialog.Root open={deleteDialog.isOpen} onOpenChange={(open) => setDeleteDialog({ isOpen: open, messageId: deleteDialog.messageId })}>
          <Dialog.Content style={{ maxWidth: 500 }}>
            <Dialog.Title>
              <Text weight="bold" color="red">⚠️ {t('messaging.confirmDelete')}</Text>
            </Dialog.Title>
            <Box my="4">
              <Text size="3">
                {t('messaging.confirmDeleteMessage')}
              </Text>
            </Box>
            <Flex gap="3" justify="end">
              <Dialog.Close>
                <Button variant="soft">
                  {t('common.cancel')}
                </Button>
              </Dialog.Close>
              <Button 
                variant="solid" 
                color="red" 
                onClick={confirmDeleteMessage}
              >
                {t('messaging.delete')}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>

      </Flex>
    </Box>
  );
} 