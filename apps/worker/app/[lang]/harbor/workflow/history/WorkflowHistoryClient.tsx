'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Flex, 
  Heading, 
  Text, 
  Card, 
  Button, 
  Badge, 
  Table, 
  TextField, 
  Select,
  Popover,
  Checkbox,
  ScrollArea
} from "@radix-ui/themes";
import { 
  MagnifyingGlassIcon, 
  ChevronUpIcon, 
  ChevronDownIcon,
  MixerHorizontalIcon,
  ArrowLeftIcon
} from '@radix-ui/react-icons';
import Link from "next/link";
import { useTranslation } from 'react-i18next';
import type { Locale } from '@/types/i18n';
import { deleteWorkflowClient } from '@/lib/workflow-client';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useToast } from '@/components/Toast';

interface Workflow {
  Id: string;
  Title: string;
  TenantId: string;
  InitiatorEmail: string;
  Status: string;
  CreatedAt: string;
  UpdatedAt: string;
  CompletedAt?: string;
  CompletedBy?: string;
  TerminatedAt?: string;
  TerminatedBy?: string;
  DeletedAt?: string;
  DeletedBy?: string;
  EventType?: string;
  EventTimestamp?: string;
  EventPerformedBy?: string;
}

interface GroupedWorkflow {
  Id: string;
  Title: string;
  TenantId: string;
  InitiatorEmail: string;
  Status: string;
  CreatedAt: string;
  UpdatedAt: string;
  CompletedAt?: string;
  CompletedBy?: string;
  TerminatedAt?: string;
  TerminatedBy?: string;
  DeletedAt?: string;
  DeletedBy?: string;
  LastEventTimestamp?: string;
  LastEventType?: string;
  LastEventPerformedBy?: string;
}

interface WorkflowHistoryClientProps {
  userEmail: string;
  userTenantId: string;
  lang: Locale;
}

type SortField = 'Title' | 'Status' | 'InitiatorEmail' | 'CreatedAt' | 'CompletedAt' | 'TerminatedAt' | 'DeletedAt' | 'LastEventTimestamp';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 20;

