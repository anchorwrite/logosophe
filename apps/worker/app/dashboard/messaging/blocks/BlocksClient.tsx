'use client';

import { useState } from 'react';
import { Container, Heading, Text, Flex, Card, Button, Box, Table, Badge, TextField, Dialog } from '@radix-ui/themes';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

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
  const { showToast } = useToast();
  const [blocks, setBlocks] = useState<UserBlock[]>(initialBlocks);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<UserBlock | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<UserBlock | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredBlocks = blocks.filter(block => {
    const matchesSearch = searchTerm === '' || 
      block.BlockerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      block.BlockedEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (block.BlockerUserName && block.BlockerUserName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (block.BlockedUserName && block.BlockedUserName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTenant = selectedTenant === '' || block.TenantId === selectedTenant;
    
    return matchesSearch && matchesTenant;
  });

  const handleDeleteBlock = async (block: UserBlock) => {
    setBlockToDelete(block);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!blockToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/messaging/blocks/${blockToDelete.Id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove the block from local state
        setBlocks(prevBlocks => prevBlocks.filter(block => block.Id !== blockToDelete.Id));
        setShowDeleteDialog(false);
        setBlockToDelete(null);
        
        // Show success toast
        showToast({
          type: 'success',
          title: 'Block Deleted',
          content: 'User block has been removed successfully'
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete block' })) as { error?: string };
        showToast({
          type: 'error',
          title: 'Delete Failed',
          content: `Error deleting block: ${errorData.error || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('Error deleting block:', error);
      showToast({
        type: 'error',
        title: 'Delete Error',
        content: 'Error deleting block. Please try again.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
                        <Text weight="medium" style={{ marginBottom: '0.25rem', display: 'block' }}>
                          {block.BlockerUserName || block.BlockerEmail}
                        </Text>
                        <Text size="2" color="gray" style={{ display: 'block' }}>
                          ({block.BlockerEmail})
                        </Text>
                      </Box>
                    </Table.Cell>
                    <Table.Cell>
                      <Box>
                        <Text weight="medium" style={{ marginBottom: '0.25rem', display: 'block' }}>
                          {block.BlockedUserName || block.BlockedEmail}
                        </Text>
                        <Text size="2" color="gray" style={{ display: 'block' }}>
                          ({block.BlockedEmail})
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
                        <Button 
                          size="1" 
                          variant="soft" 
                          color="red"
                          onClick={() => handleDeleteBlock(block)}
                        >
                          Remove Block
                        </Button>
                        <Button 
                          size="1" 
                          variant="soft"
                          onClick={() => {
                            setSelectedBlock(block);
                            setShowDetailsDialog(true);
                          }}
                        >
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

      {/* Block Details Dialog */}
      <Dialog.Root open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <Dialog.Content>
          <Dialog.Title>Block Details</Dialog.Title>
          {selectedBlock && (
            <Box style={{ padding: '1rem 0' }}>
              <Flex direction="column" gap="3">
                <Box>
                  <Text weight="medium" size="2" style={{ marginBottom: '0.5rem', display: 'block' }}>Blocker</Text>
                  <Text size="2" style={{ marginBottom: '0.25rem', display: 'block' }}>
                    {selectedBlock.BlockerUserName || selectedBlock.BlockerEmail}
                  </Text>
                  <Text size="1" color="gray">
                    ({selectedBlock.BlockerEmail})
                  </Text>
                </Box>
                <Box>
                  <Text weight="medium" size="2" style={{ marginBottom: '0.5rem', display: 'block' }}>Blocked User</Text>
                  <Text size="2" style={{ marginBottom: '0.25rem', display: 'block' }}>
                    {selectedBlock.BlockedUserName || selectedBlock.BlockedEmail}
                  </Text>
                  <Text size="1" color="gray">
                    ({selectedBlock.BlockedEmail})
                  </Text>
                </Box>
                <Box>
                  <Text weight="medium" size="2" style={{ marginBottom: '0.5rem', display: 'block' }}>Tenant</Text>
                  <Badge variant="soft">{selectedBlock.TenantId}</Badge>
                </Box>
                <Box>
                  <Text weight="medium" size="2" style={{ marginBottom: '0.5rem', display: 'block' }}>Reason</Text>
                  <Text size="2">{selectedBlock.Reason || 'No reason provided'}</Text>
                </Box>
                <Box>
                  <Text weight="medium" size="2" style={{ marginBottom: '0.5rem', display: 'block' }}>Date Created</Text>
                  <Text size="2">{new Date(selectedBlock.CreatedAt).toLocaleString()}</Text>
                </Box>
                <Box>
                  <Text weight="medium" size="2" style={{ marginBottom: '0.5rem', display: 'block' }}>Status</Text>
                  <Badge color={selectedBlock.IsActive ? 'red' : 'gray'}>
                    {selectedBlock.IsActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Box>
              </Flex>
            </Box>
          )}
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <Dialog.Content>
          <Dialog.Title>Confirm Block Removal</Dialog.Title>
          {blockToDelete && (
            <Box style={{ padding: '1rem 0' }}>
              <Text size="2" style={{ marginBottom: '1rem' }}>
                Are you sure you want to remove the block for{' '}
                <Text weight="medium">{blockToDelete.BlockedUserName || blockToDelete.BlockedEmail}</Text>
                {' '}in tenant <Badge variant="soft">{blockToDelete.TenantId}</Badge>?
              </Text>
              <Text size="2" color="gray">
                This action cannot be undone.
              </Text>
            </Box>
          )}
          <Flex gap="3" justify="end">
            <Button 
              variant="soft" 
              onClick={() => {
                setShowDeleteDialog(false);
                setBlockToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              color="red" 
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Removing...' : 'Remove Block'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Container>
  );
} 