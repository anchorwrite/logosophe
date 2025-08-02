"use client";

import { useState } from 'react';
import { Dialog, Flex, Button, Text, Heading } from '@radix-ui/themes';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'default',
  isLoading = false
}: ConfirmationDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
      onClose();
    }
  };

  const getButtonColor = () => {
    switch (variant) {
      case 'danger':
        return 'red';
      case 'warning':
        return 'orange';
      default:
        return 'blue';
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content style={{ 
        maxWidth: 450,
        maxHeight: '70vh',
        overflow: 'auto',
        position: 'fixed',
        top: '15vh',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        backgroundColor: 'var(--color-panel-solid)',
        border: '1px solid var(--gray-6)',
        borderRadius: 'var(--radius-3)',
        boxShadow: 'var(--shadow-4)',
        padding: 'var(--space-4)'
      }}>
        <Dialog.Title>
          <Heading size="4">{title}</Heading>
        </Dialog.Title>
        
        <Dialog.Description size="2" mb="4">
          <Text>{message}</Text>
        </Dialog.Description>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" disabled={isLoading || isConfirming}>
              {cancelText}
            </Button>
          </Dialog.Close>
          <Button 
            color={getButtonColor()} 
            onClick={handleConfirm}
            disabled={isLoading || isConfirming}
          >
            {isLoading || isConfirming ? 'Processing...' : confirmText}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
} 