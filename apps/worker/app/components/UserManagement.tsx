'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  Flex, 
  Grid, 
  Heading, 
  Text, 
  TextField, 
  Select,
  Table,
  Badge,
  Dialog,
  AlertDialog
} from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import { ChevronDown, ChevronUp, Search, Filter, LogOut, Shield, ShieldOff } from 'lucide-react';

interface UserInfo {
  email: string;
  name: string | null;
  provider: string;
  isSubscriber: boolean;
  hasSignedIn: boolean; // NEW: Whether user has ever signed in
  tenants: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  roles: string[];
  hasActiveSession: boolean;
  lastLogin: string | null;
  sessionDuration?: number;
  isBlocked: boolean;
  emailVerified: string | null;
  image: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UserManagementResponse {
  users: UserInfo[];
  pagination: Pagination;
}

interface Filters {
  search: string;
  tenantId: string;
  status: 'all' | 'active' | 'inactive' | 'blocked';
  role: string;
  subscriberStatus: 'all' | 'subscribers' | 'non-subscribers';
  signedInStatus: 'all' | 'signed-in' | 'never-signed-in';
  sortBy: 'email' | 'name' | 'lastLogin' | 'provider';
  sortOrder: 'asc' | 'desc';
}

export default function UserManagement() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState<Filters>({
    search: '',
    tenantId: '',
    status: 'all',
    role: '',
    subscriberStatus: 'all',
    signedInStatus: 'all',
    sortBy: 'email',
    sortOrder: 'asc'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: 'logout' | 'block' | 'unblock';
    user: UserInfo | null;
  }>({
    isOpen: false,
    action: 'logout',
    user: null
  });

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.tenantId && { tenantId: filters.tenantId }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.role && { role: filters.role }),
        ...(filters.subscriberStatus !== 'all' && { subscriberStatus: filters.subscriberStatus }),
        ...(filters.signedInStatus !== 'all' && { signedInStatus: filters.signedInStatus }),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      });

      const response = await fetch(`/api/user-management?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch users`);
      }

      const data: UserManagementResponse = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
      
      // Show a gentle message if no users found
      if (data.users.length === 0 && (filters.status !== 'all' || filters.subscriberStatus !== 'all' || filters.search)) {
        showToast({
          type: 'info',
          title: 'No Users Found',
          content: 'No users match the current filters. Try adjusting your search criteria.'
        });
      } else if (data.users.length === 0) {
        showToast({
          type: 'info',
          title: 'No Users Found',
          content: 'No users are currently assigned to your tenant(s).'
        });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast({
        type: 'error',
        title: 'Error Loading Users',
        content: error instanceof Error ? error.message : 'Failed to load users. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filters, pagination.page, pagination.limit]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filters change
  };

  const handleSort = (column: 'email' | 'name' | 'lastLogin' | 'provider') => {
    setFilters(prev => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleAction = async (action: 'logout' | 'block' | 'unblock', user: UserInfo) => {
    try {
      setIsActionLoading(`${action}-${user.email}`);
      
      const response = await fetch(`/api/user-management/${encodeURIComponent(user.email)}/${action}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || `Failed to ${action} user`);
      }

      const result = await response.json() as { message: string };
      
      showToast({
        type: 'success',
        title: 'Success',
        content: result.message
      });

      // Refresh the user list
      fetchUsers();
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      showToast({
        type: 'error',
        title: 'Error',
        content: error instanceof Error ? error.message : `Failed to ${action} user`
      });
    } finally {
      setIsActionLoading(null);
      setConfirmDialog({ isOpen: false, action: 'logout', user: null });
    }
  };

  const openConfirmDialog = (action: 'logout' | 'block' | 'unblock', user: UserInfo) => {
    setConfirmDialog({ isOpen: true, action, user });
  };

  const getSortIcon = (column: 'email' | 'name' | 'lastLogin' | 'provider') => {
    if (filters.sortBy !== column) return null;
    return filters.sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  const formatLastLogin = (lastLogin: string | null) => {
    if (!lastLogin) return 'Never';
    const date = new Date(lastLogin);
    return date.toLocaleString();
  };

  const getStatusBadge = (user: UserInfo) => {
    if (user.isBlocked) {
      return <Badge color="red">Blocked</Badge>;
    }
    if (user.hasActiveSession) {
      return <Badge color="green">Active</Badge>;
    }
    return <Badge color="gray">Inactive</Badge>;
  };

  const getSubscriberStatus = (user: UserInfo) => {
    return user.isSubscriber ? (
      <Flex align="center" gap="2">
        <Box style={{ color: 'var(--green-9)' }}>✅</Box>
        <Text size="2" weight="bold" color="green">Subscriber</Text>
      </Flex>
    ) : (
      <Flex align="center" gap="2">
        <Box style={{ color: 'var(--gray-9)' }}>❌</Box>
        <Text size="2" color="gray">Not Subscriber</Text>
      </Flex>
    );
  };

  const getSignedInStatus = (user: UserInfo) => {
    if (user.hasActiveSession) {
      return (
        <Flex align="center" gap="2">
          <Box style={{ color: 'var(--green-9)' }}>✅</Box>
          <Text size="2" weight="bold" color="green">Currently Signed In</Text>
        </Flex>
      );
    } else if (user.hasSignedIn) {
      return (
        <Flex align="center" gap="2">
          <Box style={{ color: 'var(--blue-9)' }}>📝</Box>
          <Text size="2" color="blue">Previously Signed In</Text>
        </Flex>
      );
    } else {
      return (
        <Flex align="center" gap="2">
          <Box style={{ color: 'var(--orange-9)' }}>⚠️</Box>
          <Text size="2" color="orange">Never Signed In</Text>
        </Flex>
      );
    }
  };

  return (
    <Box>
      <Heading size="6" mb="4">User Management</Heading>
      
      {/* Filters */}
      <Card mb="4">
        <Box p="4">
          <Heading size="4" mb="3">Filters</Heading>
                      <Grid columns="4" gap="4">
              <TextField.Root>
                <TextField.Input
                  placeholder="Search by email or name..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </TextField.Root>
              
              <Select.Root 
                value={filters.status} 
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <Select.Trigger placeholder="Status" />
                <Select.Content>
                  <Select.Item value="all">All Status</Select.Item>
                  <Select.Item value="active">Active</Select.Item>
                  <Select.Item value="inactive">Inactive</Select.Item>
                  <Select.Item value="blocked">Blocked</Select.Item>
                </Select.Content>
              </Select.Root>

              <Select.Root 
                value={filters.subscriberStatus} 
                onValueChange={(value) => handleFilterChange('subscriberStatus', value)}
              >
                <Select.Trigger placeholder="Subscriber Status" />
                <Select.Content>
                  <Select.Item value="all">All Users</Select.Item>
                  <Select.Item value="subscribers">Subscribers Only</Select.Item>
                  <Select.Item value="non-subscribers">Non-Subscribers Only</Select.Item>
                </Select.Content>
              </Select.Root>

              <Select.Root 
                value={filters.signedInStatus} 
                onValueChange={(value) => handleFilterChange('signedInStatus', value)}
              >
                <Select.Trigger placeholder="Signed In Status" />
                <Select.Content>
                  <Select.Item value="all">All Users</Select.Item>
                  <Select.Item value="signed-in">Signed In</Select.Item>
                  <Select.Item value="never-signed-in">Never Signed In</Select.Item>
                </Select.Content>
              </Select.Root>
            </Grid>
        </Box>
      </Card>

      {/* Users Table */}
      <Card>
        <Box p="4">
          {isLoading ? (
            <Flex justify="center" py="6">
              <Text>Loading users...</Text>
            </Flex>
          ) : users.length === 0 ? (
            <Flex direction="column" align="center" py="6" gap="3">
              <Text size="4" weight="bold" color="gray">No Users Found</Text>
              <Text color="gray" align="center">
                {filters.status !== 'all' || filters.subscriberStatus !== 'all' || filters.search 
                  ? 'No users match the current filters. Try adjusting your search criteria.'
                  : 'No users found in the system.'
                }
              </Text>
            </Flex>
          ) : (
            <>
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleSort('email')}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        Email {getSortIcon('email')}
                      </Button>
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleSort('name')}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        Name {getSortIcon('name')}
                      </Button>
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleSort('provider')}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        Provider {getSortIcon('provider')}
                      </Button>
                    </Table.ColumnHeaderCell>
                                         <Table.ColumnHeaderCell>Subscriber</Table.ColumnHeaderCell>
                     <Table.ColumnHeaderCell>Signed In</Table.ColumnHeaderCell>
                     <Table.ColumnHeaderCell>Tenants</Table.ColumnHeaderCell>
                     <Table.ColumnHeaderCell>Roles</Table.ColumnHeaderCell>
                     <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleSort('lastLogin')}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        Last Login {getSortIcon('lastLogin')}
                      </Button>
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  {users.map((user) => (
                    <Table.Row key={user.email}>
                      <Table.Cell>
                        <Text weight="bold">{user.email}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text>{user.name || 'N/A'}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant="soft">{user.provider}</Badge>
                      </Table.Cell>
                                             <Table.Cell>
                         {getSubscriberStatus(user)}
                       </Table.Cell>
                       <Table.Cell>
                         {getSignedInStatus(user)}
                       </Table.Cell>
                       <Table.Cell>
                         <Flex direction="column" gap="1">
                           {user.tenants.map((tenant, index) => (
                             <Badge key={index} variant="outline" size="1">
                               {tenant.name}
                             </Badge>
                           ))}
                         </Flex>
                       </Table.Cell>
                      <Table.Cell>
                        <Flex direction="column" gap="1">
                          {user.roles.map((role, index) => (
                            <Badge key={index} variant="soft" size="1">
                              {role}
                            </Badge>
                          ))}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        {getStatusBadge(user)}
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{formatLastLogin(user.lastLogin)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap="2">
                          {user.hasActiveSession && (
                            <Button
                              size="1"
                              variant="soft"
                              color="red"
                              onClick={() => openConfirmDialog('logout', user)}
                              disabled={isActionLoading === `logout-${user.email}`}
                            >
                              <LogOut size={14} />
                            </Button>
                          )}
                          {user.isSubscriber && !user.isBlocked && (
                            <Button
                              size="1"
                              variant="soft"
                              color="red"
                              onClick={() => openConfirmDialog('block', user)}
                              disabled={isActionLoading === `block-${user.email}`}
                            >
                              <Shield size={14} />
                            </Button>
                          )}
                          {user.isSubscriber && user.isBlocked && (
                            <Button
                              size="1"
                              variant="soft"
                              color="green"
                              onClick={() => openConfirmDialog('unblock', user)}
                              disabled={isActionLoading === `unblock-${user.email}`}
                            >
                              <ShieldOff size={14} />
                            </Button>
                          )}
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <Flex justify="center" mt="4" gap="2">
                  <Button
                    variant="soft"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    Previous
                  </Button>
                  <Text>
                    Page {pagination.page} of {pagination.totalPages}
                  </Text>
                  <Button
                    variant="soft"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                  </Button>
                </Flex>
              )}
            </>
          )}
        </Box>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog.Root open={confirmDialog.isOpen} onOpenChange={(open) => {
        if (!open) setConfirmDialog({ isOpen: false, action: 'logout', user: null });
      }}>
        <AlertDialog.Content>
          <AlertDialog.Title>
            {confirmDialog.action === 'logout' && 'Logout User'}
            {confirmDialog.action === 'block' && 'Block User'}
            {confirmDialog.action === 'unblock' && 'Unblock User'}
          </AlertDialog.Title>
          <AlertDialog.Description>
            {confirmDialog.action === 'logout' && `Are you sure you want to logout ${confirmDialog.user?.email}?`}
            {confirmDialog.action === 'block' && `Are you sure you want to block ${confirmDialog.user?.email}? They will not be able to sign in.`}
            {confirmDialog.action === 'unblock' && `Are you sure you want to unblock ${confirmDialog.user?.email}? They will be able to sign in again.`}
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button 
                color={confirmDialog.action === 'logout' ? 'red' : confirmDialog.action === 'block' ? 'red' : 'green'}
                onClick={() => confirmDialog.user && handleAction(confirmDialog.action, confirmDialog.user)}
              >
                {confirmDialog.action === 'logout' && 'Logout'}
                {confirmDialog.action === 'block' && 'Block'}
                {confirmDialog.action === 'unblock' && 'Unblock'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  );
} 