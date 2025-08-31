'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  Flex, 
  Heading, 
  Text, 
  TextField, 
  Select, 
  Table, 
  Badge,
  Dialog,
  TextArea,
  AlertDialog
} from '@radix-ui/themes';
import { PlusIcon, Pencil1Icon, TrashIcon } from '@radix-ui/react-icons';

interface IndividualSubscriberHandleLimit {
  Id: number;
  SubscriberEmail: string;
  LimitType: 'default' | 'premium' | 'enterprise';
  Description?: string;
  SetBy: string;
  SetAt: string;
  ExpiresAt?: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
  SubscriberName?: string;
  AdminEmail?: string;
}

interface Tenant {
  Id: string;
  Name: string;
}

interface HandleLimitsManagerProps {
  isSystemAdmin: boolean;
  accessibleTenants: Tenant[];
}

export default function HandleLimitsManager({ isSystemAdmin, accessibleTenants }: HandleLimitsManagerProps) {
  const [limits, setLimits] = useState<IndividualSubscriberHandleLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingLimit, setEditingLimit] = useState<IndividualSubscriberHandleLimit | null>(null);
  const [deletingLimit, setDeletingLimit] = useState<IndividualSubscriberHandleLimit | null>(null);
  
  const [formData, setFormData] = useState({
    subscriberEmail: '',
    limitType: 'default' as 'default' | 'premium' | 'enterprise',
    description: '',
    expiresAt: ''
  });

  const loadLimits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (selectedTenant) {
        params.append('tenantId', selectedTenant);
      }
      
      const response = await fetch(`/api/dashboard/handle-limits?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load handle limits');
      }
      
      const data = await response.json() as { data: IndividualSubscriberHandleLimit[] };
      setLimits(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load handle limits');
    } finally {
      setLoading(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    if (accessibleTenants.length > 0 && !isSystemAdmin) {
      setSelectedTenant(accessibleTenants[0].Id);
    }
    loadLimits();
  }, [selectedTenant, isSystemAdmin, loadLimits, accessibleTenants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError(null);
      
      const payload = {
        subscriberEmail: formData.subscriberEmail,
        limitType: formData.limitType,
        description: formData.description,
        expiresAt: formData.expiresAt,
        tenantId: selectedTenant || undefined
      };
      
      const response = await fetch('/api/dashboard/handle-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json() as { error: string };
        throw new Error(errorData.error || 'Failed to save handle limit');
      }
      
      const data = await response.json() as { message: string };
      await loadLimits();
      setShowForm(false);
      setEditingLimit(null);
      resetForm();
      alert(data.message);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save handle limit');
    }
  };

  const handleDelete = async () => {
    if (!deletingLimit) return;
    
    try {
      setError(null);
      
      const params = new URLSearchParams({
        subscriberEmail: deletingLimit.SubscriberEmail
      });
      
      if (selectedTenant) {
        params.append('tenantId', selectedTenant);
      }
      
      const response = await fetch(`/api/dashboard/handle-limits?${params}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json() as { error: string };
        throw new Error(errorData.error || 'Failed to delete handle limit');
      }
      
      await loadLimits();
      setDeletingLimit(null);
      alert('Handle limit removed successfully');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete handle limit');
    }
  };

  const handleEdit = (limit: IndividualSubscriberHandleLimit) => {
    setEditingLimit(limit);
    setFormData({
      subscriberEmail: limit.SubscriberEmail,
      limitType: limit.LimitType,
      description: limit.Description || '',
      expiresAt: limit.ExpiresAt ? limit.ExpiresAt.split('T')[0] : ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      subscriberEmail: '',
      limitType: 'default',
      description: '',
      expiresAt: ''
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getLimitTypeColor = (type: string) => {
    switch (type) {
      case 'default': return 'gray';
      case 'premium': return 'green';
      case 'enterprise': return 'purple';
      default: return 'blue';
    }
  };

  if (loading) {
    return (
      <Box>
        <Heading size="6" mb="4">Handle Limits Management</Heading>
        <Text>Loading...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Heading size="6">Handle Limits Management</Heading>
        <Button onClick={() => setShowForm(true)}>
          <PlusIcon />
          Add Handle Limit
        </Button>
      </Flex>

      {!isSystemAdmin && accessibleTenants.length > 0 && (
        <Card mb="4">
          <Box p="3">
            <Flex align="center" gap="3">
              <Text weight="medium">Tenant:</Text>
              <Select.Root value={selectedTenant} onValueChange={setSelectedTenant}>
                <Select.Trigger />
                <Select.Content>
                  {accessibleTenants.map(tenant => (
                    <Select.Item key={tenant.Id} value={tenant.Id}>
                      {tenant.Name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
          </Box>
        </Card>
      )}

      {error && (
        <Card mb="4" style={{ backgroundColor: 'var(--red-3)' }}>
          <Box p="3">
            <Text color="red">{error}</Text>
          </Box>
        </Card>
      )}

      <Card>
        <Box p="3">
          <Heading size="4" mb="3">Current Handle Limits</Heading>
          
          {limits.length === 0 ? (
            <Text color="gray">No custom handle limits found.</Text>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                                  <Table.ColumnHeaderCell>Subscriber</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Set By</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Set At</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Expires</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {limits.map(limit => (
                  <Table.Row key={limit.Id}>
                    <Table.Cell>
                      <Box>
                        <Text weight="medium">{limit.SubscriberName || limit.SubscriberEmail}</Text>
                        <Text size="2" color="gray">{limit.SubscriberEmail}</Text>
                      </Box>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={getLimitTypeColor(limit.LimitType)}>
                        {limit.LimitType}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text>{limit.Description || '-'}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">{limit.AdminEmail || limit.SetBy}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">{formatDate(limit.SetAt)}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">
                        {limit.ExpiresAt ? formatDate(limit.ExpiresAt) : 'Never'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2">
                        <Button 
                          size="1" 
                          variant="soft" 
                          onClick={() => handleEdit(limit)}
                        >
                          <Pencil1Icon />
                        </Button>
                        <Button 
                          size="1" 
                          variant="soft" 
                          color="red"
                          onClick={() => setDeletingLimit(limit)}
                        >
                          <TrashIcon />
                        </Button>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Card>

      <Dialog.Root open={showForm} onOpenChange={setShowForm}>
        <Dialog.Content>
          <Dialog.Title>
            {editingLimit ? 'Edit Handle Limit' : 'Add Handle Limit'}
          </Dialog.Title>
          
          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="3">
              <Box>
                <Text as="div" size="2" mb="1" weight="medium">
                  Subscriber Email
                </Text>
                <TextField.Root>
                  <TextField.Input
                    value={formData.subscriberEmail}
                    onChange={(e) => setFormData({ ...formData, subscriberEmail: e.target.value })}
                    placeholder="subscriber@example.com"
                    required
                    disabled={!!editingLimit}
                  />
                </TextField.Root>
              </Box>
              
              <Box>
                <Text as="div" size="2" mb="1" weight="medium">
                  Limit Type
                </Text>
                <Select.Root 
                  value={formData.limitType} 
                  onValueChange={(value: 'default' | 'premium' | 'enterprise') => 
                    setFormData({ ...formData, limitType: value })
                  }
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="default">Default (1 handle)</Select.Item>
                    <Select.Item value="premium">Premium (3 handles)</Select.Item>
                    <Select.Item value="enterprise">Enterprise (10 handles)</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>
              

              
              <Box>
                <Text as="div" size="2" mb="1" weight="medium">
                  Description (Optional)
                </Text>
                <TextArea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Reason for this limit..."
                  rows={3}
                />
              </Box>
              
              <Box>
                <Text as="div" size="2" mb="1" weight="medium">
                  Expiration Date (Optional)
                </Text>
                <TextField.Root>
                  <TextField.Input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  />
                </TextField.Root>
              </Box>
            </Flex>
            
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit">
                {editingLimit ? 'Update Limit' : 'Add Limit'}
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>
      <AlertDialog.Root open={!!deletingLimit} onOpenChange={() => setDeletingLimit(null)}>
        <AlertDialog.Content>
          <AlertDialog.Title>Remove Handle Limit</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to remove the handle limit for{' '}
            <strong>{deletingLimit?.SubscriberName || deletingLimit?.SubscriberEmail}</strong>?
            This will revert them to the default limit.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button variant="solid" color="red" onClick={handleDelete}>
                Remove Limit
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  );
}
