'use client';

import { useState } from 'react';
import { Button, Flex, AlertDialog, Text } from '@radix-ui/themes';

interface DeleteMessageButtonProps {
  messageId: number;
  tenantId: string;
  showHardDelete?: boolean;
}

export default function DeleteMessageButton({ messageId, tenantId, showHardDelete = false }: DeleteMessageButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const url = new URL(`/api/dashboard/messaging/messages/${messageId}`, window.location.origin);
      if (deleteType === 'hard') {
        url.searchParams.set('type', 'hard');
      }
      
      const response = await fetch(url.toString(), {
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
            {deleteType === 'soft' 
              ? 'This will mark the message as deleted but keep it in the database for audit purposes. The message will be hidden from all users.'
              : 'This will PERMANENTLY DELETE the message and all its data. This action cannot be undone and will remove the message completely from the system.'
            }
          </AlertDialog.Description>
          
          {showHardDelete && (
            <Flex gap="2" mt="3" align="center">
              <Text size="2">Delete Type:</Text>
              <Flex gap="1">
                <Button 
                  size="1" 
                  variant={deleteType === 'soft' ? 'solid' : 'soft'}
                  onClick={() => setDeleteType('soft')}
                >
                  Soft Delete
                </Button>
                <Button 
                  size="1" 
                  variant={deleteType === 'hard' ? 'solid' : 'soft'}
                  color="red"
                  onClick={() => setDeleteType('hard')}
                >
                  Hard Delete
                </Button>
              </Flex>
            </Flex>
          )}
          
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button 
                variant="solid" 
                color={deleteType === 'hard' ? 'red' : 'orange'} 
                onClick={handleDelete} 
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : `${deleteType === 'hard' ? 'Permanently Delete' : 'Delete'} Message`}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}
