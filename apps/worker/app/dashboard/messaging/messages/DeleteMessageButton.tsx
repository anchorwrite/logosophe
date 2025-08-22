'use client';

import { useState } from 'react';
import { Button, Flex, AlertDialog } from '@radix-ui/themes';

interface DeleteMessageButtonProps {
  messageId: number;
  tenantId: string;
}

export default function DeleteMessageButton({ messageId, tenantId }: DeleteMessageButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/dashboard/messaging/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh the page to show updated message list
        window.location.reload();
      } else {
        const errorData = await response.json() as { error?: string };
        alert(`Error deleting message: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Error deleting message. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <>
      <Button 
        size="1" 
        variant="soft" 
        color="red"
        onClick={() => setShowConfirmDialog(true)}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </Button>

      <AlertDialog.Root open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialog.Content>
          <AlertDialog.Title>Delete Message</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to delete this message? This action cannot be undone and will remove the message for all recipients.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button variant="solid" color="red" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Message'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}
