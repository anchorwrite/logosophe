"use client";

import { useState, useEffect, useRef } from 'react';
import { Box, Flex, Heading, Text, Button, Card, Badge, TextField, Select } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { MessageThread } from './MessageThread';
import TextArea from '@/common/TextArea';
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
}

export function SubscriberMessagingInterface({
  userEmail,
  userName,
  userTenantId,
  userTenantName,
  recentMessages,
  userStats,
  recipients,
  systemSettings
}: SubscriberMessagingInterfaceProps) {
  const { t } = useTranslation('translations');
  const [selectedMessage, setSelectedMessage] = useState<RecentMessage | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<RecentMessage[]>(recentMessages);
  const [stats, setStats] = useState<UserStats>(userStats);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!composeSubject.trim() || !composeBody.trim() || selectedRecipients.length === 0) {
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
          messageType: 'subscriber'
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
          <Heading size="6" mb="2">{t('messaging.subscriberMessaging')}</Heading>
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
            <Flex direction="column" gap="4">
              <Heading size="4">{t('messaging.composeMessage')}</Heading>
              
              <Flex direction="column" gap="3">
                <Box>
                  <Text size="2" weight="bold" mb="2">{t('messaging.subject')}</Text>
                  <TextField.Root>
                    <TextField.Input
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder={t('messaging.subjectPlaceholder')}
                      size="3"
                    />
                  </TextField.Root>
                </Box>

                <Box>
                  <Text size="2" weight="bold" mb="2">{t('messaging.recipients')}</Text>
                  
                  {/* Recipient Selection */}
                  <Flex direction="column" gap="2">
                    {/* Recipients List */}
                    <Box style={{ 
                      border: '1px solid var(--gray-6)', 
                      borderRadius: 'var(--radius-3)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      padding: '0.5rem'
                    }}>
                      {availableRecipients.length === 0 ? (
                        <Text size="2" color="gray" align="center" style={{ padding: '0.5rem' }}>
                          {t('messaging.noRecipients')}
                        </Text>
                      ) : (
                        <Flex direction="column" gap="1">
                          {availableRecipients.map((recipient) => (
                            <Flex 
                              key={recipient.Email} 
                              align="center" 
                              gap="2" 
                              p="1"
                              style={{ 
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-2)',
                                backgroundColor: selectedRecipients.includes(recipient.Email) 
                                  ? 'var(--blue-3)' 
                                  : 'transparent'
                              }}
                              onClick={() => {
                                if (selectedRecipients.includes(recipient.Email)) {
                                  setSelectedRecipients(prev => prev.filter(r => r !== recipient.Email));
                                } else {
                                  setSelectedRecipients(prev => [...prev, recipient.Email]);
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedRecipients.includes(recipient.Email)}
                                onChange={() => {}} // Handled by onClick above
                                style={{ margin: 0 }}
                              />
                              <Text size="2">
                                {recipient.Name || recipient.Email}
                              </Text>
                            </Flex>
                          ))}
                        </Flex>
                      )}
                    </Box>
                    
                    {/* Action Buttons */}
                    {availableRecipients.length > 0 && (
                      <Flex gap="2" wrap="wrap">
                        <Button 
                          size="1" 
                          variant="soft"
                          onClick={() => {
                            const allEmails = availableRecipients.map(r => r.Email);
                            setSelectedRecipients(allEmails);
                          }}
                          disabled={selectedRecipients.length === availableRecipients.length}
                        >
                          {t('messaging.selectAll')}
                        </Button>
                        <Button 
                          size="1" 
                          variant="soft"
                          onClick={() => setSelectedRecipients([])}
                          disabled={selectedRecipients.length === 0}
                        >
                          {t('messaging.clearAll')}
                        </Button>
                      </Flex>
                    )}
                  </Flex>
                  
                  <Text size="1" color="gray" mt="1">
                    {t('messaging.recipientLimit').replace('{current}', selectedRecipients.length.toString()).replace('{max}', systemSettings.maxRecipients.toString())}
                  </Text>
                </Box>

                <Box>
                  <Text size="2" weight="bold" mb="2">{t('messaging.message')}</Text>
                  <Box style={{ minHeight: '120px' }}>
                    <TextArea
                      name="messageBody"
                      placeholder={t('messaging.messagePlaceholder')}
                      value={composeBody}
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => setComposeBody(e.target.value)}
                    />
                  </Box>
                </Box>

                <Flex gap="3" justify="end">
                  <Button 
                    variant="soft" 
                    onClick={() => setIsComposing(false)}
                    disabled={isSending}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    onClick={handleSendMessage}
                    disabled={isSending || !composeSubject.trim() || !composeBody.trim() || selectedRecipients.length === 0}
                  >
                    {isSending ? t('messaging.sending') : t('messaging.send')}
                  </Button>
                </Flex>
              </Flex>
            </Flex>
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