export function WorkflowHistoryClient({ userEmail, userTenantId, lang }: WorkflowHistoryClientProps) {
  const { t } = useTranslation('translations');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingWorkflows, setDeletingWorkflows] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  
  // Table state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('LastEventTimestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
  
  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    workflowId: string | null;
    workflowTitle: string;
  }>({ isOpen: false, workflowId: null, workflowTitle: '' });

  useEffect(() => {
    fetchAllWorkflows();
  }, [userTenantId]);

  const fetchAllWorkflows = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/workflow/history?tenantId=${encodeURIComponent(userTenantId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch workflows: ${errorText}`);
      }

      const data = await response.json() as { workflows?: Workflow[] };
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('Error fetching workflows:', err);
      showToast({
        type: 'error',
        title: t('common.error'),
        content: err instanceof Error ? err.message : t('workflow.errors.fetchFailed')
      });
    } finally {
      setLoading(false);
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

  const handleDeleteWorkflow = async (workflowId: string) => {
    setDeletingWorkflows(prev => new Set(prev).add(workflowId));
    
    try {
      const result = await deleteWorkflowClient(workflowId, userEmail, userTenantId);
      
      if (result.success) {
        // Remove the workflow from the list
        setWorkflows(prev => prev.filter(workflow => workflow.Id !== workflowId));
        
        showToast({
          type: 'success',
          title: t('common.success'),
          content: t('workflow.messages.deletedSuccessfully')
        });
      } else {
        showToast({
          type: 'error',
          title: t('common.error'),
          content: result.error || t('workflow.errors.deleteFailed')
        });
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      showToast({
        type: 'error',
        title: t('common.error'),
        content: t('workflow.errors.deleteFailed')
      });
    } finally {
      setDeletingWorkflows(prev => {
        const newSet = new Set(prev);
        newSet.delete(workflowId);
        return newSet;
      });
    }
  };

  const openDeleteDialog = (workflowId: string, workflowTitle: string) => {
    setDeleteDialog({ isOpen: true, workflowId, workflowTitle });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'completed':
        return 'blue';
      case 'terminated':
        return 'orange';
      case 'deleted':
        return 'red';
      default:
        return 'gray';
    }
  };

  // Group workflows by ID and consolidate information
  const groupedWorkflows = useMemo(() => {
    const grouped = new Map<string, GroupedWorkflow>();
    
    workflows.forEach(workflow => {
      const existing = grouped.get(workflow.Id);
      
      if (!existing) {
        // First entry for this workflow
        grouped.set(workflow.Id, {
          Id: workflow.Id,
          Title: workflow.Title,
          TenantId: workflow.TenantId,
          InitiatorEmail: workflow.InitiatorEmail,
          Status: workflow.Status,
          CreatedAt: workflow.CreatedAt,
          UpdatedAt: workflow.UpdatedAt,
          CompletedAt: workflow.CompletedAt,
          CompletedBy: workflow.CompletedBy,
          TerminatedAt: workflow.TerminatedAt,
          TerminatedBy: workflow.TerminatedBy,
          DeletedAt: workflow.DeletedAt,
          DeletedBy: workflow.DeletedBy,
          LastEventTimestamp: workflow.EventTimestamp,
          LastEventType: workflow.EventType,
          LastEventPerformedBy: workflow.EventPerformedBy
        });
      } else {
        // Update with latest event information
        if (workflow.EventTimestamp && (!existing.LastEventTimestamp || new Date(workflow.EventTimestamp) > new Date(existing.LastEventTimestamp))) {
          existing.LastEventTimestamp = workflow.EventTimestamp;
          existing.LastEventType = workflow.EventType;
          existing.LastEventPerformedBy = workflow.EventPerformedBy;
          // Update status to the most recent event's status
          existing.Status = workflow.Status;
        }
        
        // Update dates if this entry has more recent information
        if (workflow.CompletedAt && !existing.CompletedAt) {
          existing.CompletedAt = workflow.CompletedAt;
          existing.CompletedBy = workflow.CompletedBy;
        }
        
        if (workflow.TerminatedAt && !existing.TerminatedAt) {
          existing.TerminatedAt = workflow.TerminatedAt;
          existing.TerminatedBy = workflow.TerminatedBy;
        }
        
        if (workflow.DeletedAt && !existing.DeletedAt) {
          existing.DeletedAt = workflow.DeletedAt;
          existing.DeletedBy = workflow.DeletedBy;
        }
      }
    });
    
    return Array.from(grouped.values());
  }, [workflows]);

  // Filter and sort workflows
  const filteredAndSortedWorkflows = useMemo(() => {
    let filtered = groupedWorkflows.filter(workflow => {
      const matchesSearch = searchTerm === '' || 
        workflow.Title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workflow.InitiatorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workflow.Id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || workflow.Status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Sort workflows
    filtered.sort((a, b) => {
      let aValue: string | number = a[sortField] || '';
      let bValue: string | number = b[sortField] || '';
      
      // Handle date sorting
      if (sortField === 'CreatedAt' || sortField === 'CompletedAt' || sortField === 'TerminatedAt' || sortField === 'DeletedAt' || sortField === 'LastEventTimestamp') {
        aValue = aValue ? new Date(aValue as string).getTime() : 0;
        bValue = bValue ? new Date(bValue as string).getTime() : 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [groupedWorkflows, searchTerm, statusFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedWorkflows.length / ITEMS_PER_PAGE);
  const paginatedWorkflows = filteredAndSortedWorkflows.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedWorkflows(new Set(paginatedWorkflows.map(w => w.Id)));
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

  const handleBulkDelete = () => {
    if (selectedWorkflows.size === 0) return;
    
    const firstWorkflow = workflows.find(w => w.Id === Array.from(selectedWorkflows)[0]);
    if (firstWorkflow) {
      openDeleteDialog(Array.from(selectedWorkflows).join(','), `${selectedWorkflows.size} workflows`);
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />;
  };

  const renderDate = (dateString?: string) => {
    return dateString ? formatDate(dateString) : 'N/A';
  };

  if (loading) {
    return (
      <Card>
        <Box p="6" style={{ textAlign: 'center' }}>
          <Text color="gray">{t('workflow.loading')}</Text>
        </Box>
      </Card>
    );
  }

  if (workflows.length === 0) {
    return (
      <Card>
        <Box p="6" style={{ textAlign: 'center' }}>
          <Heading size="4" mb="3">{t('workflow.history.noWorkflows')}</Heading>
          <Text color="gray" mb="4">
            {t('workflow.history.noWorkflowsDescription')}
          </Text>
          <Button asChild>
            <Link href={`/${lang}/harbor/workflow/create`}>
              {t('workflow.createNewWorkflow')}
            </Link>
          </Button>
        </Box>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header with search and filters */}
      <Card mb="4">
        <Box p="4">
          <Flex direction="column" gap="4">
            <Flex justify="between" align="center">
              <Heading size="4">{t('workflow.history.title')} ({filteredAndSortedWorkflows.length} {t('workflow.history.pagination.workflows')})</Heading>
              <Flex gap="2">
                <Button variant="soft" asChild>
                  <Link href={`/${lang}/harbor/workflow/create`}>
                    {t('workflow.createNewWorkflow')}
                  </Link>
                </Button>
                <Button variant="soft" asChild>
                  <Link href={`/${lang}/harbor/workflow/active`}>
                    {t('workflow.viewActiveWorkflows')}
                  </Link>
                </Button>
              </Flex>
            </Flex>

            <Flex gap="4" align="center" wrap="wrap">
              {/* Search */}
              <Box style={{ minWidth: '300px' }}>
                <TextField.Root>
                  <TextField.Slot>
                    <MagnifyingGlassIcon />
                  </TextField.Slot>
                  <TextField.Input
                    placeholder={t('workflow.history.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </TextField.Root>
              </Box>

              {/* Status Filter */}
              <Select.Root value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <Select.Trigger placeholder={t('workflow.history.filterByStatus')} />
                <Select.Content>
                  <Select.Item value="all">{t('workflow.history.allStatuses')}</Select.Item>
                  <Select.Item value="active">{t('workflow.status.active')}</Select.Item>
                  <Select.Item value="completed">{t('workflow.status.completed')}</Select.Item>
                  <Select.Item value="terminated">{t('workflow.status.terminated')}</Select.Item>
                  <Select.Item value="deleted">{t('workflow.status.deleted')}</Select.Item>
                </Select.Content>
              </Select.Root>

              {/* Bulk Actions */}
              {selectedWorkflows.size > 0 && (
                <Button color="red" variant="soft" onClick={handleBulkDelete}>
                  {t('workflow.history.deleteSelected')} ({selectedWorkflows.size})
                </Button>
              )}
            </Flex>
          </Flex>
        </Box>
      </Card>

      {/* Table */}
      <Card>
        <ScrollArea>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell style={{ width: '50px' }}>
                  <Checkbox
                    checked={selectedWorkflows.size === paginatedWorkflows.length && paginatedWorkflows.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('Title')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {t('workflow.history.table.title')} {getSortIcon('Title')}
                  </Button>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('Status')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {t('workflow.history.table.status')} {getSortIcon('Status')}
                  </Button>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('InitiatorEmail')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {t('workflow.history.table.initiator')} {getSortIcon('InitiatorEmail')}
                  </Button>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('CreatedAt')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {t('workflow.history.table.created')} {getSortIcon('CreatedAt')}
                  </Button>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('CompletedAt')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {t('workflow.history.table.completed')} {getSortIcon('CompletedAt')}
                  </Button>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('TerminatedAt')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {t('workflow.history.table.terminated')} {getSortIcon('TerminatedAt')}
                  </Button>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('DeletedAt')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {t('workflow.history.table.deleted')} {getSortIcon('DeletedAt')}
                  </Button>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>{t('workflow.history.table.actions')}</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {paginatedWorkflows.map((workflow) => (
                <Table.Row key={workflow.Id}>
                  <Table.Cell>
                    <Checkbox
                      checked={selectedWorkflows.has(workflow.Id)}
                      onCheckedChange={(checked) => handleSelectWorkflow(workflow.Id, checked as boolean)}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Box>
                      <Text weight="medium" size="2">{workflow.Title}</Text>
                      <Text size="1" color="gray">{t('workflow.history.table.id')}: {workflow.Id}</Text>
                    </Box>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={getStatusColor(workflow.Status)}>
                      {t(`workflow.status.${workflow.Status}`)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{workflow.InitiatorEmail}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{formatDate(workflow.CreatedAt)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{renderDate(workflow.CompletedAt)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{renderDate(workflow.TerminatedAt)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{renderDate(workflow.DeletedAt)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap="2">
                      {workflow.Status === 'active' && (
                        <Button size="1" variant="soft" asChild>
                          <Link href={`/${lang}/harbor/workflow/${workflow.Id}`}>
                            {t('workflow.history.table.view')}
                          </Link>
                        </Button>
                      )}
                      {(workflow.Status === 'completed' || workflow.Status === 'terminated' || workflow.Status === 'deleted') && (
                        <Button size="1" variant="soft" asChild>
                          <Link href={`/${lang}/harbor/workflow/history/${workflow.Id}`}>
                            {t('workflow.history.table.history')}
                          </Link>
                        </Button>
                      )}
                      {(workflow.Status === 'completed' || workflow.Status === 'terminated') && !workflow.DeletedAt && (
                        <Button 
                          size="1"
                          color="red" 
                          variant="soft"
                          onClick={() => openDeleteDialog(workflow.Id, workflow.Title)}
                          disabled={deletingWorkflows.has(workflow.Id)}
                        >
                          {deletingWorkflows.has(workflow.Id) ? t('workflow.history.table.deleting') : t('workflow.history.table.delete')}
                        </Button>
                      )}
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box p="4" style={{ borderTop: '1px solid var(--gray-6)' }}>
            <Flex justify="between" align="center">
              <Text size="2" color="gray">
                {t('workflow.history.pagination.showing')} {((currentPage - 1) * ITEMS_PER_PAGE) + 1} {t('workflow.history.pagination.to')} {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedWorkflows.length)} {t('workflow.history.pagination.of')} {filteredAndSortedWorkflows.length} {t('workflow.history.pagination.workflows')}
              </Text>
              <Flex gap="2">
                <Button
                  variant="soft"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  {t('workflow.history.pagination.previous')}
                </Button>
                <Text size="2" align="center" style={{ minWidth: '100px' }}>
                  {t('workflow.history.pagination.page')} {currentPage} {t('workflow.history.pagination.of')} {totalPages}
                </Text>
                <Button
                  variant="soft"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  {t('workflow.history.pagination.next')}
                </Button>
              </Flex>
            </Flex>
          </Box>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, workflowId: null, workflowTitle: '' })}
        onConfirm={() => {
          if (deleteDialog.workflowId) {
            if (deleteDialog.workflowId.includes(',')) {
              // Bulk delete
              const workflowIds = deleteDialog.workflowId.split(',');
              Promise.all(workflowIds.map(id => handleDeleteWorkflow(id)));
            } else {
              // Single delete
              handleDeleteWorkflow(deleteDialog.workflowId);
            }
          }
        }}
        title="Delete Workflow"
        message={`Are you sure you want to permanently delete ${deleteDialog.workflowId?.includes(',') ? 'these workflows' : 'this workflow'} "${deleteDialog.workflowTitle}"? This action cannot be undone and will remove all associated messages and participants.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteDialog.workflowId ? deletingWorkflows.has(deleteDialog.workflowId) : false}
      />
    </Box>
  );
} 