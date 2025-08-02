'use client';

import { useState } from 'react';
import { Button, TextField, Text, Box, Checkbox, Flex } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Subscriber {
  Email: string;
  Name: string;
  Provider: string;
  Active: boolean;
  Banned: boolean;
  Post: boolean;
  Moderate: boolean;
  Track: boolean;
}

interface SubscriberUpdateFormProps {
  subscriber: Subscriber;
  onUpdateComplete: () => void;
}

interface Tenant {
  Id: string;
  Name: string;
}

interface TenantsResponse {
  tenants: Tenant[];
}

interface SubscriberTenant {
  TenantId: string;
  TenantName: string;
  RoleId: string;
}

interface SubscriberTenantsResponse {
  results: SubscriberTenant[];
}

export function SubscriberUpdateForm({ subscriber, onUpdateComplete }: SubscriberUpdateFormProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<Subscriber>({
    Email: subscriber.Email,
    Name: subscriber.Name,
    Provider: subscriber.Provider,
    Active: subscriber.Active,
    Banned: subscriber.Banned,
    Post: subscriber.Post,
    Moderate: subscriber.Moderate,
    Track: subscriber.Track
  });

  const fetchData = async () => {
    try {
      // Fetch tenants
      const tenantsResponse = await fetch('/api/tenant');
      if (!tenantsResponse.ok) {
        throw new Error('Failed to fetch tenants');
      }
      const tenantsData = await tenantsResponse.json() as TenantsResponse;
      setTenants(tenantsData.tenants || []);

      // Fetch subscriber tenants
      const subscriberTenantsResponse = await fetch(`/api/subscriber-tenants?email=${encodeURIComponent(subscriber.Email)}`);
      if (!subscriberTenantsResponse.ok) {
        throw new Error('Failed to fetch subscriber tenants');
      }
      const subscriberTenantsData = await subscriberTenantsResponse.json() as SubscriberTenantsResponse;
      setSelectedTenants(subscriberTenantsData.results?.map(tu => tu.TenantId) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast({
        title: 'Error',
        content: 'Failed to load data',
        type: 'error'
      });
    }
  };

  // Call fetchData when the dropdown is opened
  const handleDropdownClick = () => {
    if (!isOpen && tenants.length === 0) {
      fetchData();
    }
    setIsOpen(!isOpen);
  };

  const handleTenantSelect = (tenantId: string, checked: boolean) => {
    const newSelectedTenants = checked
      ? [...selectedTenants, tenantId]
      : selectedTenants.filter(id => id !== tenantId);
    
    setSelectedTenants(newSelectedTenants);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Starting subscriber update...', {
        email: subscriber.Email,
        formData,
        selectedTenants
      });

      // Update subscriber
      const response = await fetch('/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          op: 'update',
          updateId: subscriber.Email,
          ...formData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(`Failed to update subscriber: ${errorData.error || response.statusText}`);
      }

      console.log('Subscriber basic info updated successfully');

      // First, get existing tenant assignments
      const existingAssignmentsResponse = await fetch('/api/subscriber-tenants?email=' + encodeURIComponent(subscriber.Email));
      if (!existingAssignmentsResponse.ok) {
        const errorData = await existingAssignmentsResponse.json() as { error?: string };
        throw new Error(`Failed to fetch existing tenant assignments: ${errorData.error || existingAssignmentsResponse.statusText}`);
      }

      const existingAssignments = await existingAssignmentsResponse.json() as { results: SubscriberTenant[] };
      console.log('Existing tenant assignments:', existingAssignments);

      // Calculate which assignments to add and remove
      const existingTenantIds = existingAssignments.results?.map(tu => tu.TenantId) || [];
      const tenantsToAdd = selectedTenants.filter(id => !existingTenantIds.includes(id));
      const tenantsToRemove = existingTenantIds.filter(id => !selectedTenants.includes(id));

      console.log('Tenants to add:', tenantsToAdd);
      console.log('Tenants to remove:', tenantsToRemove);

      // Remove assignments that are no longer needed
      for (const tenantId of tenantsToRemove) {
        console.log('Removing tenant assignment for:', tenantId);
        const deleteResponse = await fetch('/api/tenant-users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            op: 'delete',
            Email: subscriber.Email,
            delId: tenantId
          }),
        });

        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json() as { error?: string };
          throw new Error(`Failed to remove tenant assignment for ${tenantId}: ${errorData.error || deleteResponse.statusText}`);
        }
      }

      // Add new assignments
      for (const tenantId of tenantsToAdd) {
        console.log('Adding tenant assignment for:', tenantId);
        const tenantResponse = await fetch('/api/tenant-users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            op: 'insert',
            Email: subscriber.Email,
            TenantId: tenantId,
            RoleId: 'user'
          }),
        });

        if (!tenantResponse.ok) {
          const errorData = await tenantResponse.json() as { error?: string };
          throw new Error(`Failed to add tenant assignment for ${tenantId}: ${errorData.error || tenantResponse.statusText}`);
        }
      }

      console.log('All tenant assignments updated successfully');
      showToast({
        title: 'Success',
        content: 'Subscriber updated successfully',
        type: 'success'
      });
      onUpdateComplete();
    } catch (error) {
      console.error('Error updating subscriber:', error);
      showToast({
        title: 'Error',
        content: error instanceof Error ? error.message : 'Failed to update subscriber',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Email
          </Text>
          <TextField.Root>
            <TextField.Input
              value={formData.Email}
              readOnly
              disabled
            />
          </TextField.Root>
        </Box>

        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Name
          </Text>
          <TextField.Root>
            <TextField.Input
              value={formData.Name}
              onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
              required
            />
          </TextField.Root>
        </Box>

        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Provider
          </Text>
          <TextField.Root>
            <TextField.Input
              value={formData.Provider}
              readOnly
              disabled
            />
          </TextField.Root>
        </Box>

        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Permissions
          </Text>
          <div className="space-y-2">
            <Flex align="center" gap="2">
              <Checkbox
                checked={formData.Active}
                onCheckedChange={(checked) => setFormData({ ...formData, Active: checked as boolean })}
              />
              <Text size="2">Active</Text>
            </Flex>
            <Flex align="center" gap="2">
              <Checkbox
                checked={formData.Banned}
                onCheckedChange={(checked) => setFormData({ ...formData, Banned: checked as boolean })}
              />
              <Text size="2">Banned</Text>
            </Flex>
            <Flex align="center" gap="2">
              <Checkbox
                checked={formData.Post}
                onCheckedChange={(checked) => setFormData({ ...formData, Post: checked as boolean })}
              />
              <Text size="2">Can Post</Text>
            </Flex>
            <Flex align="center" gap="2">
              <Checkbox
                checked={formData.Moderate}
                onCheckedChange={(checked) => setFormData({ ...formData, Moderate: checked as boolean })}
              />
              <Text size="2">Can Moderate</Text>
            </Flex>
            <Flex align="center" gap="2">
              <Checkbox
                checked={formData.Track}
                onCheckedChange={(checked) => setFormData({ ...formData, Track: checked as boolean })}
              />
              <Text size="2">Can Track</Text>
            </Flex>
          </div>
        </Box>

        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Tenants
          </Text>
          <div className="relative">
            <div
              onClick={handleDropdownClick}
              className="flex items-center justify-between w-full px-3 py-2 text-sm border rounded-md cursor-pointer hover:bg-gray-50"
            >
              <Text size="2" color="gray">
                {selectedTenants.length > 0
                  ? `${selectedTenants.length} tenant${selectedTenants.length === 1 ? '' : 's'} selected`
                  : 'Select tenants'}
              </Text>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
            {isOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setIsOpen(false)}
                />
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg">
                  <div className="max-h-60 overflow-auto">
                    {tenants.map((tenant) => (
                      <div
                        key={tenant.Id}
                        className="flex items-center px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedTenants.includes(tenant.Id)}
                          onCheckedChange={(checked) => handleTenantSelect(tenant.Id, checked as boolean)}
                        />
                        <Text size="2" className="ml-2">{tenant.Name}</Text>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Box>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="soft"
          onClick={onUpdateComplete}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Updating...' : 'Update Subscriber'}
        </Button>
      </div>
    </form>
  );
} 