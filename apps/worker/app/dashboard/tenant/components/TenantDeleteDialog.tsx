'use client';

import { useState } from 'react';
import { Button, Text, Dialog } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';

interface Tenant {
  Id: string;
  Name: string;
  Description: string;
}

interface TenantDeleteDialogProps {
  tenant: Tenant;
  onComplete: () => void;
}

export function TenantDeleteDialog({ tenant, onComplete }: TenantDeleteDialogProps) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/tenant/${tenant.Id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || 'Failed to delete tenant');
      }

      showToast({
        title: 'Success',
        content: 'Tenant deleted successfully',
        type: 'success'
      });
      onComplete();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      showToast({
        title: 'Error',
        content: 'Failed to delete tenant',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={() => onComplete()}>
      <Dialog.Content style={{ 
        maxWidth: 450,
        width: '400px',
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, 0)',
        maxHeight: '70vh',
        overflow: 'auto',
        zIndex: 100000,
        backgroundColor: 'var(--color-panel-solid)',
        border: '1px solid var(--gray-6)',
        borderRadius: 'var(--radius-3)',
        boxShadow: 'var(--shadow-4)'
      }}>
        <Dialog.Title>Delete Tenant</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Are you sure you want to delete the tenant "{tenant.Name}"? This action cannot be undone.
        </Dialog.Description>

        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="soft"
            onClick={onComplete}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Tenant'}
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
} 