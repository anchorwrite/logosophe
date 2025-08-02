'use client';

import { useState, useEffect } from 'react';
import { Box, Button, Card, Flex, Grid, Heading, Text, TextField, Dialog } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import { TenantAssignmentDialog } from './TenantAssignmentDialog';
import bcrypt from 'bcryptjs';

interface AdminUser {
  Email: string;
  Role: string;
  CreatedAt: string;
  UpdatedAt: string;
}

interface AdminUsersProps {
  initialUsers: AdminUser[];
}

interface ApiErrorResponse {
  message: string;
}

export default function AdminUsers({ initialUsers }: AdminUsersProps) {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [availableTenants, setAvailableTenants] = useState<Array<{ Id: string; Name: string }>>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; email: string | null }>({
    isOpen: false,
    email: null
  });
  const [tenantAssignmentDialog, setTenantAssignmentDialog] = useState<{ isOpen: boolean; email: string | null; role: string | null }>({
    isOpen: false,
    email: null,
    role: null
  });

  const handleCreate = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      // Validate email
      if (!newEmail || !newEmail.includes('@')) {
        setError('Please enter a valid email address');
        return;
      }

      // Validate password
      if (!password || password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const requestBody: any = { 
        email: newEmail, 
        role: newRole,
        password: hashedPassword 
      };

      // Add tenant assignments if this is a tenant admin
      if (newRole === 'tenant' && selectedTenants.length > 0) {
        requestBody.tenantIds = selectedTenants;
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json() as ApiErrorResponse;
        throw new Error(data.message || 'Failed to create user');
      }

      const newUser = await response.json() as AdminUser;
      setUsers(prev => [newUser, ...prev]);
      setSuccess('User created successfully');
      setNewEmail('');
      setPassword('');
      setConfirmPassword('');
      setSelectedTenants([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (email: string) => {
    setDeleteDialog({ isOpen: true, email });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.email) return;

    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch(`/api/admin/users/${encodeURIComponent(deleteDialog.email)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json() as ApiErrorResponse;
        throw new Error(data.message || 'Failed to delete user');
      }

      setUsers(prev => prev.filter(user => user.Email !== deleteDialog.email));
      setSuccess('User deleted successfully');
      setDeleteDialog({ isOpen: false, email: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (email: string, newRole: string) => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json() as ApiErrorResponse;
        throw new Error(data.message || 'Failed to update user role');
      }

      setUsers(prev => prev.map(user => 
        user.Email === email ? { ...user, Role: newRole } : user
      ));
      setSuccess('User role updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user role');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageTenants = (email: string, role: string) => {
    setTenantAssignmentDialog({ isOpen: true, email, role });
  };

  const handleTenantAssignmentSuccess = () => {
    setSuccess('Tenant assignments updated successfully');
  };

  // Fetch available tenants when role changes to tenant
  useEffect(() => {
    if (newRole === 'tenant') {
      fetchAvailableTenants();
    } else {
      setAvailableTenants([]);
      setSelectedTenants([]);
    }
  }, [newRole]);

  const fetchAvailableTenants = async () => {
    try {
      const response = await fetch('/api/tenant');
      if (!response.ok) {
        throw new Error('Failed to fetch tenants');
      }
      const data = await response.json() as { results?: Array<{ Id: string; Name: string }> };
      setAvailableTenants(data.results || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const handleTenantSelection = (tenantId: string, selected: boolean) => {
    if (selected) {
      setSelectedTenants(prev => [...prev, tenantId]);
    } else {
      setSelectedTenants(prev => prev.filter(id => id !== tenantId));
    }
  };

  return (
    <Box p="4">
      <Heading size="6" mb="4">Administrative Users Management</Heading>

      {error && (
        <Text color="red" mb="4">{error}</Text>
      )}
      {success && (
        <Text color="green" mb="4">{success}</Text>
      )}

      <Card mb="4">
        <Box p="4">
          <Heading size="4" mb="4">Add New Admin User</Heading>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}>
            <Grid columns="3" gap="4">
              <TextField.Root>
                <TextField.Input
                  placeholder="Email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </TextField.Root>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid var(--gray-7)'
                }}
                required
              >
                <option value="admin">Admin</option>
                <option value="tenant">Tenant</option>
              </select>
              <Button type="submit" disabled={isLoading}>
                Add User
              </Button>
            </Grid>
            <Grid columns="2" gap="4" mt="4">
              <TextField.Root>
                <TextField.Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </TextField.Root>
              <TextField.Root>
                <TextField.Input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </TextField.Root>
            </Grid>

            {/* Tenant Selection for Tenant Admin Users */}
            {newRole === 'tenant' && (
              <Box mt="4">
                <Text size="2" weight="bold" mb="2">
                  Assign to Tenants (Optional)
                </Text>
                <Text size="1" color="gray" mb="3">
                  Select the tenants this user should have access to. You can also assign tenants later.
                </Text>
                <Box style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--gray-6)', borderRadius: '4px', padding: '8px' }}>
                  {availableTenants.length === 0 ? (
                    <Box my="2">
                      <Text size="1" color="gray" align="center">
                        Loading tenants...
                      </Text>
                    </Box>
                  ) : (
                    availableTenants.map((tenant) => (
                      <Flex key={tenant.Id} align="center" gap="2" py="1">
                        <input
                          type="checkbox"
                          checked={selectedTenants.includes(tenant.Id)}
                          onChange={(e) => handleTenantSelection(tenant.Id, e.target.checked)}
                          style={{ margin: 0 }}
                        />
                        <Text size="1">{tenant.Name}</Text>
                      </Flex>
                    ))
                  )}
                </Box>
              </Box>
            )}
          </form>
        </Box>
      </Card>

      <Card>
        <Box p="4">
          <Heading size="4" mb="4">Existing Admin Users</Heading>
          <Grid columns="5" gap="4" style={{ fontWeight: 'bold', marginBottom: '1rem' }}>
            <Text>Email</Text>
            <Text>Role</Text>
            <Text>Created</Text>
            <Text>Actions</Text>
            <Text>Tenants</Text>
          </Grid>
          {users.map((user) => (
            <Grid key={user.Email} columns="5" gap="4" style={{ marginBottom: '1rem' }}>
              <Text>{user.Email}</Text>
              <select
                value={user.Role}
                onChange={(e) => handleUpdateRole(user.Email, e.target.value)}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid var(--gray-7)'
                }}
              >
                <option value="admin">Admin</option>
                <option value="tenant">Tenant</option>
              </select>
              <Text>{new Date(user.CreatedAt).toLocaleDateString()}</Text>
              <Flex gap="2">
                <Button
                  color="red"
                  onClick={() => handleDelete(user.Email)}
                  disabled={isLoading}
                >
                  Delete
                </Button>
              </Flex>
              <Flex gap="2">
                {user.Role === 'tenant' && (
                  <Button
                    variant="soft"
                    color="blue"
                    onClick={() => handleManageTenants(user.Email, user.Role)}
                    disabled={isLoading}
                  >
                    Manage Tenants
                  </Button>
                )}
                {user.Role === 'admin' && (
                  <Text size="1" color="gray">All tenants</Text>
                )}
              </Flex>
            </Grid>
          ))}
        </Box>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteDialog.isOpen} onOpenChange={(open) => setDeleteDialog({ isOpen: open, email: deleteDialog.email })}>
        <Dialog.Content style={{ 
          maxWidth: 450,
          width: '400px',
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          maxHeight: '70vh',
          overflow: 'auto',
          zIndex: 100000,
          backgroundColor: 'var(--color-panel-solid)',
          border: '1px solid var(--gray-6)',
          borderRadius: 'var(--radius-3)',
          boxShadow: 'var(--shadow-4)'
        }}>
          <Dialog.Title>Delete Admin User</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Are you sure you want to delete {deleteDialog.email}? This action cannot be undone.
          </Dialog.Description>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" disabled={isLoading}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              color="red"
              onClick={confirmDelete}
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete User'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Tenant Assignment Dialog */}
      <TenantAssignmentDialog
        isOpen={tenantAssignmentDialog.isOpen}
        onOpenChange={(open) => setTenantAssignmentDialog(prev => ({ ...prev, isOpen: open }))}
        userEmail={tenantAssignmentDialog.email || ''}
        userRole={tenantAssignmentDialog.role || ''}
        onSuccess={handleTenantAssignmentSuccess}
      />
    </Box>
  );
} 