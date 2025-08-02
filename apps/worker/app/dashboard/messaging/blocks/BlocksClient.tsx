'use client';

import { useState } from 'react';
import { Container, Heading, Text, Flex, Card, Button, Box, Table, Badge, TextField } from '@radix-ui/themes';
import Link from 'next/link';

interface UserBlock {
  Id: number;
  BlockerEmail: string;
  BlockedEmail: string;
  TenantId: string;
  Reason: string;
  CreatedAt: string;
  IsActive: boolean;
  BlockerUserName: string;
  BlockedUserName: string;
}

interface BlocksClientProps {
  initialBlocks: UserBlock[];
  accessibleTenants: string[];
}

export function BlocksClient({ initialBlocks, accessibleTenants }: BlocksClientProps) {
  const [blocks, setBlocks] = useState<UserBlock[]>(initialBlocks);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');

  const filteredBlocks = blocks.filter(block => {
    const matchesSearch = searchTerm === '' || 
      block.BlockerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      block.BlockedEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (block.BlockerUserName && block.BlockerUserName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (block.BlockedUserName && block.BlockedUserName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTenant = selectedTenant === '' || block.TenantId === selectedTenant;
    
    return matchesSearch && matchesTenant;
  });

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              User Blocks
            </Heading>
            <Text color="gray" size="3">
              Manage user blocking relationships and view block history
            </Text>
          </Box>
          <Button asChild>
            <Link href="/dashboard/messaging/blocks/create">
              Create Block
            </Link>
          </Button>
        </Flex>
      </Box>

      {/* Search and Filters */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            Search & Filters
          </Heading>
          <Flex gap="4" wrap="wrap">
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" style={{ marginBottom: '0.5rem' }}>Search Users</Text>
              <TextField.Root>
                <TextField.Input 
                  placeholder="Search by email or name..."
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
                {accessibleTenants.map(tenantId => (
                  <option key={tenantId} value={tenantId}>{tenantId}</option>
                ))}
              </select>
            </Box>
            <Box style={{ display: 'flex', alignItems: 'end' }}>
              <Button>Search</Button>
            </Box>
          </Flex>
        </Box>
      </Card>

      {/* Blocks Table */}
      <Card>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            Active Blocks ({filteredBlocks.length})
          </Heading>
          
          {filteredBlocks.length === 0 ? (
            <Box style={{ textAlign: 'center', padding: '2rem' }}>
              <Text color="gray">No active blocks found</Text>
            </Box>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Blocker</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Blocked User</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Tenant</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Reason</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredBlocks.map((block) => (
                  <Table.Row key={block.Id}>
                    <Table.Cell>
                      <Box>
                        <Text weight="medium" style={{ marginBottom: '0.25rem' }}>
                          {block.BlockerUserName || block.BlockerEmail}
                        </Text>
                        <Text size="2" color="gray">
                          {block.BlockerEmail}
                        </Text>
                      </Box>
                    </Table.Cell>
                    <Table.Cell>
                      <Box>
                        <Text weight="medium" style={{ marginBottom: '0.25rem' }}>
                          {block.BlockedUserName || block.BlockedEmail}
                        </Text>
                        <Text size="2" color="gray">
                          {block.BlockedEmail}
                        </Text>
                      </Box>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="soft">{block.TenantId}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" style={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {block.Reason || 'No reason provided'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2">
                        {new Date(block.CreatedAt).toLocaleDateString()}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2">
                        <Button size="1" variant="soft" color="red">
                          Remove Block
                        </Button>
                        <Button size="1" variant="soft">
                          View Details
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

      {/* Block Statistics */}
      <Card style={{ marginTop: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            Block Statistics
          </Heading>
          <Flex gap="4" wrap="wrap">
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Total Active Blocks</Text>
              <Heading size="3">{blocks.length}</Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Unique Blockers</Text>
              <Heading size="3">
                {new Set(blocks.map(b => b.BlockerEmail)).size}
              </Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Unique Blocked Users</Text>
              <Heading size="3">
                {new Set(blocks.map(b => b.BlockedEmail)).size}
              </Heading>
            </Box>
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" color="gray">Tenants with Blocks</Text>
              <Heading size="3">
                {new Set(blocks.map(b => b.TenantId)).size}
              </Heading>
            </Box>
          </Flex>
        </Box>
      </Card>
    </Container>
  );
} 