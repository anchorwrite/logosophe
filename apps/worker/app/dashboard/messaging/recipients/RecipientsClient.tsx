'use client';

import { useState } from 'react';
import { Container, Heading, Text, Flex, Card, Button, Box, Table, Badge, TextField } from '@radix-ui/themes';

interface Recipient {
  Email: string;
  Name: string;
  TenantId: string;
  RoleId: string;
  IsOnline: boolean;
  IsBlocked: boolean;
  IsActive: boolean;
  IsBanned: boolean;
}

interface Tenant {
  Id: string;
  Name: string;
  UserCount: number;
}

interface RecipientsClientProps {
  initialUsers: Recipient[];
  initialTenants: Tenant[];
}

export function RecipientsClient({ initialUsers, initialTenants }: RecipientsClientProps) {
  const [users, setUsers] = useState<Recipient[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.Email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.Name && user.Name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTenant = selectedTenant === '' || user.TenantId === selectedTenant;
    
    const matchesStatus = selectedStatus === '' || 
      (selectedStatus === 'online' && user.IsOnline) ||
      (selectedStatus === 'offline' && !user.IsOnline) ||
      (selectedStatus === 'blocked' && user.IsBlocked);
    
    return matchesSearch && matchesTenant && matchesStatus;
  });

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="6" style={{ marginBottom: '0.5rem' }}>
          Messaging Recipients
        </Heading>
        <Text color="gray" size="3">
          View and manage available messaging recipients
        </Text>
      </Box>

      {/* Search and Filters */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            Search & Filters
          </Heading>
          <Flex gap="4" wrap="wrap">
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" style={{ marginBottom: '0.5rem' }}>Search Recipients</Text>
              <TextField.Root>
                <TextField.Input 
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </TextField.Root>
            </Box>
            <Box style={{ flex: '1', minWidth: '150px' }}>
              <Text size="2" style={{ marginBottom: '0.5rem' }}>Tenant</Text>
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--gray-6)',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">All Tenants</option>
                {initialTenants.map(tenant => (
                  <option key={tenant.Id} value={tenant.Id}>
                    {tenant.Name} ({tenant.UserCount})
                  </option>
                ))}
              </select>
            </Box>
            <Box style={{ flex: '1', minWidth: '150px' }}>
              <Text size="2" style={{ marginBottom: '0.5rem' }}>Status</Text>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--gray-6)',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="blocked">Blocked</option>
              </select>
            </Box>
            <Box style={{ display: 'flex', alignItems: 'end' }}>
              <Button>Search</Button>
            </Box>
          </Flex>
        </Box>
      </Card>

      {/* Recipients Table */}
      <Card>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            Available Recipients ({filteredUsers.length})
          </Heading>
          
          {filteredUsers.length === 0 ? (
            <Box style={{ textAlign: 'center', padding: '2rem' }}>
              <Text color="gray">No recipients found</Text>
            </Box>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>User</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Tenant</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredUsers.map((user) => (
                  <Table.Row key={`${user.Email}-${user.TenantId}`}>
                    <Table.Cell>
                      <Box>
                        <Text weight="medium" style={{ marginBottom: '0.25rem' }}>
                          {user.Name || 'Unknown User'}
                        </Text>
                        <Text size="2" color="gray">
                          {user.Email}
                        </Text>
                      </Box>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="soft">{user.TenantId}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">{user.RoleId || 'user'}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2" align="center">
                        <Badge 
                          variant={user.IsOnline ? 'solid' : 'soft'}
                          color={user.IsOnline ? 'green' : 'gray'}
                        >
                          {user.IsOnline ? 'Online' : 'Offline'}
                        </Badge>
                        {user.IsBlocked && (
                          <Badge color="red">Blocked</Badge>
                        )}
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2">
                        <Button size="1" variant="soft">
                          Message
                        </Button>
                        <Button size="1" variant="soft">
                          View Profile
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

      {/* Recipient Statistics */}
      <Card style={{ marginTop: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            Recipient Statistics
          </Heading>
          <Flex gap="4" wrap="wrap">
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Total Recipients</Text>
              <Heading size="3">{users.length}</Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Online Users</Text>
              <Heading size="3">
                {users.filter(u => u.IsOnline).length}
              </Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Blocked Users</Text>
              <Heading size="3">
                {users.filter(u => u.IsBlocked).length}
              </Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Active Tenants</Text>
              <Heading size="3">
                {new Set(users.map(u => u.TenantId)).size}
              </Heading>
            </Box>
          </Flex>
        </Box>
      </Card>
    </Container>
  );
} 