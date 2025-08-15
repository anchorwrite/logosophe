'use client';

import { useState, useEffect } from 'react';
import { Heading, Text, Flex, Card, Button, Box, Badge, Avatar, Separator } from '@radix-ui/themes';

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

interface MessageRecipient {
  Email: string;
  Name: string;
  IsRead: boolean;
  ReadAt: string | null;
}

interface MessageThreadProps {
  message: RecentMessage;
  userEmail: string;
  onMarkAsRead: (messageId: number) => void;
}

export function MessageThread({
  message,
  userEmail,
  onMarkAsRead
}: MessageThreadProps) {
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canRecall, setCanRecall] = useState(false);

  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        const response = await fetch(`/api/dashboard/messaging/messages/${message.Id}/recipients`);
        if (response.ok) {
          const data = await response.json() as { recipients: MessageRecipient[] };
          setRecipients(data.recipients || []);
        }
      } catch (error) {
        console.error('Error fetching recipients:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipients();

    // Check if message can be recalled
    const messageDate = new Date(message.CreatedAt);
    const now = new Date();
    const timeDiff = (now.getTime() - messageDate.getTime()) / 1000; // seconds
    setCanRecall(timeDiff < 300); // 5 minutes recall window
  }, [message.Id, message.CreatedAt]);

  useEffect(() => {
    // Mark message as read if user is a recipient and message is unread
    if (!message.IsRead && message.SenderEmail !== userEmail) {
      onMarkAsRead(message.Id);
    }
  }, [message.Id, message.IsRead, message.SenderEmail, userEmail, onMarkAsRead]);

  const handleRecall = async () => {
    if (!canRecall) return;

    try {
                      const response = await fetch(`/api/dashboard/messaging/messages/${message.Id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'recall' }),
        });

      if (response.ok) {
        // Update UI to show recalled status
        // This would typically trigger a WebSocket update
        console.log('Message recalled successfully');
      }
    } catch (error) {
      console.error('Error recalling message:', error);
    }
  };

  const isSender = message.SenderEmail === userEmail;
  const readCount = recipients.filter(r => r.IsRead).length;
  const totalRecipients = recipients.length;

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Message Header */}
      <Box style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-6)' }}>
        <Flex justify="between" align="start" style={{ marginBottom: '1rem' }}>
          <Box style={{ flex: '1' }}>
            <Heading size="4" style={{ marginBottom: '0.5rem' }}>
              {message.Subject}
            </Heading>
            <Flex align="center" gap="2" style={{ marginBottom: '0.5rem' }}>
              <Text size="2" weight="medium">
                From: {message.SenderName ? `${message.SenderName} (${message.SenderEmail})` : message.SenderEmail}
              </Text>
              <Badge variant="soft">{message.MessageType}</Badge>
              {message.RecipientCount > 1 && (
                <Badge size="1" variant="soft">
                  {message.RecipientCount} recipients
                </Badge>
              )}
            </Flex>
            <Text size="1" color="gray">
              {new Date(message.CreatedAt).toLocaleString()}
            </Text>
          </Box>
          <Flex gap="2">
            {isSender && canRecall && (
              <Button size="1" variant="soft" color="red" onClick={handleRecall}>
                Recall
              </Button>
            )}
            <Button size="1" variant="soft">
              Reply
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* Message Body */}
      <Box style={{ flex: '1', padding: '1.5rem', overflow: 'auto' }}>
        <Card style={{ marginBottom: '1.5rem' }}>
          <Box style={{ padding: '1rem' }}>
            <Text style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {message.Body}
            </Text>
          </Box>
        </Card>

        {/* Recipients Section */}
        <Box>
          <Heading size="3" style={{ marginBottom: '1rem' }}>
            Recipients ({readCount}/{totalRecipients} read)
          </Heading>
          
          {isLoading ? (
            <Text color="gray">Loading recipients...</Text>
          ) : recipients.length === 0 ? (
            <Text color="gray">No recipients found</Text>
          ) : (
            <Flex direction="column" gap="2">
              {recipients.map((recipient) => (
                <Flex key={recipient.Email} justify="between" align="center" style={{
                  padding: '0.5rem',
                  border: '1px solid var(--gray-6)',
                  borderRadius: '4px'
                }}>
                  <Box>
                    <Text size="2" weight="medium">
                      {recipient.Name ? `${recipient.Name} (${recipient.Email})` : recipient.Email}
                    </Text>
                  </Box>
                  <Flex align="center" gap="2">
                    {recipient.IsRead ? (
                      <Badge size="1" color="green">
                        Read {recipient.ReadAt ? new Date(recipient.ReadAt).toLocaleString() : ''}
                      </Badge>
                    ) : (
                      <Badge size="1" color="gray">Unread</Badge>
                    )}
                  </Flex>
                </Flex>
              ))}
            </Flex>
          )}
        </Box>
      </Box>

      {/* Message Actions */}
      <Box style={{ padding: '1.5rem', borderTop: '1px solid var(--gray-6)' }}>
        <Flex gap="2" justify="between" align="center">
          <Text size="1" color="gray">
            Message ID: {message.Id} • 
            {isSender ? 'You sent this message' : 'You received this message'}
          </Text>
          <Flex gap="2">
            <Button size="1" variant="soft">
              Forward
            </Button>
            <Button size="1" variant="soft">
              Archive
            </Button>
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
} 