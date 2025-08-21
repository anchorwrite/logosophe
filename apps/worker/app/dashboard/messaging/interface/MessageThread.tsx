'use client';

import { useState, useEffect } from 'react';
import { Heading, Text, Flex, Card, Button, Box, Badge, Avatar, Separator, Dialog } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import type { RecentMessage, MessageRecipient } from './types';



interface MessageThreadProps {
  message: RecentMessage;
  userEmail: string;
  onReply?: (message: RecentMessage) => void;
  onForward?: (message: RecentMessage) => void;
}

export function MessageThread({
  message,
  userEmail,
  onReply,
  onForward
}: MessageThreadProps) {
  const { showToast } = useToast();
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isSender = message.SenderEmail === userEmail;

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



    // Mark message as read if user is a recipient and message is unread
    if (!isSender && !message.IsRead) {
      markMessageAsRead();
    }
  }, [message.Id, message.CreatedAt, message.IsRead, isSender]);

  const markMessageAsRead = async () => {
    try {
      const response = await fetch(`/api/dashboard/messaging/messages/${message.Id}/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageId: message.Id }),
      });

      if (response.ok) {
        // Update the message's read status locally
        // This will be reflected in the parent component when it refreshes
        console.log('Message marked as read');
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };

  const handleForward = () => {
    if (onForward) {
      onForward(message);
    }
  };

  const handleArchive = async () => {
    if (isArchiving) return;
    
    setIsArchiving(true);
    try {
      const response = await fetch(`/api/dashboard/messaging/messages/${message.Id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageId: message.Id }),
      });

      if (response.ok) {
        // Archive successful - show success message
        console.log('Message archived successfully');
        showToast({
          type: 'success',
          title: 'Success',
          content: 'Message archived successfully'
        });
        // Note: The parent component will need to refresh to show updated status
      } else {
        const errorData = await response.json() as { error?: string };
        console.error('Failed to archive message:', errorData.error);
        showToast({
          type: 'error',
          title: 'Error',
          content: errorData.error || 'Failed to archive message'
        });
      }
    } catch (error) {
      console.error('Error archiving message:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'An error occurred while archiving the message'
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const [deleteDialog, setDeleteDialog] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;
    
    // Show delete confirmation dialog
    setDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setDeleteDialog(false);
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/harbor/messaging/messages/${message.Id}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Delete successful - show success message
        console.log('Message deleted successfully');
        showToast({
          type: 'success',
          title: 'Success',
          content: 'Message deleted successfully'
        });
        // Note: The parent component will need to refresh to show updated status
      } else {
        const errorData = await response.json() as { error?: string };
        console.error('Failed to delete message:', errorData.error);
        showToast({
          type: 'error',
          title: 'Error',
          content: errorData.error || 'Failed to delete message'
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'An error occurred while deleting the message'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Note: Removed auto-mark-as-read logic since this is the dashboard interface
  // where admin users are typically the senders, not recipients



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
            
            {/* Message Type Explanation for non-direct messages */}
            {message.MessageType !== 'direct' && (
              <Box style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--blue-2)', borderRadius: '4px', border: '1px solid var(--blue-6)' }}>
                <Text size="1" color="blue" weight="medium">
                  {message.MessageType === 'broadcast' ? '📢 Broadcast Message' : '📋 Announcement'}
                </Text>
                <Text size="1" color="blue">
                  {message.MessageType === 'broadcast' 
                    ? 'One-way communication - replies not allowed'
                    : 'Official announcement - replies not allowed'
                  }
                </Text>
              </Box>
            )}
            <Text size="1" color="gray">
              {new Date(message.CreatedAt).toLocaleString()}
            </Text>
          </Box>
          <Flex gap="2">
            {message.MessageType === 'direct' && (
              <Button size="1" variant="soft" onClick={handleReply}>
                Reply
              </Button>
            )}
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

        {/* Recipients Section - Only show if not the sender */}
        {!isSender && (
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
        )}
      </Box>

      {/* Message Actions */}
      <Box style={{ padding: '1.5rem', borderTop: '1px solid var(--gray-6)' }}>
        <Flex gap="2" justify="between" align="center">
          <Text size="1" color="gray">
            Message ID: {message.Id} • 
            {isSender ? 'You sent this message' : 'You received this message'}
          </Text>
          <Flex gap="2">
            <Button size="1" variant="soft" onClick={handleForward}>
              Forward
            </Button>
            <Button size="1" variant="soft" onClick={handleArchive} disabled={isArchiving}>
              {isArchiving ? 'Archiving...' : 'Archive'}
            </Button>
            <Button size="1" variant="soft" color="red" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteDialog} onOpenChange={setDeleteDialog}>
        <Dialog.Content style={{ maxWidth: 500 }}>
          <Dialog.Title>
            <Text weight="bold" color="red">⚠️ Delete Message</Text>
          </Dialog.Title>
          <Box my="4">
            <Text size="3">
              Are you sure you want to delete this message? This action cannot be undone.
            </Text>
          </Box>
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft">
                Cancel
              </Button>
            </Dialog.Close>
            <Button 
              variant="solid" 
              color="red" 
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
} 