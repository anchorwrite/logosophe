'use client';

import { useState } from 'react';
import { Container, Heading, Text, Flex, Card, Button, Box, TextField, Select, Checkbox } from '@radix-ui/themes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface TenantUser {
  Email: string;
  Name: string;
  Role: string;
  TenantId: string;
}

interface CreateBlockClientProps {
  accessibleTenants: string[];
  tenantUsers: TenantUser[];
  currentUserEmail: string;
}

export function CreateBlockClient({ accessibleTenants, tenantUsers, currentUserEmail }: CreateBlockClientProps) {
  const [blockAllTenants, setBlockAllTenants] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setError('Please select a user to block');
      return;
    }
    if (selectedUser === currentUserEmail) {
      setError('You cannot block yourself');
      return;
    }
    if (!blockAllTenants && !selectedTenant) {
      setError('Please select a tenant or enable "Block across all tenants"');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      if (blockAllTenants) {
        // Block user across all accessible tenants with retry logic
        const results = [];
        const errors = [];
        
        for (const tenantId of accessibleTenants) {
          try {
            console.log(`Attempting to block user in tenant: ${tenantId}`);
            const response = await fetch('/api/messages/blocks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                blockedEmail: selectedUser,
                tenantId: tenantId,
                reason: reason.trim() || null,
              }),
            });
            
            console.log(`Response for tenant ${tenantId}: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
              results.push({ tenantId, success: true });
            } else {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
              errors.push({ tenantId, error: errorData.error || `HTTP ${response.status}` });
            }
            
            // Add a small delay between requests to avoid overwhelming the server
            if (accessibleTenants.indexOf(tenantId) < accessibleTenants.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (err) {
            console.error(`Error blocking user in tenant ${tenantId}:`, err);
            errors.push({ tenantId, error: 'Network error' });
          }
        }
        
        if (errors.length === 0) {
          // All blocks were created successfully
          setSuccess(true);
          setTimeout(() => { router.push('/dashboard/messaging/blocks'); }, 2000);
        } else {
          // Some blocks failed
          setError(`Failed to create ${errors.length} out of ${accessibleTenants.length} blocks. ${results.length} blocks were created successfully.`);
        }
      } else {
        // Block user in specific tenant
        const response = await fetch('/api/messages/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockedEmail: selectedUser,
            tenantId: selectedTenant,
            reason: reason.trim() || null,
          }),
        });
        
        const result = await response.json() as { success: boolean; error?: string };
        if (response.ok && result.success) {
          setSuccess(true);
          setTimeout(() => { router.push('/dashboard/messaging/blocks'); }, 2000);
        } else {
          setError(result.error || 'Failed to create block');
        }
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTenantChange = (value: string) => {
    setSelectedTenant(value);
    setSelectedUser('');
  };

  const handleBlockAllTenantsChange = (checked: boolean | 'indeterminate') => {
    setBlockAllTenants(checked === true);
    if (checked === true) {
      setSelectedTenant('');
    }
    setSelectedUser('');
  };

  if (success) {
    return (
      <Container size="3">
        <Card style={{ marginTop: '2rem' }}>
          <Box style={{ padding: '2rem', textAlign: 'center' }}>
            <Heading size="4" color="green" style={{ marginBottom: '1rem' }}>
              Block Created Successfully
            </Heading>
            <Text color="gray" style={{ marginBottom: '1.5rem' }}>
              {blockAllTenants 
                ? `The user has been blocked across ${accessibleTenants.length} tenants. Redirecting to blocks list...`
                : 'The user has been blocked. Redirecting to blocks list...'
              }
            </Text>
            <Button asChild>
              <Link href="/dashboard/messaging/blocks">Go to Blocks List</Link>
            </Button>
          </Box>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              Create User Block
            </Heading>
            <Text color="gray" size="3">
              Block a user from sending messages within specific tenant(s)
            </Text>
          </Box>
          <Button variant="soft" asChild>
            <Link href="/dashboard/messaging/blocks">Back to Blocks</Link>
          </Button>
        </Flex>
      </Box>

      <Card>
        <Box style={{ padding: '1.5rem' }}>
          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="4">
              <Box>
                <Flex align="center" gap="3" style={{ marginBottom: '1rem' }}>
                  <Checkbox
                    checked={blockAllTenants}
                    onCheckedChange={handleBlockAllTenantsChange}
                  />
                  <Text size="2" weight="medium">
                    Block across all accessible tenants
                  </Text>
                </Flex>
                <Text size="1" color="gray">
                  When enabled, the user will be blocked in all tenants you have access to
                </Text>
              </Box>

              {!blockAllTenants && (
                <Box>
                  <Text size="2" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
                    Select Tenant *
                  </Text>
                  <Select.Root value={selectedTenant} onValueChange={handleTenantChange}>
                    <Select.Trigger placeholder="Choose a tenant..." />
                    <Select.Content>
                      {accessibleTenants.map(tenantId => (
                        <Select.Item key={tenantId} value={tenantId}>{tenantId}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                  <Text size="1" color="gray" style={{ marginTop: '0.25rem' }}>
                    Choose the tenant where the block will apply
                  </Text>
                </Box>
              )}

              <Box>
                <Text size="2" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Select User to Block *
                </Text>
                <Select.Root 
                  value={selectedUser} 
                  onValueChange={setSelectedUser} 
                  disabled={!blockAllTenants && !selectedTenant}
                >
                  <Select.Trigger 
                    placeholder={
                      blockAllTenants 
                        ? "Choose a user to block across all tenants..." 
                        : selectedTenant 
                          ? "Choose a user..." 
                          : "Select a tenant first"
                    } 
                  />
                  <Select.Content>
                    {tenantUsers.map(user => (
                      <Select.Item key={user.Email} value={user.Email}>
                        {user.Name || user.Email} ({user.Role}) - {user.TenantId}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                <Text size="1" color="gray" style={{ marginTop: '0.25rem' }}>
                  {blockAllTenants 
                    ? `All users across ${accessibleTenants.length} accessible tenants (excluding yourself)`
                    : selectedTenant 
                      ? `Users in ${selectedTenant} (excluding yourself)` 
                      : 'Select a tenant to see available users'
                  }
                </Text>
              </Box>

              <Box>
                <Text size="2" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Reason for Block (Optional)
                </Text>
                <TextField.Root>
                  <TextField.Input
                    placeholder="Enter a reason for blocking this user..."
                    value={reason}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
                  />
                </TextField.Root>
                <Text size="1" color="gray" style={{ marginTop: '0.25rem' }}>
                  Providing a reason helps with record keeping and future reference
                </Text>
              </Box>

              {error && (
                <Box style={{ padding: '0.75rem', backgroundColor: 'var(--red-3)', borderRadius: '4px' }}>
                  <Text color="red" size="2">{error}</Text>
                </Box>
              )}

              <Flex gap="3" style={{ marginTop: '1rem' }}>
                <Button
                  type="submit"
                  disabled={isSubmitting || !selectedUser || (!blockAllTenants && !selectedTenant)}
                  color="red"
                >
                  {isSubmitting 
                    ? (blockAllTenants ? 'Creating Blocks...' : 'Creating Block...') 
                    : (blockAllTenants ? 'Create Blocks Across All Tenants' : 'Create Block')
                  }
                </Button>
                <Button variant="soft" asChild>
                  <Link href="/dashboard/messaging/blocks">Cancel</Link>
                </Button>
              </Flex>
            </Flex>
          </form>
        </Box>
      </Card>

      <Card style={{ marginTop: '1.5rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>About User Blocks</Heading>
          <Flex direction="column" gap="2">
            <Text size="2" color="gray">• <strong>Blocked users cannot send messages</strong> to anyone in the specified tenant(s)</Text>
            <Text size="2" color="gray">• <strong>Single tenant blocks</strong> - apply only to the selected tenant</Text>
            <Text size="2" color="gray">• <strong>Multi-tenant blocks</strong> - apply to all accessible tenants at once</Text>
            <Text size="2" color="gray">• <strong>Blocks can be removed later</strong> from the blocks management page</Text>
            <Text size="2" color="gray">• <strong>System admins</strong> can block users across all tenants</Text>
            <Text size="2" color="gray">• <strong>Tenant admins</strong> can only block users within their own tenants</Text>
          </Flex>
        </Box>
      </Card>
    </Container>
  );
}
