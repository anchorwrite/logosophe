"use client";

import { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, Button, Card, Badge, Dialog } from '@radix-ui/themes';
import TextArea from '@/common/TextArea';
import { MessageAttachments } from '../../../components/harbor/messaging/MessageAttachments';
import { useTranslation } from 'react-i18next';
import { MessageAttachment } from '@/types/messaging';

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
  attachments?: MessageAttachment[];
  links?: any[];
}

interface MessageThreadProps {
  message: RecentMessage;
  userEmail: string;
  tenantId: string;
  onClose: () => void;
  onMessageUpdate: (message: RecentMessage) => void;
}

export function MessageThread({ message, userEmail, tenantId, onClose, onMessageUpdate }: MessageThreadProps) {
  const { t } = useTranslation('translations');
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Array<{ Email: string; Name?: string }>>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(true);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

  // Debug logging
  console.log('MessageThread received message:', message);
  console.log('Message ID:', message?.Id);
  console.log('Message type:', typeof message?.Id);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Fetch recipients for this message
  useEffect(() => {
    if (!message?.Id) {
      console.error('Message ID is undefined, cannot fetch recipients');
      return;
    }

    const fetchRecipients = async () => {
      try {
        const response = await fetch(`/api/messaging/messages/${message.Id}/recipients`);
        if (response.ok) {
          const data = await response.json() as { recipients: Array<{ Email: string; Name?: string }> };
          setRecipients(data.recipients || []);
        } else {
          const errorData = await response.json();
          console.error('API error:', errorData);
        }
      } catch (error) {
        console.error('Error fetching recipients:', error);
      } finally {
        setIsLoadingRecipients(false);
      }
    };

    fetchRecipients();
  }, [message.Id]);

  // Fetch attachments for this message
  useEffect(() => {
    if (!message?.Id) {
      console.error('Message ID is undefined, cannot fetch attachments');
      return;
    }

    console.log('MessageThread processing message:', message);
    console.log('Message HasAttachments:', message.HasAttachments);
    console.log('Message AttachmentCount:', message.AttachmentCount);
    console.log('Message attachments array:', message.attachments);

    // If attachments are already included in the message, use them
    if (message.attachments && message.attachments.length > 0) {
      console.log('Using attachments from message object:', message.attachments);
      setAttachments(message.attachments);
      setIsLoadingAttachments(false);
      return;
    }

    // Fallback to fetching attachments if they're not included
    if (message.HasAttachments && message.AttachmentCount && message.AttachmentCount > 0) {
      console.log('Fetching attachments via API...');
      const fetchAttachments = async () => {
        setIsLoadingAttachments(true);
        try {
          const response = await fetch(`/api/messaging/attachments/message/${message.Id}?tenantId=${tenantId}`);
          if (response.ok) {
            const data = await response.json() as { attachments: MessageAttachment[] };
            console.log('API response for attachments:', data);
            setAttachments(data.attachments || []);
          } else {
            const errorData = await response.json();
            console.error('API error fetching attachments:', errorData);
          }
        } catch (summary) {
          console.error('Error fetching attachments:', summary);
        } finally {
          setIsLoadingAttachments(false);
        }
      };

      fetchAttachments();
    } else {
      console.log('No attachments to fetch');
      setIsLoadingAttachments(false);
    }
  }, [message.Id, message.HasAttachments, message.AttachmentCount, message.attachments]);

  const handleReply = async () => {
    if (!replyBody.trim()) {
      setError(t('messaging.fillAllFields'));
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
          subject: `Re: ${message.Subject}`,
          body: replyBody,
          recipients: [message.SenderEmail],
          messageType: 'subscriber',
          tenantId: tenantId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || t('messaging.sendError'));
      }

      const result = await response.json() as { messageId: number };
      
      // Update the original message to mark as read
      const updatedMessage = { ...message, IsRead: true };
      onMessageUpdate(updatedMessage);

      // Reset reply form
      setReplyBody('');
      setIsReplying(false);
      setSuccess(t('messaging.replySent'));
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messaging.sendError'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog.Root open={true} onOpenChange={() => onClose()}>
      <Dialog.Content size="4" style={{ maxWidth: '800px', maxHeight: '80vh' }}>
        <Dialog.Title>
          <Flex justify="between" align="center">
            <Text size="4" weight="bold">{message.Subject}</Text>
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </Flex>
        </Dialog.Title>

        <Box style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <Flex direction="column" gap="4">
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

            {/* Message Details */}
            <Card size="3">
              <Flex direction="column" gap="3">
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

                <Box>
                  <Text size="2" color="gray" mb="2">{t('messaging.from')}</Text>
                  <Text size="3">{message.SenderEmail}</Text>
                </Box>

                <Box>
                  <Text size="2" color="gray" mb="2">{t('messaging.to')}</Text>
                  {isLoadingRecipients ? (
                    <Text size="3" color="gray">Loading recipients...</Text>
                  ) : recipients.length > 0 ? (
                    <Text size="3">
                      {recipients.map((recipient, index) => (
                        <span key={recipient.Email}>
                          {recipient.Name || recipient.Email}
                          {index < recipients.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </Text>
                  ) : (
                    <Text size="3" color="gray">No recipients found</Text>
                  )}
                </Box>

                <Box>
                  <Text size="2" color="gray" mb="2">{t('messaging.message')}</Text>
                  <Card size="2" style={{ backgroundColor: 'var(--gray-2)' }}>
                    <Text size="3" style={{ whiteSpace: 'pre-wrap' }}>
                      {message.Body}
                    </Text>
                  </Card>
                </Box>

                {/* Attachments Section */}
                {message.HasAttachments && message.AttachmentCount && message.AttachmentCount > 0 && (
                  <Box>
                    <Text size="2" color="gray" mb="2">{t('messaging.attachments')}</Text>
                    {isLoadingAttachments ? (
                      <Text size="3" color="gray">Loading attachments...</Text>
                    ) : attachments.length > 0 ? (
                      <MessageAttachments 
                        attachments={attachments}
                        messageId={message.Id}
                        canDelete={false}
                      />
                    ) : (
                      <Text size="3" color="gray">No attachments found</Text>
                    )}
                  </Box>
                )}

                <Flex gap="2" align="center">
                  <Text size="1" color="gray">
                    {t('messaging.messageType')}: {message.MessageType}
                  </Text>
                  <Text size="1" color="gray">
                    • {recipients.length} {t('messaging.recipients')}
                  </Text>
                </Flex>
              </Flex>
            </Card>

            {/* Reply Section */}
            {message.SenderEmail !== userEmail && (
              <Card size="3">
                <Flex direction="column" gap="3">
                  <Heading size="3">{t('messaging.reply')}</Heading>
                  
                  {!isReplying ? (
                    <Button 
                      variant="soft" 
                      onClick={() => setIsReplying(true)}
                    >
                      {t('messaging.replyToMessage')}
                    </Button>
                  ) : (
                    <Flex direction="column" gap="3">
                      {/* Recipients Field */}
                      <Box>
                        <Text size="2" weight="bold" mb="2">{t('messaging.to')}</Text>
                        <Text size="3" color="gray">
                          {message.SenderEmail}
                        </Text>
                      </Box>

                      <Box>
                        <Text size="2" weight="bold" mb="2">{t('messaging.replyMessage')}</Text>
                        <TextArea
                          name="replyBody"
                          value={replyBody}
                          onChange={(e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => setReplyBody(e.target.value)}
                          placeholder={t('messaging.replyPlaceholder')}
                        />
                      </Box>

                      <Flex gap="3" justify="end">
                        <Button 
                          variant="soft" 
                          onClick={() => {
                            setIsReplying(false);
                            setReplyBody('');
                          }}
                          disabled={isSending}
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button 
                          onClick={handleReply}
                          disabled={isSending || !replyBody.trim()}
                        >
                          {isSending ? t('messaging.sending') : t('messaging.sendReply')}
                        </Button>
                      </Flex>
                    </Flex>
                  )}
                </Flex>
              </Card>
            )}
          </Flex>
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  );
} 