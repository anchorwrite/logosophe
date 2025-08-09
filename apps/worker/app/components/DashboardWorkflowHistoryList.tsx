'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Box, Text, Heading, Flex, Button, Badge, Table, TextField, Select, Dialog } from '@radix-ui/themes';
import Link from 'next/link';

interface WorkflowHistory {
  Id?: string;
  id?: string;
  Title?: string;
  title?: string;
  Status?: string;
  status?: string;
  TenantId?: string;
  tenantId?: string;
  TenantName?: string;
  tenantName?: string;
  InitiatorEmail?: string;
  initiatorEmail?: string;
  CreatedAt?: string;
  createdAt?: string;
  UpdatedAt?: string;
  updatedAt?: string;
  CompletedAt?: string;
  completedAt?: string;
  CompletedBy?: string;
  completedBy?: string;
  DeletedAt?: string;
  deletedAt?: string;
  DeletedBy?: string;
  deletedBy?: string;
  EventType?: string;
  eventType?: string;
  EventTimestamp?: string;
  eventTimestamp?: string;
  EventPerformedBy?: string;
  eventPerformedBy?: string;
}

interface WorkflowHistoryResponse {
  success: boolean;
  workflows?: WorkflowHistory[];
  total?: number;
  error?: string;
}

interface DashboardWorkflowHistoryListProps {
  userEmail: string;
  isGlobalAdmin: boolean;
  accessibleTenants: string[];
  status?: string;
  title?: string;
  showPagination?: boolean;
}

type SortField = 'title' | 'status' | 'tenant' | 'initiator' | 'eventType' | 'eventTimestamp';
type SortDirection = 'asc' | 'desc';

