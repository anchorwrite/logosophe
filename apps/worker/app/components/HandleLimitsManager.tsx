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
  AlertDialog,
  Checkbox,
  Separator
} from '@radix-ui/themes';
import { PlusIcon, Pencil1Icon, TrashIcon, CheckIcon } from '@radix-ui/react-icons';
import { useToast } from '@/components/Toast';

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

interface Subscriber {
  Email: string;
  Name?: string;
  CreatedAt: string;
  Active: boolean;
}

interface Tenant {
  Id: string;
  Name: string;
}

interface SubscriberHandleCount {
  Email: string;
  Name?: string;
  HandleCount: number;
  ActiveHandleCount: number;
  PublicHandleCount: number;
}

interface HandleLimitsManagerProps {
  isSystemAdmin: boolean;
  accessibleTenants: Tenant[];
}

export default function HandleLimitsManager({ isSystemAdmin, accessibleTenants }: HandleLimitsManagerProps) {
  const { showToast } = useToast();
  const [limits, setLimits] = useState<IndividualSubscriberHandleLimit[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [handleCounts, setHandleCounts] = useState<SubscriberHandleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingLimit, setEditingLimit] = useState<IndividualSubscriberHandleLimit | null>(null);
  const [deletingLimit, setDeletingLimit] = useState<IndividualSubscriberHandleLimit | null>(null);
  
  // Bulk selection states
  const [selectedSubscribers, setSelectedSubscribers] = useState<Set<string>>(new Set());
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(new Set());
  const [bulkLimitType, setBulkLimitType] = useState<'default' | 'premium' | 'enterprise'>('default');
  const [bulkDescription, setBulkDescription] = useState('');
  const [bulkExpiresAt, setBulkExpiresAt] = useState('');
  const [showBulkForm, setShowBulkForm] = useState(false);
  
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
      
      const response = await fetch(`/api/dashboard/handle-limits?${params}`, {
        credentials: 'include' // Include cookies for authentication
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in again.');
        }
        throw new Error('Failed to load handle limits');
      }
      
      const data = await response.json() as { data: IndividualSubscriberHandleLimit[] };
      setLimits(data.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load handle limits';
      setError(errorMessage);
      showToast({
        title: 'Error',
        content: errorMessage,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedTenant, showToast]);

  const loadSubscribers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTenant) {
        params.append('tenantId', selectedTenant);
      }
      
      const response = await fetch(`/api/dashboard/handle-limits/subscribers?${params}`, {
        credentials: 'include' // Include cookies for authentication
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in again.');
        }
        throw new Error('Failed to load subscribers');
      }
      
      const data = await response.json() as { data: Subscriber[] };
      setSubscribers(data.data || []);
    } catch (err) {
      console.error('Failed to load subscribers:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load subscribers';
      showToast({
        title: 'Error',
        content: errorMessage,
        type: 'error'
      });
    }
  }, [selectedTenant, showToast]);

  const loadHandleCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTenant) {
        params.append('tenantId', selectedTenant);
      }
      
      const response = await fetch(`/api/dashboard/handle-limits/subscriber-handle-counts?${params}`, {
        credentials: 'include' // Include cookies for authentication
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in again.');
        }
        throw new Error('Failed to load handle counts');
      }
      
      const data = await response.json() as { data: SubscriberHandleCount[] };
      
      // Get the current individual limits to properly calculate handle counts
      const limitsResponse = await fetch(`/api/dashboard/handle-limits?${params}`, {
        credentials: 'include'
      });
      let currentLimits: IndividualSubscriberHandleLimit[] = [];
      if (limitsResponse.ok) {
        const limitsData = await limitsResponse.json() as { data: IndividualSubscriberHandleLimit[] };
        currentLimits = limitsData.data || [];
      }
      
      // Merge handle counts with individual limits
      const enhancedHandleCounts = data.data.map(handleCount => {
        const individualLimit = currentLimits.find(limit => 
          limit.SubscriberEmail === handleCount.Email && limit.IsActive
        );
        
        if (individualLimit) {
          // Use the individual limit type to determine max handles
          let maxHandles = 1; // default
          switch (individualLimit.LimitType) {
            case 'premium':
              maxHandles = 3;
              break;
            case 'enterprise':
              maxHandles = 10;
              break;
            case 'default':
            default:
              maxHandles = 1;
              break;
          }
          
          return {
            ...handleCount,
            HandleCount: maxHandles // Override with the individual limit
          };
        }
        
        return handleCount;
      });
      
      setHandleCounts(enhancedHandleCounts);
    } catch (err) {
      console.error('Failed to load handle counts:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load handle counts';
      showToast({
        title: 'Error',
        content: errorMessage,
        type: 'error'
      });
    }
  }, [selectedTenant, showToast]);

  useEffect(() => {
    if (accessibleTenants.length > 0) {
      if (!isSystemAdmin) {
        setSelectedTenant(accessibleTenants[0].Id);
      } else {
        // For system admins, set first tenant as default to show subscribers
        setSelectedTenant(accessibleTenants[0].Id);
      }
    }
  }, [accessibleTenants, isSystemAdmin]);

  // Load data when selectedTenant changes
  useEffect(() => {
    if (selectedTenant) {
      loadLimits();
      loadSubscribers();
      loadHandleCounts();
    }
  }, [selectedTenant, loadLimits, loadSubscribers, loadHandleCounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError(null);
      
      // Ensure the expiration date is properly formatted as YYYY-MM-DD
      let formattedExpiresAt = formData.expiresAt;
      if (formData.expiresAt) {
        // If the date is in a different format, convert it to YYYY-MM-DD
        const date = new Date(formData.expiresAt);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          formattedExpiresAt = `${year}-${month}-${day}`;
        }
      }
      
      const payload = {
        subscriberEmail: formData.subscriberEmail,
        limitType: formData.limitType,
        description: formData.description,
        expiresAt: formattedExpiresAt,
        tenantId: selectedTenant || undefined
      };
      
      const response = await fetch('/api/dashboard/handle-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in again.');
        }
        const errorData = await response.json() as { error: string };
        throw new Error(errorData.error || 'Failed to save handle limit');
      }
      
      const data = await response.json() as { message: string };
      await loadLimits();
      await loadHandleCounts(); // Refresh handle counts after limit change
      setShowForm(false);
      setEditingLimit(null);
      resetForm();
      showToast({
        title: 'Success',
        content: data.message || 'Handle limit saved successfully',
        type: 'success'
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save handle limit';
      setError(errorMessage);
      showToast({
        title: 'Error',
        content: errorMessage,
        type: 'error'
      });
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError(null);
      
      if (selectedSubscribers.size === 0 && selectedTenants.size === 0) {
        setError('Please select at least one subscriber or tenant');
        showToast({
          title: 'Error',
          content: 'Please select at least one subscriber or tenant',
          type: 'error'
        });
        return;
      }
      
      // Process selected subscribers
      if (selectedSubscribers.size > 0) {
        const subscriberPromises = Array.from(selectedSubscribers).map(email => 
          fetch('/api/dashboard/handle-limits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Include cookies for authentication
            body: JSON.stringify({
              subscriberEmail: email,
              limitType: bulkLimitType,
              description: bulkDescription,
              expiresAt: bulkExpiresAt,
              tenantId: selectedTenant || undefined
            })
          })
        );
        
        await Promise.all(subscriberPromises);
      }
      
      // Process selected tenants (for system admins only)
      if (isSystemAdmin && selectedTenants.size > 0) {
        // Get all subscribers from selected tenants
        const tenantSubscriberPromises = Array.from(selectedTenants).map(async (tenantId) => {
          const response = await fetch(`/api/dashboard/handle-limits/subscribers?tenantId=${tenantId}`, {
            credentials: 'include' // Include cookies for authentication
          });
          if (response.ok) {
            const data = await response.json() as { data: Subscriber[] };
            return data.data || [];
          }
          return [];
        });
        
        const tenantSubscribers = await Promise.all(tenantSubscriberPromises);
        const allSubscribers = tenantSubscribers.flat();
        
        // Set limits for all subscribers in selected tenants
        const tenantLimitPromises = allSubscribers.map(subscriber => 
          fetch('/api/dashboard/handle-limits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Include cookies for authentication
            body: JSON.stringify({
              subscriberEmail: subscriber.Email,
              limitType: bulkLimitType,
              description: bulkDescription,
              expiresAt: bulkExpiresAt,
              tenantId: undefined // System admin operation
            })
          })
        );
        
        await Promise.all(tenantLimitPromises);
      }
      
      await loadLimits();
      await loadHandleCounts(); // Refresh handle counts after bulk changes
      setShowBulkForm(false);
      setSelectedSubscribers(new Set());
      setSelectedTenants(new Set());
      setBulkLimitType('default');
      setBulkDescription('');
      setBulkExpiresAt('');
      showToast({
        title: 'Success',
        content: 'Bulk handle limits updated successfully',
        type: 'success'
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update bulk handle limits';
      setError(errorMessage);
      showToast({
        title: 'Error',
        content: errorMessage,
        type: 'error'
      });
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
        method: 'DELETE',
        credentials: 'include' // Include cookies for authentication
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in again.');
        }
        const errorData = await response.json() as { error: string };
        throw new Error(errorData.error || 'Failed to delete handle limit');
      }
      
      await loadLimits();
      await loadHandleCounts(); // Refresh handle counts after deletion
      setDeletingLimit(null);
      showToast({
        title: 'Success',
        content: 'Handle limit removed successfully',
        type: 'success'
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete handle limit';
      setError(errorMessage);
      showToast({
        title: 'Error',
        content: errorMessage,
        type: 'error'
      });
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
    
    // Handle dates stored as YYYY-MM-DD format (common in databases)
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Parse YYYY-MM-DD format directly to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      return `${month}/${day}/${year}`;
    }
    
    // For other date formats, use the Date constructor
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric' 
    });
  };

  const formatSubscriberName = (name: string | undefined, email: string) => {
    if (name && name.trim()) {
      return `${name} (${email})`;
    }
    return email;
  };

  const getLimitTypeColor = (type: string) => {
    switch (type) {
      case 'default': return 'gray';
      case 'premium': return 'green';
      case 'enterprise': return 'purple';
      default: return 'blue';
    }
  };

  const toggleSubscriberSelection = (email: string) => {
    const newSelection = new Set(selectedSubscribers);
    if (newSelection.has(email)) {
      newSelection.delete(email);
    } else {
      newSelection.add(email);
    }
    setSelectedSubscribers(newSelection);
  };

  const toggleTenantSelection = (tenantId: string) => {
    const newSelection = new Set(selectedTenants);
    if (newSelection.has(tenantId)) {
      newSelection.delete(tenantId);
    } else {
      newSelection.add(tenantId);
    }
    setSelectedTenants(newSelection);
  };

  const selectAllSubscribers = () => {
    setSelectedSubscribers(new Set(subscribers.map(s => s.Email)));
  };

  const selectAllTenants = () => {
    setSelectedTenants(new Set(accessibleTenants.map(t => t.Id)));
  };

  const clearAllSelections = () => {
    setSelectedSubscribers(new Set());
    setSelectedTenants(new Set());
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
        <Flex gap="2">
          <Button onClick={() => setShowBulkForm(true)} variant="soft">
            Bulk Operations
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <PlusIcon />
            Add Handle Limit
          </Button>
        </Flex>
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

      {/* Subscriber Selection Section */}
      <Card mb="4">
        <Box p="3">
          <Flex justify="between" align="center" mb="3">
            <Heading size="4">Subscribers</Heading>
            <Flex gap="2">
              <Button size="1" variant="soft" onClick={selectAllSubscribers}>
                Select All
              </Button>
              <Button size="1" variant="soft" onClick={clearAllSelections}>
                Clear All
              </Button>
            </Flex>
          </Flex>
          
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell style={{ width: '50px' }}>Select</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Current Handles</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Current Limit</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {subscribers.map(subscriber => {
                const handleCount = handleCounts.find(hc => hc.Email === subscriber.Email);
                const currentLimit = limits.find(l => l.SubscriberEmail === subscriber.Email);
                return (
                  <Table.Row key={subscriber.Email}>
                    <Table.Cell>
                      <Checkbox 
                        checked={selectedSubscribers.has(subscriber.Email)}
                        onCheckedChange={() => toggleSubscriberSelection(subscriber.Email)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Text weight="medium">{subscriber.Name || 'No Name'}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">{subscriber.Email}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">
                        {handleCount ? `${handleCount.ActiveHandleCount}/${handleCount.HandleCount}` : '0/0'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {currentLimit ? (
                        <Badge color={getLimitTypeColor(currentLimit.LimitType)}>
                          {currentLimit.LimitType}
                        </Badge>
                      ) : (
                        <Badge color="gray">default</Badge>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      </Card>

      {/* Tenant Selection Section (System Admin Only) */}
      {isSystemAdmin && (
        <Card mb="4">
          <Box p="3">
            <Flex justify="between" align="center" mb="3">
              <Heading size="4">Tenants</Heading>
              <Flex gap="2">
                <Button size="1" variant="soft" onClick={selectAllTenants}>
                  Select All
                </Button>
                <Button size="1" variant="soft" onClick={clearAllSelections}>
                  Clear All
                </Button>
              </Flex>
            </Flex>
            
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell style={{ width: '50px' }}>Select</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Tenant Name</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Tenant ID</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {accessibleTenants.map(tenant => (
                  <Table.Row key={tenant.Id}>
                    <Table.Cell>
                      <Checkbox 
                        checked={selectedTenants.has(tenant.Id)}
                        onCheckedChange={() => toggleTenantSelection(tenant.Id)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Text weight="medium">{tenant.Name}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">{tenant.Id}</Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </Card>
      )}

      {/* Current Handle Limits Section */}
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
                      <Text weight="medium">
                        {formatSubscriberName(limit.SubscriberName, limit.SubscriberEmail)}
                      </Text>
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

      {/* Individual Handle Limit Form */}
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

      {/* Bulk Operations Form */}
      <Dialog.Root open={showBulkForm} onOpenChange={setShowBulkForm}>
        <Dialog.Content size="2">
          <Dialog.Title>Bulk Handle Limit Operations</Dialog.Title>
          
          <form onSubmit={handleBulkSubmit}>
            <Flex direction="column" gap="3">
              <Box>
                <Text as="div" size="2" mb="1" weight="medium">
                  Limit Type
                </Text>
                <Select.Root 
                  value={bulkLimitType} 
                  onValueChange={(value: 'default' | 'premium' | 'enterprise') => 
                    setBulkLimitType(value)
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
                  value={bulkDescription}
                  onChange={(e) => setBulkDescription(e.target.value)}
                  placeholder="Reason for these limits..."
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
                    value={bulkExpiresAt}
                    onChange={(e) => setBulkExpiresAt(e.target.value)}
                  />
                </TextField.Root>
              </Box>

              <Separator my="2" />
              
              <Box>
                <Text as="div" size="2" mb="2" weight="medium">
                  Selected Items:
                </Text>
                {selectedSubscribers.size > 0 && (
                  <Text size="2" color="gray" mb="1">
                    • {selectedSubscribers.size} subscriber(s)
                  </Text>
                )}
                {isSystemAdmin && selectedTenants.size > 0 && (
                  <Text size="2" color="gray">
                    • {selectedTenants.size} tenant(s)
                  </Text>
                )}
                {selectedSubscribers.size === 0 && selectedTenants.size === 0 && (
                  <Text size="2" color="red">
                    Please select at least one subscriber or tenant
                  </Text>
                )}
              </Box>
            </Flex>
            
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={selectedSubscribers.size === 0 && selectedTenants.size === 0}>
                Apply to Selected
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <AlertDialog.Root open={!!deletingLimit} onOpenChange={() => setDeletingLimit(null)}>
        <AlertDialog.Content>
          <AlertDialog.Title>Remove Handle Limit</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to remove the handle limit for{' '}
            <strong>{formatSubscriberName(deletingLimit?.SubscriberName, deletingLimit?.SubscriberEmail || '')}</strong>?
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
