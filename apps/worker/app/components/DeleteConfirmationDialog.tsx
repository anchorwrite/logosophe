'use client';

import { Dialog, Button, Text, Flex, Box, Heading } from '@radix-ui/themes';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  subscriberName: string;
  subscriberEmail: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  subscriberName,
  subscriberEmail,
  onConfirm,
  isLoading = false
}: DeleteConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 600 }}>
        <Dialog.Title>
          <Flex align="center" gap="2">
            <Text color="red" weight="bold">⚠️ Confirm Hard Delete</Text>
          </Flex>
        </Dialog.Title>

        <Box my="4">
          <Text size="3" weight="bold" color="red">
            Are you sure you want to HARD DELETE {subscriberName} ({subscriberEmail})?
          </Text>
          
          <Box mt="4">
            <Text size="2" weight="bold" color="red">
              This will PERMANENTLY delete:
            </Text>
            <Box mt="2" ml="4">
              <Text size="2" as="div">• All messages sent/received by this user</Text>
              <Text size="2" as="div">• All message attachments and links</Text>
              <Text size="2" as="div">• All workflow messages and history</Text>
              <Text size="2" as="div">• All media files uploaded by this user</Text>
              <Text size="2" as="div">• All tenant user records and role assignments</Text>
              <Text size="2" as="div">• The subscriber record itself</Text>
            </Box>
          </Box>

          <Box mt="4" p="3" style={{ 
            backgroundColor: 'var(--red-1)', 
            border: '1px solid var(--red-6)', 
            borderRadius: 'var(--radius-3)' 
          }}>
            <Text size="2" color="red" weight="bold">
              ⚠️  This action cannot be undone and will break any existing references!
            </Text>
          </Box>
        </Box>

        <Flex gap="3" justify="end">
          <Dialog.Close>
            <Button variant="soft" disabled={isLoading}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button 
            variant="solid" 
            color="red" 
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
