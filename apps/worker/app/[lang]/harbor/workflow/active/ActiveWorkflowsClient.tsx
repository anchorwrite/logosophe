"use client";

import { useEffect, useState } from 'react';
import { Box, Flex, Heading, Text, Card, Button, Badge } from "@radix-ui/themes";
import Link from "next/link";
import { useTranslation } from 'react-i18next';
import type { Locale } from '@/types/i18n';
import { completeWorkflowClient, terminateWorkflowClient, deleteWorkflowClient } from '@/lib/workflow-client';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useToast } from '@/components/Toast';

interface Workflow {
  Id: string;
  TenantId: string;
  InitiatorEmail: string;
  Title: string;
  Status: 'active' | 'completed' | 'terminated';
  CreatedAt: string;
  UpdatedAt: string;
  CompletedAt?: string;
  CompletedBy?: string;
}

interface WorkflowsResponse {
  success: boolean;
  workflows?: Workflow[];
  error?: string;
}

interface ActiveWorkflowsClientProps {
  userEmail: string;
  userTenantId: string;
  lang: Locale;
  dict: any;
}

export function ActiveWorkflowsClient({ userEmail, userTenantId, lang, dict }: ActiveWorkflowsClientProps) {
  const { t } = useTranslation('translations');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completingWorkflows, setCompletingWorkflows] = useState<Set<string>>(new Set());
  const [terminatingWorkflows, setTerminatingWorkflows] = useState<Set<string>>(new Set());
  const [deletingWorkflows, setDeletingWorkflows] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  
  // Confirmation dialog states
  const [terminateDialog, setTerminateDialog] = useState<{
    isOpen: boolean;
    workflowId: string | null;
    workflowTitle: string;
  }>({ isOpen: false, workflowId: null, workflowTitle: '' });
  
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    workflowId: string | null;
    workflowTitle: string;
  }>({ isOpen: false, workflowId: null, workflowTitle: '' });

  // Fetch workflows from API
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const response = await fetch(`/api/workflow?tenantId=${userTenantId}&status=active`);
        const result: WorkflowsResponse = await response.json();

        if (result.success && result.workflows) {
          setWorkflows(result.workflows);
        } else {
          showToast({
            type: 'error',
            title: t('common.error'),
            content: result.error || t('workflow.errors.fetchFailed')
          });
          setWorkflows([]);
        }
      } catch (error) {
        console.error('Error fetching workflows:', error);
        showToast({
          type: 'error',
          title: t('common.error'),
          content: t('workflow.errors.fetchFailed')
        });
        setWorkflows([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, [userTenantId]);

  const handleCompleteWorkflow = async (workflowId: string) => {
    setCompletingWorkflows(prev => new Set(prev).add(workflowId));
    
    try {
      const result = await completeWorkflowClient(workflowId, userEmail, userTenantId);
      
      if (result.success) {
        // Update the workflow status locally
        setWorkflows(prev => prev.map(workflow => 
          workflow.Id === workflowId 
            ? {
                ...workflow,
                Status: 'completed' as const,
                CompletedAt: new Date().toISOString(),
                CompletedBy: userEmail,
                UpdatedAt: new Date().toISOString()
              }
            : workflow
        ));
        
        showToast({
          type: 'success',
          title: t('common.status.success'),
          content: t('workflow.message.completedSuccessfully')
        });
      } else {
        showToast({
          type: 'error',
          title: t('common.error'),
          content: result.error || t('workflow.errors.completeFailed')
        });
      }
    } catch (error) {
      console.error('Error completing workflow:', error);
      showToast({
        type: 'error',
        title: t('common.error'),
        content: t('workflow.errors.completeFailed')
      });
    } finally {
      setCompletingWorkflows(prev => {
        const newSet = new Set(prev);
        newSet.delete(workflowId);
        return newSet;
      });
    }
  };

  const handleTerminateWorkflow = async (workflowId: string) => {
    setTerminatingWorkflows(prev => new Set(prev).add(workflowId));
    
    try {
      const result = await terminateWorkflowClient(workflowId, userEmail, userTenantId);
      
      if (result.success) {
        // Update the workflow status locally
        setWorkflows(prev => prev.map(workflow => 
          workflow.Id === workflowId 
            ? {
                ...workflow,
                Status: 'terminated' as const,
                UpdatedAt: new Date().toISOString()
              }
            : workflow
        ));
        
        showToast({
          type: 'success',
          title: t('common.status.success'),
          content: t('workflow.message.terminatedSuccessfully')
        });
      } else {
        showToast({
          type: 'error',
          title: t('common.error'),
          content: result.error || t('workflow.errors.terminateFailed')
        });
      }
    } catch (error) {
      console.error('Error terminating workflow:', error);
      showToast({
        type: 'error',
        title: t('common.error'),
        content: t('workflow.errors.terminateFailed')
      });
    } finally {
      setTerminatingWorkflows(prev => {
        const newSet = new Set(prev);
        newSet.delete(workflowId);
        return newSet;
      });
    }
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
          title: t('common.status.success'),
          content: t('workflow.message.deletedSuccessfully')
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

  const openTerminateDialog = (workflowId: string, workflowTitle: string) => {
    setTerminateDialog({ isOpen: true, workflowId, workflowTitle });
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
        return 'red';
      default:
        return 'gray';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Box p="6" style={{ textAlign: 'center' }}>
        <Text size="5" color="gray">{(dict as any).common.loading}</Text>
      </Box>
    );
  }

  return (
    <>
      {workflows.length === 0 ? (
        <Card>
          <Box p="6" style={{ textAlign: 'center' }}>
            <Heading size="4" mb="3">{(dict as any).workflow.noActiveWorkflows}</Heading>
            <Text color="gray" mb="4">
              {(dict as any).workflow.noActiveWorkflowsDescription}
            </Text>
            <Box style={{ display: 'flex', justifyContent: 'center' }}>
              <Button asChild>
                <Link href={`/${lang}/harbor/workflow/create`}>
                  {(dict as any).workflow.createNewWorkflow}
                </Link>
              </Button>
            </Box>
          </Box>
        </Card>
      ) : (
        <Flex direction="column" gap="4">
          {workflows.map((workflow) => (
            <Card key={workflow.Id}>
              <Box p="4">
                <Flex justify="between" align="start" mb="3">
                  <Box>
                    <Heading size="4" mb="2">{workflow.Title}</Heading>
                    <Text color="gray" size="2" mb="2">
                      Initiated by: {workflow.InitiatorEmail}
                    </Text>
                    <Flex gap="3" align="center">
                      <Badge color={getStatusColor(workflow.Status)}>
                        {workflow.Status}
                      </Badge>
                      <Text size="2" color="gray">
                        Created: {formatDate(workflow.CreatedAt)}
                      </Text>
                      <Text size="2" color="gray">
                        Updated: {formatDate(workflow.UpdatedAt)}
                      </Text>
                    </Flex>
                  </Box>
                  <Flex gap="2" style={{ overflowX: 'auto', minWidth: 0 }}>
                    {workflow.Status === 'active' && (
                      <>
                        <Button 
                          color="green" 
                          onClick={() => handleCompleteWorkflow(workflow.Id)}
                          disabled={completingWorkflows.has(workflow.Id)}
                        >
                          {completingWorkflows.has(workflow.Id) ? (dict as any).workflow.completing : (dict as any).workflow.complete}
                        </Button>
                        <Button 
                          color="orange" 
                          variant="soft"
                          onClick={() => openTerminateDialog(workflow.Id, workflow.Title)}
                          disabled={terminatingWorkflows.has(workflow.Id)}
                        >
                          {terminatingWorkflows.has(workflow.Id) ? (dict as any).workflow.terminating : (dict as any).workflow.terminate}
                        </Button>
                      </>
                    )}
                    {(workflow.Status === 'completed' || workflow.Status === 'terminated') && (
                      <Button 
                        color="red" 
                        variant="soft"
                        onClick={() => openDeleteDialog(workflow.Id, workflow.Title)}
                        disabled={deletingWorkflows.has(workflow.Id)}
                      >
                        {deletingWorkflows.has(workflow.Id) ? (dict as any).workflow.deleting : (dict as any).workflow.delete}
                      </Button>
                    )}
                    <Button asChild>
                      <Link href={`/${lang}/harbor/workflow/${workflow.Id}`}>
                        {(dict as any).workflow.viewWorkflow}
                      </Link>
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            </Card>
          ))}
        </Flex>
      )}

      {/* Quick Actions */}
      <Box mt="6">
        <Card>
          <Box p="4" style={{ textAlign: 'center' }}>
            <Heading size="4" mb="3">{(dict as any).workflow.quickActions}</Heading>
            <Flex gap="3" wrap="wrap" justify="center">
              <Button asChild>
                <Link href={`/${lang}/harbor/workflow/create`}>
                  {(dict as any).workflow.createNewWorkflow}
                </Link>
              </Button>
              <Button variant="soft" asChild>
                <Link href={`/${lang}/harbor/workflow/history`}>
                  {(dict as any).workflow.viewWorkflowHistory}
                </Link>
              </Button>
            </Flex>
          </Box>
        </Card>
      </Box>

      {/* Terminate Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={terminateDialog.isOpen}
        onClose={() => setTerminateDialog({ isOpen: false, workflowId: null, workflowTitle: '' })}
        onConfirm={() => terminateDialog.workflowId && handleTerminateWorkflow(terminateDialog.workflowId)}
        title="Terminate Workflow"
        message={`Are you sure you want to terminate the workflow "${terminateDialog.workflowTitle}"? This will stop the workflow and prevent any further updates.`}
        confirmText="Terminate"
        cancelText="Cancel"
        variant="warning"
        isLoading={terminatingWorkflows.has(terminateDialog.workflowId || '')}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, workflowId: null, workflowTitle: '' })}
        onConfirm={() => deleteDialog.workflowId && handleDeleteWorkflow(deleteDialog.workflowId)}
        title="Delete Workflow"
        message={`Are you sure you want to permanently delete the workflow "${deleteDialog.workflowTitle}"? This action cannot be undone and will remove all associated messages and participants.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deletingWorkflows.has(deleteDialog.workflowId || '')}
      />
    </>
  );
} 