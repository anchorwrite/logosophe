'use client';

import { useState, useEffect } from 'react';
import { Table, Button, Text, Flex, Box, Checkbox, Popover } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import { ChevronDown } from 'lucide-react';

interface TenantUser {
  Email: string;
  UserName: string;
  RoleId?: string;
  RoleName?: string;
  Roles?: {
    Id: string;
    Name: string;
  }[];
}

interface Role {
  Id: string;
  Name: string;
}

interface TenantUserListProps {
  tenantId: string;
}

export function TenantUserList({ tenantId }: TenantUserListProps) {
  const { showToast } = useToast();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>([]);

  const [editingUserEmail, setEditingUserEmail] = useState<string | null>(null);
  const [editingUserRoles, setEditingUserRoles] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      // Fetch tenant users
      const usersResponse = await fetch(`/api/tenant/${tenantId}/users`);
      if (!usersResponse.ok) throw new Error('Failed to fetch tenant users');
      const usersData = await usersResponse.json() as { results: TenantUser[] };
      
      // Process the results to group roles by user and ensure proper data structure
      const processedUsers = usersData.results.reduce((acc: TenantUser[], user) => {
        const existingUser = acc.find(u => u.Email === user.Email);
        if (existingUser && user.RoleId && user.RoleName) {
          existingUser.Roles = [...(existingUser.Roles || []), { Id: user.RoleId, Name: user.RoleName }];
        } else if (user.RoleId && user.RoleName) {
          acc.push({
            Email: user.Email,
            UserName: user.UserName || user.Email.split('@')[0], // Fallback to email username if no name
            Roles: [{ Id: user.RoleId, Name: user.RoleName }]
          });
        }
        return acc;
      }, []);
      
      setUsers(processedUsers);

      // Fetch available roles
      const rolesResponse = await fetch('/api/roles');
      if (!rolesResponse.ok) throw new Error('Failed to fetch roles');
      const rolesData = await rolesResponse.json() as { results: Role[] };
      setRoles(rolesData.results || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast({
        title: 'Error',
        content: 'Failed to load data',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || newUserRoles.length === 0) return;

    try {
      const addedRoles: string[] = [];
      const skippedRoles: string[] = [];

      // Add each role individually
      for (const roleId of newUserRoles) {
        const response = await fetch(`/api/tenant/${tenantId}/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Email: newUserEmail,
            RoleId: roleId,
          }),
        });

        if (!response.ok) {
          const error = await response.json() as { error?: string; message?: string };
          if (error.message?.includes('already has this role')) {
            skippedRoles.push(roleId);
            continue;
          }
          throw new Error(error.error || error.message || `Failed to add role ${roleId}`);
        }
        addedRoles.push(roleId);
      }

      // Show appropriate success message
      if (addedRoles.length > 0) {
        showToast({
          title: 'Success',
          content: `Added ${addedRoles.length} role${addedRoles.length === 1 ? '' : 's'}${skippedRoles.length > 0 ? ` (${skippedRoles.length} role${skippedRoles.length === 1 ? '' : 's'} already assigned)` : ''}`,
          type: 'success'
        });
      } else if (skippedRoles.length > 0) {
        showToast({
          title: 'Info',
          content: `User already has all selected roles`,
          type: 'info'
        });
      }

      setNewUserEmail('');
      setNewUserRoles([]);
      fetchData();
    } catch (error) {
      console.error('Error adding user:', error);
      showToast({
        title: 'Error',
        content: error instanceof Error ? error.message : 'Failed to add user',
        type: 'error'
      });
    }
  };

  const handleRemoveUser = async (email: string) => {
    try {
      const response = await fetch(`/api/tenant/${tenantId}/users/${email}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || 'Failed to remove user');
      }

      showToast({
        title: 'Success',
        content: 'User removed successfully',
        type: 'success'
      });
      fetchData();
    } catch (error) {
      console.error('Error removing user:', error);
      showToast({
        title: 'Error',
        content: error instanceof Error ? error.message : 'Failed to remove user',
        type: 'error'
      });
    }
  };

  const handleUpdateRoles = async (email: string, newRoleIds: string[]) => {
    try {
      const user = users.find(u => u.Email === email);
      if (!user) return;

      const currentRoleIds = user.Roles?.map(r => r.Id) || [];
      
      // Find roles to add and remove
      const rolesToAdd = newRoleIds.filter(id => !currentRoleIds.includes(id));
      const rolesToRemove = currentRoleIds.filter(id => !newRoleIds.includes(id));

      // Add new roles
      for (const roleId of rolesToAdd) {
        const response = await fetch(`/api/tenant/${tenantId}/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Email: email,
            RoleId: roleId,
          }),
        });

        if (!response.ok) {
          const error = await response.json() as { error?: string };
          throw new Error(error.error || `Failed to add role ${roleId}`);
        }
      }

      // Remove old roles
      for (const roleId of rolesToRemove) {
        const response = await fetch(`/api/tenant/${tenantId}/users/${email}/roles/${roleId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.json() as { error?: string };
          throw new Error(error.error || `Failed to remove role ${roleId}`);
        }
      }

      showToast({
        title: 'Success',
        content: 'Roles updated successfully',
        type: 'success'
      });
      setEditingUserEmail(null);
      fetchData();
    } catch (error) {
      console.error('Error updating roles:', error);
      showToast({
        title: 'Error',
        content: error instanceof Error ? error.message : 'Failed to update roles',
        type: 'error'
      });
    }
  };

  const handleRoleSelect = (roleId: string, checked: boolean) => {
    if (checked) {
      setNewUserRoles(prev => [...prev, roleId]);
    } else {
      setNewUserRoles(prev => prev.filter(id => id !== roleId));
    }
  };

  const handleEditRoleSelect = (roleId: string, checked: boolean) => {
    if (checked) {
      setEditingUserRoles(prev => [...prev, roleId]);
    } else {
      setEditingUserRoles(prev => prev.filter(id => id !== roleId));
    }
  };

  const startEditing = (user: TenantUser) => {
    setEditingUserEmail(user.Email);
    setEditingUserRoles(user.Roles?.map(r => r.Id) || []);
  };

  if (isLoading) {
    return <Text>Loading users...</Text>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddUser} className="space-y-4">
        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Add User
          </Text>
          <Flex gap="2">
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="Enter user email"
              required
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <Popover.Root>
              <Popover.Trigger>
                <Button variant="soft" type="button">
                  <Flex align="center" gap="2">
                    <Text size="2">
                      {newUserRoles.length > 0
                        ? `${newUserRoles.length} role${newUserRoles.length === 1 ? '' : 's'} selected`
                        : 'Select roles'}
                    </Text>
                    <ChevronDown className="w-4 h-4" />
                  </Flex>
                </Button>
              </Popover.Trigger>
              <Popover.Content>
                <Box p="2" style={{ minWidth: '200px' }}>
                  <Text size="2" weight="bold" mb="2">Select Roles:</Text>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {roles.map((role) => (
                      <Flex key={role.Id} align="center" gap="2" p="1">
                        <Checkbox
                          checked={newUserRoles.includes(role.Id)}
                          onCheckedChange={(checked) => handleRoleSelect(role.Id, checked as boolean)}
                        />
                        <Text size="2">{role.Name}</Text>
                      </Flex>
                    ))}
                  </div>
                </Box>
              </Popover.Content>
            </Popover.Root>
            <Button type="submit">Add User</Button>
          </Flex>
        </Box>
      </form>

      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>User</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Roles</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {users.map((user) => (
            <Table.Row key={`row-${user.Email}`}>
              <Table.Cell>
                <Flex gap="2" align="center">
                  <Text>{user.UserName}</Text>
                  <Text size="1" color="gray">({user.Email})</Text>
                </Flex>
              </Table.Cell>
              <Table.Cell>
                {editingUserEmail === user.Email ? (
                  <div>
                    <Popover.Root>
                      <Popover.Trigger>
                        <Button variant="soft" size="1" type="button">
                          <Flex align="center" gap="2">
                            <Text size="2">
                              {editingUserRoles.length > 0
                                ? `${editingUserRoles.length} role${editingUserRoles.length === 1 ? '' : 's'} selected`
                                : 'Select roles'}
                            </Text>
                            <ChevronDown className="w-4 h-4" />
                          </Flex>
                        </Button>
                      </Popover.Trigger>
                      <Popover.Content>
                        <Box p="2" style={{ minWidth: '200px' }}>
                          <Text size="2" weight="bold" mb="2">Select Roles:</Text>
                          <div className="space-y-1 max-h-40 overflow-auto">
                            {roles.map((role) => (
                              <Flex key={`edit-role-${user.Email}-${role.Id}`} align="center" gap="2" p="1">
                                <Checkbox
                                  checked={editingUserRoles.includes(role.Id)}
                                  onCheckedChange={(checked) => handleEditRoleSelect(role.Id, checked as boolean)}
                                />
                                <Text size="2">{role.Name}</Text>
                              </Flex>
                            ))}
                          </div>
                        </Box>
                      </Popover.Content>
                    </Popover.Root>
                    <Flex gap="2" mt="2">
                      <Button 
                        size="1" 
                        onClick={() => handleUpdateRoles(user.Email, editingUserRoles)}
                      >
                        Save
                      </Button>
                      <Button 
                        size="1" 
                        variant="soft" 
                        onClick={() => {
                          setEditingUserEmail(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </Flex>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button 
                      size="1" 
                      variant="soft" 
                      onClick={() => startEditing(user)}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </Table.Cell>
              <Table.Cell>
                <Button
                  variant="soft"
                  color="red"
                  onClick={() => handleRemoveUser(user.Email)}
                >
                  Remove
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  );
} 