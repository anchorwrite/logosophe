'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Box, Text, Heading, Flex, Button, Badge, Table, TextField, Select } from '@radix-ui/themes';
import Link from 'next/link';

interface Workflow {
  Id?: string;
  id?: string;
  Title?: string;
  title?: string;
  description?: string;
  Status?: string;
  status?: string;
  TenantId?: string;
  tenantId?: string;
  TenantName?: string;
  tenantName?: string;
  InitiatorEmail?: string;
  initiatorEmail?: string;
  initiatorRole?: string;
  CreatedAt?: string;
  createdAt?: string;
  UpdatedAt?: string;
  updatedAt?: string;
  ParticipantCount?: number;
  participantCount?: number;
  MessageCount?: number;
  messageCount?: number;
}

interface WorkflowListResponse {
  success: boolean;
  workflows?: Workflow[];
  total?: number;
  error?: string;
}

interface DashboardWorkflowListProps {
  userEmail: string;
  isGlobalAdmin: boolean;
  accessibleTenants: string[];
  status?: string;
  title?: string;
  showPagination?: boolean;
}

type SortField = 'title' | 'status' | 'tenant' | 'initiator' | 'participants' | 'messages' | 'created';
type SortDirection = 'asc' | 'desc';

export function DashboardWorkflowList({ 
  userEmail, 
  isGlobalAdmin, 
  accessibleTenants, 
  status,
  title = "Workflows",
  showPagination = true 
}: DashboardWorkflowListProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tenantFilter, setTenantFilter] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const fetchingRef = useRef(false);

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => {
    const statuses = workflows.map(w => w.Status || w.status).filter(Boolean);
    return [...new Set(statuses)];
  }, [workflows]);

  const uniqueTenants = useMemo(() => {
    const tenants = workflows.map(w => w.TenantName || w.tenantName).filter(Boolean);
    return [...new Set(tenants)];
  }, [workflows]);

  // Filter and sort workflows
  const filteredAndSortedWorkflows = useMemo(() => {
    let filtered = workflows.filter(workflow => {
      const title = (workflow.Title || workflow.title || '').toLowerCase();
      const description = (workflow.description || '').toLowerCase();
      const initiator = (workflow.InitiatorEmail || workflow.initiatorEmail || '').toLowerCase();
      const workflowStatus = (workflow.Status || workflow.status || '').toLowerCase();
      const tenant = (workflow.TenantName || workflow.tenantName || '').toLowerCase();
      
      // Search filter
      if (searchTerm && !title.includes(searchTerm.toLowerCase()) && 
          !description.includes(searchTerm.toLowerCase()) && 
          !initiator.includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (statusFilter && workflowStatus !== statusFilter.toLowerCase()) {
        return false;
      }
      
      // Tenant filter
      if (tenantFilter && tenant !== tenantFilter.toLowerCase()) {
        return false;
      }
      
      return true;
    });

    // Sort workflows
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'title':
          aValue = (a.Title || a.title || '').toLowerCase();
          bValue = (b.Title || b.title || '').toLowerCase();
          break;
        case 'status':
          aValue = (a.Status || a.status || '').toLowerCase();
          bValue = (b.Status || b.status || '').toLowerCase();
          break;
        case 'tenant':
          aValue = (a.tenantName || '').toLowerCase();
          bValue = (b.tenantName || '').toLowerCase();
          break;
        case 'initiator':
          aValue = (a.InitiatorEmail || a.initiatorEmail || '').toLowerCase();
          bValue = (b.InitiatorEmail || b.initiatorEmail || '').toLowerCase();
          break;
        case 'participants':
          aValue = a.ParticipantCount || a.participantCount || 0;
          bValue = b.ParticipantCount || b.participantCount || 0;
          break;
        case 'messages':
          aValue = a.MessageCount || a.messageCount || 0;
          bValue = b.MessageCount || b.messageCount || 0;
          break;
        case 'created':
        default:
          aValue = new Date(a.CreatedAt || a.createdAt || '').getTime();
          bValue = new Date(b.CreatedAt || b.createdAt || '').getTime();
          break;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [workflows, searchTerm, statusFilter, tenantFilter, sortField, sortDirection]);

  // Paginate filtered results
  const paginatedWorkflows = useMemo(() => {
    const startIndex = (currentPage - 1) * limit;
    return filteredAndSortedWorkflows.slice(startIndex, startIndex + limit);
  }, [filteredAndSortedWorkflows, currentPage, limit]);

  const totalFilteredPages = Math.ceil(filteredAndSortedWorkflows.length / limit);

  useEffect(() => {
    const fetchWorkflows = async () => {
      // Prevent multiple simultaneous requests
      if (fetchingRef.current) {
        return;
      }
      
      try {
        fetchingRef.current = true;
        setLoading(true);
        setError(null);

        // Build query parameters
        const params = new URLSearchParams();
        params.append('userEmail', userEmail);
        params.append('isGlobalAdmin', isGlobalAdmin.toString());
        params.append('limit', '1000'); // Get all workflows for client-side filtering
        params.append('offset', '0');
        
        if (status) {
          params.append('status', status);
        }

        if (!isGlobalAdmin && accessibleTenants.length > 0) {
          params.append('tenantIds', accessibleTenants.join(','));
        }

        const response = await fetch(`/api/dashboard/workflow/list?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('DashboardWorkflowList: Response error:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data: WorkflowListResponse = await response.json();
        
        if (data.success && data.workflows) {
          setWorkflows(data.workflows);
          setTotal(data.total || 0);
        } else {
          setError(data.error || 'Failed to fetch workflows');
        }
      } catch (err) {
        console.error('Error fetching workflows:', err);
        setError('Failed to load workflows');
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    // Only fetch if we have the required data
    if (userEmail) {
      fetchWorkflows();
    }
  }, [userEmail, isGlobalAdmin, accessibleTenants, status]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, tenantFilter, sortField, sortDirection]);

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'gray';
    
    switch (status.toLowerCase()) {
      case 'active':
        return 'green';
      case 'completed':
        return 'blue';
      case 'terminated':
        return 'red';
      case 'paused':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Table.ColumnHeaderCell 
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => handleSort(field)}
    >
      <Flex align="center" gap="1">
        {children}
        {sortField === field && (
          <Text size="1" color="gray">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </Text>
        )}
      </Flex>
    </Table.ColumnHeaderCell>
  );

  if (loading) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="gray">Loading workflows...</Text>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="red">{error}</Text>
        </Box>
      </Card>
    );
  }

  if (workflows.length === 0) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="gray">No workflows found.</Text>
        </Box>
      </Card>
    );
  }

  return (
    <Card>
      <Box p="4">
        <Flex justify="between" align="center" mb="4">
          <Heading size="4">{title}</Heading>
          <Text size="2" color="gray">
            Showing {paginatedWorkflows.length} of {filteredAndSortedWorkflows.length} workflows
          </Text>
        </Flex>

        {/* Search and Filters */}
        <Flex gap="3" mb="4" wrap="wrap">
          <Box style={{ minWidth: '200px' }}>
            <TextField.Root>
              <TextField.Input
                placeholder="Search workflows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </TextField.Root>
          </Box>
          
          <Select.Root value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}>
            <Select.Trigger placeholder="Filter by status" />
            <Select.Content>
              <Select.Item value="all">All Statuses</Select.Item>
              {uniqueStatuses.map(status => (
                <Select.Item key={status} value={status?.toLowerCase() || 'unknown'}>
                  {status}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Select.Root value={tenantFilter || 'all'} onValueChange={(value) => setTenantFilter(value === 'all' ? '' : value)}>
            <Select.Trigger placeholder="Filter by tenant" />
            <Select.Content>
              <Select.Item value="all">All Tenants</Select.Item>
              {uniqueTenants.map(tenant => (
                <Select.Item key={tenant} value={tenant?.toLowerCase() || 'unknown'}>
                  {tenant}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Button 
            size="2" 
            variant="soft" 
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setTenantFilter('');
              setSortField('created');
              setSortDirection('desc');
            }}
          >
            Clear Filters
          </Button>
        </Flex>

        <Table.Root>
          <Table.Header>
            <Table.Row>
              <SortableHeader field="title">Title</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <SortableHeader field="tenant">Tenant</SortableHeader>
              <SortableHeader field="initiator">Initiator</SortableHeader>
              <SortableHeader field="participants">Participants</SortableHeader>
              <SortableHeader field="messages">Messages</SortableHeader>
              <SortableHeader field="created">Created</SortableHeader>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {paginatedWorkflows.map((workflow) => (
              <Table.Row key={workflow.Id || workflow.id || 'unknown'}>
                <Table.Cell>
                  <Box>
                    <Text weight="medium">{workflow.Title || workflow.title}</Text>
                    {workflow.description && (
                      <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                        {workflow.description.length > 50 
                          ? `${workflow.description.substring(0, 50)}...` 
                          : workflow.description}
                      </Text>
                    )}
                  </Box>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={getStatusColor(workflow.Status || workflow.status)}>
                    {workflow.Status || workflow.status || 'Unknown'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">{workflow.TenantName || workflow.tenantName || 'Unknown'}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Box>
                    <Text size="2">{workflow.InitiatorEmail || workflow.initiatorEmail || 'Unknown'}</Text>
                    <Text size="1" color="gray">{workflow.initiatorRole || 'Unknown'}</Text>
                  </Box>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">{workflow.ParticipantCount || workflow.participantCount || 0}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">{workflow.MessageCount || workflow.messageCount || 0}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">{formatDate(workflow.CreatedAt || workflow.createdAt || new Date().toISOString())}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2">
                    <Button size="1" asChild>
                      <Link href={`/dashboard/workflow/${workflow.Id || workflow.id}`}>
                        View
                      </Link>
                    </Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        {showPagination && totalFilteredPages > 1 && (
          <Flex justify="center" gap="2" mt="4">
            <Button 
              size="1" 
              variant="soft" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Text size="2" style={{ alignSelf: 'center' }}>
              Page {currentPage} of {totalFilteredPages}
            </Text>
            <Button 
              size="1" 
              variant="soft" 
              disabled={currentPage === totalFilteredPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </Flex>
        )}
      </Box>
    </Card>
  );
} 