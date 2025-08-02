'use client';

import { useState, useEffect } from 'react';
import { Card, Box, Text, Heading, Flex, Button, TextField, Select, Badge } from '@radix-ui/themes';

interface SearchFilters {
  status: string;
  tenantId: string;
  initiatorEmail: string;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

interface Tenant {
  id: string;
  name: string;
}

interface DashboardWorkflowSearchProps {
  userEmail: string;
  isGlobalAdmin: boolean;
  accessibleTenants: string[];
  onFiltersChange: (filters: SearchFilters) => void;
  tenants?: Tenant[];
}

export function DashboardWorkflowSearch({ 
  userEmail, 
  isGlobalAdmin, 
  accessibleTenants, 
  onFiltersChange,
  tenants = []
}: DashboardWorkflowSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    status: 'all',
    tenantId: 'all',
    initiatorEmail: '',
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });

  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    const fetchTenants = async () => {
      if (isGlobalAdmin) {
        try {
          const response = await fetch('/api/dashboard/tenants', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json() as { success: boolean; tenants?: Array<{ id: string; name: string }>; error?: string };
            setAvailableTenants(data.tenants || []);
          }
        } catch (error) {
          console.error('Error fetching tenants:', error);
        }
      } else {
        // For tenant admins, use the provided tenants
        setAvailableTenants(tenants);
      }
    };

    fetchTenants();
  }, [isGlobalAdmin, tenants]);

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      status: 'all',
      tenantId: 'all',
      initiatorEmail: '',
      dateFrom: '',
      dateTo: '',
      searchTerm: ''
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '' && value !== 'all');

  return (
    <Card>
      <Box p="4">
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Heading size="3">Search & Filter Workflows</Heading>
          {hasActiveFilters && (
            <Button size="1" variant="soft" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </Flex>

        <Flex gap="4" wrap="wrap">
          {/* Search Term */}
          <Box style={{ flex: '1', minWidth: '200px' }}>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Search
            </Text>
            <TextField.Root>
              <TextField.Input
                placeholder="Search workflows..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              />
            </TextField.Root>
          </Box>

          {/* Status Filter */}
          <Box style={{ flex: '1', minWidth: '150px' }}>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Status
            </Text>
            <Select.Root value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
              <Select.Trigger placeholder="All Statuses" />
              <Select.Content>
                <Select.Item value="all">All Statuses</Select.Item>
                <Select.Item value="active">Active</Select.Item>
                <Select.Item value="paused">Paused</Select.Item>
                <Select.Item value="completed">Completed</Select.Item>
                <Select.Item value="terminated">Terminated</Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>

          {/* Tenant Filter */}
          {isGlobalAdmin && (
            <Box style={{ flex: '1', minWidth: '200px' }}>
              <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                Tenant
              </Text>
              <Select.Root value={filters.tenantId} onValueChange={(value) => handleFilterChange('tenantId', value)}>
                <Select.Trigger placeholder="All Tenants" />
                <Select.Content>
                  <Select.Item value="all">All Tenants</Select.Item>
                  {availableTenants.map((tenant) => (
                    <Select.Item key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>
          )}

          {/* Initiator Email */}
          <Box style={{ flex: '1', minWidth: '200px' }}>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Initiator
            </Text>
            <TextField.Root>
              <TextField.Input
                placeholder="Initiator email..."
                value={filters.initiatorEmail}
                onChange={(e) => handleFilterChange('initiatorEmail', e.target.value)}
              />
            </TextField.Root>
          </Box>
        </Flex>

        <Flex gap="4" wrap="wrap" style={{ marginTop: '1rem' }}>
          {/* Date Range */}
          <Box style={{ flex: '1', minWidth: '150px' }}>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Created From
            </Text>
            <TextField.Root>
              <TextField.Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </TextField.Root>
          </Box>

          <Box style={{ flex: '1', minWidth: '150px' }}>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Created To
            </Text>
            <TextField.Root>
              <TextField.Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </TextField.Root>
          </Box>
        </Flex>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <Box style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--gray-2)', borderRadius: 'var(--radius-3)' }}>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Active Filters:
            </Text>
            <Flex gap="2" wrap="wrap">
              {filters.status && filters.status !== 'all' && (
                <Badge color="blue">Status: {filters.status}</Badge>
              )}
              {filters.tenantId && filters.tenantId !== 'all' && (
                <Badge color="green">Tenant: {availableTenants.find(t => t.id === filters.tenantId)?.name || filters.tenantId}</Badge>
              )}
              {filters.initiatorEmail && (
                <Badge color="purple">Initiator: {filters.initiatorEmail}</Badge>
              )}
              {filters.searchTerm && (
                <Badge color="orange">Search: {filters.searchTerm}</Badge>
              )}
              {filters.dateFrom && (
                <Badge color="gray">From: {filters.dateFrom}</Badge>
              )}
              {filters.dateTo && (
                <Badge color="gray">To: {filters.dateTo}</Badge>
              )}
            </Flex>
          </Box>
        )}
      </Box>
    </Card>
  );
} 