'use client';

import { useState } from 'react';
import { Button, TextField, Text, Box } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';

interface Tenant {
  Id: string;
  Name: string;
  Description: string;
  CreatedAt: string;
  UpdatedAt: string;
}

interface TenantFormProps {
  tenant?: Tenant;
  onSuccess: () => void;
}

export function TenantForm({ tenant, onSuccess }: TenantFormProps) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: tenant?.Id || '',
    name: tenant?.Name || '',
    description: tenant?.Description || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id || !formData.name) {
      showToast({
        title: 'Error',
        content: 'Please fill in all required fields',
        type: 'error'
      });
      return;
    }

    setIsLoading(true);

    try {
      const url = tenant ? `/api/tenant/${tenant.Id}` : '/api/tenant';
      const method = tenant ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || 'Failed to save tenant');
      }

      showToast({
        title: 'Success',
        content: tenant ? 'Tenant updated successfully' : 'Tenant added successfully',
        type: 'success'
      });
      console.log('Form success, calling onSuccess');
      onSuccess();
    } catch (error) {
      console.error('Error saving tenant:', error);
      showToast({
        title: 'Error',
        content: 'Failed to save tenant',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form id="tenantForm" onSubmit={handleSubmit}>
        {!tenant && (
          <Box>
            <Text as="label" size="2" weight="bold" mb="1">
              Tenant ID
            </Text>
            <TextField.Root>
              <TextField.Input
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                placeholder="Enter tenant ID (e.g. tenant-001)"
                required
              />
            </TextField.Root>
          </Box>
        )}

        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Name
          </Text>
          <TextField.Root>
            <TextField.Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter tenant name"
              required
            />
          </TextField.Root>
        </Box>

        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Description
          </Text>
          <TextField.Root>
            <TextField.Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter tenant description"
            />
          </TextField.Root>
        </Box>

        <div className="flex justify-end space-x-3">
          <Button
            variant="soft"
            color="gray"
            type="button"
            onClick={onSuccess}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : tenant ? 'Update Tenant' : 'Add Tenant'}
          </Button>
        </div>
      </form>
    </div>
  );
} 