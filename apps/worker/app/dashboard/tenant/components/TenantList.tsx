'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Table, Button, Text, Flex, Box } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import { TenantForm } from './TenantForm';
import { TenantDeleteDialog } from './TenantDeleteDialog';
import { TenantUserList } from './TenantUserList';

interface Tenant {
  Id: string;
  Name: string;
  Description: string;
  CreatedAt: string;
  UpdatedAt: string;
}

interface TenantsResponse {
  results?: Tenant[];
}

interface TenantListProps {
  onTenantSelect: (tenant: Tenant) => void;
  isSystemAdmin: boolean;
  userTenants: Tenant[];
}

export interface TenantListRef {
  refreshTenants: () => void;
}

export const TenantList = forwardRef<TenantListRef, TenantListProps>(
  ({ onTenantSelect, isSystemAdmin, userTenants: initialTenants }, ref) => {
    const { showToast } = useToast();
    const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
    const [showingUsers, setShowingUsers] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch tenants from API
    const fetchTenants = async () => {
      console.log('fetchTenants called');
      setIsLoading(true);
      try {
        const response = await fetch('/api/tenant');
        console.log('API response status:', response.status);
        if (!response.ok) {
          throw new Error('Failed to fetch tenants');
        }
        const data = await response.json() as TenantsResponse;
        console.log('API response data:', data);
        const tenantsData = data.results || [];
        console.log('Processed tenants data:', tenantsData);
        setTenants(tenantsData);
      } catch (error) {
        console.error('Error fetching tenants:', error);
        showToast({
          title: 'Error',
          content: 'Failed to load tenants',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Refresh tenants list
    const refreshTenants = () => {
      console.log('refreshTenants called in TenantList');
      fetchTenants();
    };

    // Expose refreshTenants function through ref
    useImperativeHandle(ref, () => ({
      refreshTenants
    }));

    const handleEdit = (tenant: Tenant) => {
      setEditingTenant(tenant);
    };

    const handleDelete = (tenant: Tenant) => {
      setDeletingTenant(tenant);
    };

    const handleEditComplete = () => {
      setEditingTenant(null);
      refreshTenants(); // Refresh after edit
    };

    const handleDeleteComplete = () => {
      setDeletingTenant(null);
      refreshTenants(); // Refresh after delete
    };

    const handleShowUsers = (tenant: Tenant) => {
      setSelectedTenant(tenant);
      setShowingUsers(true);
      onTenantSelect(tenant);
    };

    const handleBackToList = () => {
      setShowingUsers(false);
      setSelectedTenant(null);
    };

    if (editingTenant) {
      return (
        <div className="space-y-4">
          <Button variant="soft" onClick={() => setEditingTenant(null)}>
            Back to List
          </Button>
          <TenantForm tenant={editingTenant} onSuccess={handleEditComplete} />
        </div>
      );
    }

    if (showingUsers && selectedTenant) {
      return (
        <div className="space-y-4">
          <Button variant="soft" onClick={handleBackToList}>
            Back to Tenants
          </Button>
          <Box>
            <Text as="div" size="4" weight="bold" mb="4">
              Users in {selectedTenant.Name}
            </Text>
            <TenantUserList tenantId={selectedTenant.Id} />
          </Box>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="space-y-4">
          <Text align="center">Loading tenants...</Text>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Updated</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {tenants.map((tenant) => (
              <Table.Row key={tenant.Id}>
                <Table.Cell>
                  <Text size="2" weight="bold">
                    {tenant.Id}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">
                    {tenant.Name}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {tenant.Description || '-'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {new Date(tenant.CreatedAt).toLocaleDateString()}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {new Date(tenant.UpdatedAt).toLocaleDateString()}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2" justify="end">
                    <Button 
                      variant="soft" 
                      color="green"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowUsers(tenant);
                      }}
                    >
                      Users
                    </Button>
                    <Button 
                      variant="soft" 
                      color="blue"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTenant(tenant);
                      }}
                    >
                      Edit
                    </Button>
                    {isSystemAdmin && (
                      <Button 
                        variant="soft" 
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingTenant(tenant);
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        {deletingTenant && (
          <TenantDeleteDialog
            tenant={deletingTenant}
            onComplete={handleDeleteComplete}
          />
        )}
      </div>
    );
  }
); 