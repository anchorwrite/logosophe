'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, Box, Text, Heading, Flex, Button, Badge, Table, Checkbox } from '@radix-ui/themes';
import Link from 'next/link';
import { DashboardWorkflowSearch } from './DashboardWorkflowSearch';
import { DashboardWorkflowBulkActions } from './DashboardWorkflowBulkActions';

interface Workflow {
  id?: string;
  Id?: string;
  title?: string;
  Title?: string;
  description?: string;
  Description?: string;
  status?: string;
  Status?: string;
  tenantId?: string;
  TenantId?: string;
  tenantName?: string;
  TenantName?: string;
  initiatorEmail?: string;
  InitiatorEmail?: string;
  initiatorRole?: string;
  InitiatorRole?: string;
  createdAt?: string;
  CreatedAt?: string;
  updatedAt?: string;
  UpdatedAt?: string;
  participantCount?: number;
  ParticipantCount?: number;
  messageCount?: number;
  MessageCount?: number;
}

interface WorkflowListResponse {
  success: boolean;
  workflows?: Workflow[];
  total?: number;
  error?: string;
}

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

interface EnhancedWorkflowListProps {
  userEmail: string;
  isGlobalAdmin: boolean;
  accessibleTenants: string[];
  userTenants: Tenant[];
}

export function EnhancedWorkflowList({ 
  userEmail, 
  isGlobalAdmin, 
  accessibleTenants,
  userTenants 
}: EnhancedWorkflowListProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    status: '',
    tenantId: '',
    initiatorEmail: '',
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });
  const [limit] = useState(20);
  const fetchingRef = useRef(false);

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
        params.append('limit', limit.toString());
        params.append('offset', ((currentPage - 1) * limit).toString());
        
        // Add filters
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            params.append(key, value);
          }
        });

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
          console.error('EnhancedWorkflowList: Response error:', errorText);
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
  }, [userEmail, isGlobalAdmin, accessibleTenants, filters, currentPage, limit]);

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
    setSelectedWorkflows([]); // Clear selection when filters change
  };

  const handleBulkAction = async (action: string, workflowIds: string[]) => {
    try {
      const response = await fetch('/api/dashboard/workflow/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          workflowIds,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result = await response.json() as { success: boolean; error?: string };
      
      if (result.success) {
        // Refresh the workflow list
        window.location.reload();
      } else {
        setError(result.error || 'Failed to perform bulk action');
      }
    } catch (err) {
      console.error('Error performing bulk action:', err);
      setError('Failed to perform bulk action');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedWorkflows(workflows.map(w => getWorkflowValue(w, 'id')).filter(Boolean));
    } else {
      setSelectedWorkflows([]);
    }
  };

  const handleSelectWorkflow = (workflowId: string, checked: boolean) => {
    if (checked) {
      setSelectedWorkflows([...selectedWorkflows, workflowId]);
    } else {
      setSelectedWorkflows(selectedWorkflows.filter(id => id !== workflowId));
    }
  };

  // Helper functions to get workflow values safely
  const getWorkflowValue = (workflow: Workflow, key: string): string => {
    return (workflow as any)[key] || (workflow as any)[key.charAt(0).toUpperCase() + key.slice(1)] || '';
  };

  const getWorkflowNumber = (workflow: Workflow, key: string): number => {
    return (workflow as any)[key] || (workflow as any)[key.charAt(0).toUpperCase() + key.slice(1)] || 0;
  };

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

  const totalPages = Math.ceil(total / limit);

  return (
    <Box>
      {/* Search and Filters */}
      <Box style={{ marginBottom: '2rem' }}>
        <DashboardWorkflowSearch 
          userEmail={userEmail}
          isGlobalAdmin={isGlobalAdmin}
          accessibleTenants={accessibleTenants}
          onFiltersChange={handleFiltersChange}
          tenants={userTenants}
        />
      </Box>

      {/* Bulk Actions */}
      {workflows.length > 0 && (
        <Box style={{ marginBottom: '2rem' }}>
          <DashboardWorkflowBulkActions 
            workflows={workflows as any}
            selectedWorkflows={selectedWorkflows}
            onSelectionChange={setSelectedWorkflows}
            onBulkAction={handleBulkAction}
            userEmail={userEmail}
            isGlobalAdmin={isGlobalAdmin}
          />
        </Box>
      )}

      {/* Workflow List */}
      <Card>
        <Box p="4">
          <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
            <Heading size="4">Workflows</Heading>
            <Text size="2" color="gray">Total: {total}</Text>
          </Flex>

          {workflows.length === 0 ? (
            <Text size="2" color="gray">No workflows found matching your criteria.</Text>
          ) : (
            <>
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>
                      <Checkbox
                        checked={selectedWorkflows.length === workflows.length && workflows.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Tenant</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Initiator</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Participants</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Messages</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  {workflows.map((workflow, index) => {
                    const workflowId = getWorkflowValue(workflow, 'id');
                    const title = getWorkflowValue(workflow, 'title');
                    const description = getWorkflowValue(workflow, 'description');
                    const status = getWorkflowValue(workflow, 'status');
                    const tenantName = getWorkflowValue(workflow, 'tenantName');
                    const initiatorEmail = getWorkflowValue(workflow, 'initiatorEmail');
                    const initiatorRole = getWorkflowValue(workflow, 'initiatorRole');
                    const participantCount = getWorkflowNumber(workflow, 'participantCount');
                    const messageCount = getWorkflowNumber(workflow, 'messageCount');
                    const createdAt = getWorkflowValue(workflow, 'createdAt');
                    
                    return (
                      <Table.Row key={workflowId || `workflow-${index}`}>
                        <Table.Cell>
                          <Checkbox
                            checked={selectedWorkflows.includes(workflowId)}
                            onCheckedChange={(checked) => handleSelectWorkflow(workflowId, checked as boolean)}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Box>
                            <Text weight="medium">{title}</Text>
                            {description && (
                              <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                                {description.length > 50 
                                  ? `${description.substring(0, 50)}...` 
                                  : description}
                              </Text>
                            )}
                          </Box>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color={getStatusColor(status)}>
                            {status || 'Unknown'}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{tenantName}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Box>
                            <Text size="2">{initiatorEmail}</Text>
                            <Text size="1" color="gray">{initiatorRole}</Text>
                          </Box>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{participantCount}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{messageCount}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{formatDate(createdAt)}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Flex gap="2">
                            <Button size="1" asChild>
                              <Link href={`/dashboard/workflow/${workflowId}`}>
                                View
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
              {totalPages > 1 && (
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
                    Page {currentPage} of {totalPages}
                  </Text>
                  <Button 
                    size="1" 
                    variant="soft" 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </Flex>
              )}
            </>
          )}
        </Box>
      </Card>
    </Box>
  );
} 