export function DashboardWorkflowHistoryList({ 
  userEmail, 
  isGlobalAdmin, 
  accessibleTenants, 
  status,
  title = "Workflow History",
  showPagination = true 
}: DashboardWorkflowHistoryListProps) {
  const [workflows, setWorkflows] = useState<WorkflowHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('eventTimestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const fetchingRef = useRef(false);

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => {
    const statuses = workflows.map(w => w.Status || w.status).filter(Boolean);
    return [...new Set(statuses)] as string[];
  }, [workflows]);

  const uniqueTenants = useMemo(() => {
    const tenants = workflows.map(w => w.TenantName || w.tenantName).filter(Boolean);
    return [...new Set(tenants)] as string[];
  }, [workflows]);

  // Filter and sort workflows
  const filteredAndSortedWorkflows = useMemo(() => {
    let filtered = workflows.filter(workflow => {
      const title = (workflow.Title || workflow.title || '').toLowerCase();
      const initiator = (workflow.InitiatorEmail || workflow.initiatorEmail || '').toLowerCase();
      const workflowStatus = (workflow.Status || workflow.status || '').toLowerCase();
      const tenant = (workflow.TenantName || workflow.tenantName || '').toLowerCase();
      
      // Search filter
      if (searchTerm && !title.includes(searchTerm.toLowerCase()) && 
          !initiator.includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (statusFilter && statusFilter !== 'all' && workflowStatus !== statusFilter.toLowerCase()) {
        return false;
      }
      
      // Tenant filter
      if (tenantFilter && tenantFilter !== 'all' && tenant !== tenantFilter.toLowerCase()) {
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
          aValue = (a.TenantName || a.tenantName || '').toLowerCase();
          bValue = (b.TenantName || b.tenantName || '').toLowerCase();
          break;
        case 'initiator':
          aValue = (a.InitiatorEmail || a.initiatorEmail || '').toLowerCase();
          bValue = (b.InitiatorEmail || b.initiatorEmail || '').toLowerCase();
          break;
        case 'eventType':
          aValue = (a.EventType || a.eventType || '').toLowerCase();
          bValue = (b.EventType || b.eventType || '').toLowerCase();
          break;
        case 'eventTimestamp':
        default:
          aValue = new Date(a.EventTimestamp || a.eventTimestamp || a.CreatedAt || a.createdAt || '');
          bValue = new Date(b.EventTimestamp || b.eventTimestamp || b.CreatedAt || b.createdAt || '');
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

  // Paginate results
  const paginatedWorkflows = useMemo(() => {
    if (!showPagination) return filteredAndSortedWorkflows;
    
    const startIndex = (currentPage - 1) * limit;
    return filteredAndSortedWorkflows.slice(startIndex, startIndex + limit);
  }, [filteredAndSortedWorkflows, currentPage, limit, showPagination]);

  // Fetch workflows from API
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

        const response = await fetch(`/api/dashboard/workflow/history?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('DashboardWorkflowHistoryList: Response error:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data: WorkflowHistoryResponse = await response.json();
        
        if (data.success && data.workflows) {
          setWorkflows(data.workflows);
          setTotal(data.total || 0);
        } else {
          setError(data.error || 'Failed to fetch workflow history');
        }
      } catch (err) {
        console.error('Error fetching workflow history:', err);
        setError('Failed to load workflow history');
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

  // Bulk delete functionality
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const deletedWorkflows = filteredAndSortedWorkflows
        .filter(w => (w.Status || w.status) === 'deleted')
        .map(w => w.Id || w.id)
        .filter((id): id is string => id !== undefined);
      setSelectedWorkflows(new Set(deletedWorkflows));
    } else {
      setSelectedWorkflows(new Set());
    }
  };

  const handleSelectWorkflow = (workflowId: string, checked: boolean) => {
    const newSelected = new Set(selectedWorkflows);
    if (checked) {
      newSelected.add(workflowId);
    } else {
      newSelected.delete(workflowId);
    }
    setSelectedWorkflows(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedWorkflows.size === 0) return;

    setIsBulkDeleting(true);
    try {
      const response = await fetch('/api/dashboard/workflow/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowIds: Array.from(selectedWorkflows)
        }),
      });

      const result = await response.json() as { 
        success: boolean; 
        results: { successful: string[]; failed: { workflowId: string; error: string }[] };
        message: string;
        error?: string;
      };

      if (result.success) {
        // Remove successfully deleted workflows from the list
        setWorkflows(prev => prev.filter(w => {
          const workflowId = w.Id || w.id;
          return workflowId ? !result.results.successful.includes(workflowId) : true;
        }));
        setSelectedWorkflows(new Set());
        
        // Show success message
        console.log(result.message);
        if (result.results.failed.length > 0) {
          console.warn(`${result.results.failed.length} workflows failed to delete:`, result.results.failed);
        }
      } else {
        console.error('Bulk delete failed:', result.error);
      }
    } catch (error) {
      console.error('Error during bulk delete:', error);
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const deletedWorkflowsCount = filteredAndSortedWorkflows.filter(w => (w.Status || w.status) === 'deleted').length;
  const selectedDeletedCount = Array.from(selectedWorkflows).filter(id => {
    const workflow = workflows.find(w => (w.Id || w.id) === id);
    return workflow && (workflow.Status || workflow.status) === 'deleted';
  }).length;

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

  const getEventTypeColor = (eventType: string | undefined) => {
    if (!eventType) return 'gray';
    
    switch (eventType.toLowerCase()) {
      case 'created':
        return 'green';
      case 'updated':
        return 'blue';
      case 'completed':
        return 'blue';
      case 'terminated':
        return 'red';
      case 'reactivated':
        return 'green';
      case 'deleted':
        return 'red';
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
      style={{ cursor: 'pointer' }}
      onClick={() => handleSort(field)}
    >
      <Flex align="center" gap="2">
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
          <Text>Loading workflow history...</Text>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Box p="4">
          <Text color="red">Error: {error}</Text>
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
            {filteredAndSortedWorkflows.length} workflows
          </Text>
        </Flex>

        {/* Search and Filters */}
        <Flex gap="3" mb="4" wrap="wrap">
          <TextField.Root style={{ minWidth: '200px' }}>
            <TextField.Input
              placeholder="Search workflows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </TextField.Root>
          
          {uniqueStatuses.length > 0 && (
            <Select.Root value={statusFilter} onValueChange={setStatusFilter}>
              <Select.Trigger placeholder="Filter by status" />
              <Select.Content>
                <Select.Item value="all">All Statuses</Select.Item>
                {uniqueStatuses.map(status => (
                  <Select.Item key={status} value={status.toLowerCase()}>
                    {status}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          )}

          {uniqueTenants.length > 0 && (
            <Select.Root value={tenantFilter} onValueChange={setTenantFilter}>
              <Select.Trigger placeholder="Filter by tenant" />
              <Select.Content>
                <Select.Item value="all">All Tenants</Select.Item>
                {uniqueTenants.map(tenant => (
                  <Select.Item key={tenant} value={tenant.toLowerCase()}>
                    {tenant}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          )}
        </Flex>

        {/* Bulk Actions */}
        {deletedWorkflowsCount > 0 && (
          <Card style={{ marginBottom: '1rem', padding: '1rem' }}>
            <Flex justify="between" align="center">
              <Flex align="center" gap="3">
                <Text size="2" weight="medium">
                  Bulk Actions for Deleted Workflows ({deletedWorkflowsCount} available)
                </Text>
                {selectedDeletedCount > 0 && (
                  <Badge color="red" variant="soft">
                    {selectedDeletedCount} selected
                  </Badge>
                )}
              </Flex>
              <Flex gap="2">
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => handleSelectAll(selectedDeletedCount !== deletedWorkflowsCount)}
                  disabled={deletedWorkflowsCount === 0}
                >
                  {selectedDeletedCount === deletedWorkflowsCount ? 'Deselect All' : 'Select All Deleted'}
                </Button>
                <Button
                  size="2"
                  color="red"
                  variant="solid"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={selectedDeletedCount === 0 || isBulkDeleting}
                >
                  {isBulkDeleting ? 'Permanently Deleting...' : `Permanently Delete (${selectedDeletedCount})`}
                </Button>
              </Flex>
            </Flex>
          </Card>
        )}

        {/* Workflows Table */}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell width="50px">
                <input
                  type="checkbox"
                  checked={selectedDeletedCount === deletedWorkflowsCount && deletedWorkflowsCount > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  disabled={deletedWorkflowsCount === 0}
                />
              </Table.ColumnHeaderCell>
              <SortableHeader field="title">Title</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <SortableHeader field="tenant">Tenant</SortableHeader>
              <SortableHeader field="initiator">Initiator</SortableHeader>
              <SortableHeader field="eventType">Event Type</SortableHeader>
              <SortableHeader field="eventTimestamp">Event Time</SortableHeader>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {paginatedWorkflows.map((workflow) => {
              const workflowId = workflow.Id || workflow.id;
              const isDeleted = (workflow.Status || workflow.status) === 'deleted';
              
              // Skip workflows without valid IDs
              if (!workflowId) return null;
              
              return (
              <Table.Row key={workflowId}>
                <Table.Cell>
                  <input
                    type="checkbox"
                    checked={selectedWorkflows.has(workflowId)}
                    onChange={(e) => handleSelectWorkflow(workflowId, e.target.checked)}
                    disabled={!isDeleted}
                  />
                </Table.Cell>
                <Table.Cell>
                  <Text weight="medium">
                    {workflow.Title || workflow.title || 'Untitled'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={getStatusColor(workflow.Status || workflow.status)}>
                    {workflow.Status || workflow.status || 'Unknown'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">
                    {workflow.TenantName || workflow.tenantName || 'Unknown'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">
                    {workflow.InitiatorEmail || workflow.initiatorEmail || 'Unknown'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={getEventTypeColor(workflow.EventType || workflow.eventType)}>
                    {workflow.EventType || workflow.eventType || 'Unknown'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">
                    {formatDate(workflow.EventTimestamp || workflow.eventTimestamp || workflow.CreatedAt || workflow.createdAt || '')}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2">
                    <Button size="1" variant="soft" asChild>
                      <Link href={`/dashboard/workflow/${workflow.Id || workflow.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>

        {/* Pagination */}
        {showPagination && filteredAndSortedWorkflows.length > limit && (
          <Flex justify="center" mt="4">
            <Flex gap="2">
              <Button
                size="2"
                variant="soft"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <Text size="2" style={{ alignSelf: 'center' }}>
                Page {currentPage} of {Math.ceil(filteredAndSortedWorkflows.length / limit)}
              </Text>
              <Button
                size="2"
                variant="soft"
                disabled={currentPage >= Math.ceil(filteredAndSortedWorkflows.length / limit)}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </Flex>
          </Flex>
        )}

        {/* Bulk Delete Confirmation Dialog */}
        <Dialog.Root open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <Dialog.Content style={{ 
            maxWidth: 500,
            width: '450px',
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
            <Dialog.Title>Bulk Permanently Delete Workflows</Dialog.Title>
            <Box mb="4">
              <Text size="2" mb="2">
                Are you sure you want to PERMANENTLY delete {selectedDeletedCount} workflows? This action will:
              </Text>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', marginBottom: '1rem' }}>
                <li>Permanently remove all workflow data</li>
                <li>Delete all messages and participants</li>
                <li>Remove all related records from the database</li>
                <li>Keep only the audit trail in WorkflowHistory</li>
              </ul>
              <Text size="2" color="red" style={{ fontWeight: 'bold' }}>
                This action is irreversible and cannot be undone!
              </Text>
            </Box>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button 
                color="red" 
                disabled={isBulkDeleting}
                onClick={handleBulkDelete}
              >
                {isBulkDeleting ? `Permanently Deleting ${selectedDeletedCount}...` : `Permanently Delete ${selectedDeletedCount} Workflows`}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Box>
    </Card>
  );
} 