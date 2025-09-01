'use client';

import { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, Button, Card, Badge, TextField, Select, Dialog } from '@radix-ui/themes';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast';

interface BlockedUser {
  Id: number;
  BlockerEmail: string;
  BlockedEmail: string;
  TenantId: string;
  BlockedAt: string;
  IsActive: boolean;
  BlockedUserName?: string;
  BlockedUserEmail: string;
}

interface UserToBlock {
  Email: string;
  Name?: string;
  TenantId: string;
}

export function HarborBlocksClient({ lang }: { lang: string }) {
  const { t } = useTranslation('translations');
  const { showToast } = useToast();
  const router = useRouter();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserToBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<UserToBlock[]>([]);

  // Format date with proper timezone handling
  const formatDate = (dateString: string) => {
    // Ensure proper timezone handling by explicitly parsing the date
    let date: Date;
    
    // Handle different date string formats
    if (dateString.includes('T')) {
      // ISO format (e.g., "2025-01-15T10:30:00.000Z")
      date = new Date(dateString);
    } else if (dateString.includes(' ')) {
      // SQLite datetime format (e.g., "2025-01-15 10:30:00")
      // Convert to ISO format for proper timezone handling
      const isoString = dateString.replace(' ', 'T') + '.000Z';
      date = new Date(isoString);
    } else {
      // Fallback
      date = new Date(dateString);
    }
    
    return date.toLocaleDateString([], {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  // Fetch blocked users
  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  // Fetch available users to block
  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  // Filter users based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(availableUsers);
    } else {
      const filtered = availableUsers.filter(user => 
        user.Email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.Name && user.Name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, availableUsers]);

  const fetchBlockedUsers = async () => {
    try {
      const response = await fetch('/api/harbor/messaging/blocks');
      if (response.ok) {
        const data = await response.json() as { success: boolean; blocks: BlockedUser[] };
        setBlockedUsers(data.blocks || []);
      }
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await fetch('/api/harbor/messaging/recipients');
      if (response.ok) {
        const data = await response.json() as { success: boolean; recipients: UserToBlock[] };
        setAvailableUsers(data.recipients || []);
      }
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;

    setIsBlocking(true);
    try {
      const response = await fetch('/api/harbor/messaging/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedEmail: selectedUser })
      });

      if (response.ok) {
        // Refresh the lists
        await fetchBlockedUsers();
        await fetchAvailableUsers();
        setShowBlockDialog(false);
        setSelectedUser('');
      } else {
        const errorData = await response.json() as { error: string };
        showToast({
          type: 'error',
          title: 'Error',
          content: `Error blocking user: ${errorData.error}`
        });
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Error blocking user'
      });
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblockUser = async (blockId: number) => {
    try {
      const response = await fetch(`/api/harbor/messaging/blocks/${blockId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh the lists
        await fetchBlockedUsers();
        await fetchAvailableUsers();
      } else {
        const errorData = await response.json() as { error: string };
        showToast({
          type: 'error',
          title: 'Error',
          content: `Error unblocking user: ${errorData.error}`
        });
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Error unblocking user'
      });
    }
  };

  if (isLoading) {
    return (
      <Box style={{ padding: '2rem' }}>
        <Text>Loading blocked users...</Text>
      </Box>
    );
  }

  return (
    <Box style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <Flex justify="between" align="center" style={{ marginBottom: '2rem' }}>
        <Heading size="4">Blocked Users</Heading>
        <Flex gap="2">
          <Button 
            variant="soft" 
            onClick={() => router.push(`/${lang}/harbor/messaging`)}
          >
            Back to Messaging
          </Button>
          <Button 
            onClick={() => setShowBlockDialog(true)}
            disabled={availableUsers.length === 0}
          >
            Block New User
          </Button>
        </Flex>
      </Flex>

      {/* Blocked Users List */}
      <Card size="3" style={{ marginBottom: '2rem' }}>
        <Box style={{ padding: '1.5rem' }}>
          <Heading size="3" style={{ marginBottom: '1rem' }}>
            Currently Blocked Users ({blockedUsers.length})
          </Heading>
          
          {blockedUsers.length === 0 ? (
            <Text color="gray">No users are currently blocked.</Text>
          ) : (
            <Flex direction="column" gap="2">
              {blockedUsers.map((block) => (
                <Flex 
                  key={block.Id} 
                  justify="between" 
                  align="center" 
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--gray-6)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--gray-2)'
                  }}
                >
                  <Box>
                    <Flex align="center" gap="2" style={{ marginBottom: '0.5rem' }}>
                      <Text size="2" weight="medium">
                        {block.BlockedUserName || block.BlockedUserEmail}
                      </Text>
                      <Badge size="1" variant="soft">{block.TenantId}</Badge>
                      <Text size="1" color="gray">
                        Blocked on {formatDate(block.BlockedAt)}
                      </Text>
                    </Flex>
                    <Text size="1" color="gray">
                      {block.BlockedUserEmail}
                    </Text>
                  </Box>
                  <Button 
                    size="1" 
                    variant="soft" 
                    color="red"
                    onClick={() => handleUnblockUser(block.Id)}
                  >
                    Unblock
                  </Button>
                </Flex>
              ))}
            </Flex>
          )}
        </Box>
      </Card>

      {/* Block New User Dialog */}
      <Dialog.Root open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <Dialog.Content style={{ maxWidth: '500px' }}>
          <Dialog.Title>Block User</Dialog.Title>
          <Dialog.Description>
            Blocking a user will prevent you from sending messages to them and receiving messages from them.
          </Dialog.Description>

          <Box style={{ marginTop: '1rem' }}>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Search Users
            </Text>
            <TextField.Root style={{ marginBottom: '1rem' }}>
              <TextField.Input 
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </TextField.Root>
            
            {filteredUsers.length > 0 && (
              <Box style={{ marginBottom: '1rem' }}>
                <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                  Select User to Block
                </Text>
                <Select.Root value={selectedUser} onValueChange={setSelectedUser}>
                  <Select.Trigger placeholder="Choose a user..." />
                  <Select.Content>
                    {filteredUsers.map((user) => (
                      <Select.Item key={user.Email} value={user.Email}>
                        {user.Name ? `${user.Name} (${user.Email})` : user.Email}
                        <Badge size="1" variant="soft" style={{ marginLeft: '0.5rem' }}>
                          {user.TenantId}
                        </Badge>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>
            )}

            {searchTerm && filteredUsers.length === 0 && (
              <Text size="1" color="gray">No users found matching your search.</Text>
            )}
          </Box>

          <Flex gap="3" justify="end" style={{ marginTop: '1.5rem' }}>
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button 
              onClick={handleBlockUser}
              disabled={!selectedUser || isBlocking}
            >
              {isBlocking ? 'Blocking...' : 'Block User'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
