'use client';

import { useState } from 'react';
import { Card, Box, Text, Heading, Flex, Button, Checkbox, Select, AlertDialog } from '@radix-ui/themes';

interface Workflow {
  id: string;
  title: string;
  status: string;
  tenantName: string;
}

interface DashboardWorkflowBulkActionsProps {
  workflows: Workflow[];
  selectedWorkflows: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onBulkAction: (action: string, workflowIds: string[]) => Promise<void>;
  userEmail: string;
  isGlobalAdmin: boolean;
}

export function DashboardWorkflowBulkActions({ 
  workflows, 
  selectedWorkflows, 
  onSelectionChange, 
  onBulkAction,
  userEmail,
  isGlobalAdmin 
}: DashboardWorkflowBulkActionsProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(workflows.map(w => w.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectWorkflow = (workflowId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedWorkflows, workflowId]);
    } else {
      onSelectionChange(selectedWorkflows.filter(id => id !== workflowId));
    }
  };

  const handleBulkAction = async () => {
    if (!selectedAction || selectedWorkflows.length === 0) return;

    setActionLoading(true);
    try {
      await onBulkAction(selectedAction, selectedWorkflows);
      // Clear selection after successful action
      onSelectionChange([]);
      setSelectedAction('');
    } catch (error) {
      console.error('Bulk action error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const getActionDescription = (action: string) => {
    switch (action) {
      case 'pause':
        return 'Pause all selected active workflows';
      case 'resume':
        return 'Resume all selected paused workflows';
      case 'terminate':
        return 'Terminate all selected workflows (this action cannot be undone)';
      default:
        return '';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'pause':
        return 'orange';
      case 'resume':
        return 'green';
      case 'terminate':
        return 'red';
      default:
        return 'gray';
    }
  };

  const canPerformAction = (action: string, workflow: Workflow) => {
    switch (action) {
      case 'pause':
        return workflow.status === 'active';
      case 'resume':
        return workflow.status === 'paused';
      case 'terminate':
        return workflow.status === 'active' || workflow.status === 'paused';
      default:
        return false;
    }
  };

  const getActionableWorkflows = (action: string) => {
    return selectedWorkflows.filter(id => {
      const workflow = workflows.find(w => w.id === id);
      return workflow && canPerformAction(action, workflow);
    });
  };

  const actionableCount = selectedAction ? getActionableWorkflows(selectedAction).length : 0;

  return (
    <Card>
      <Box p="4">
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Heading size="3">Bulk Actions</Heading>
          <Text size="2" color="gray">
            {selectedWorkflows.length} of {workflows.length} selected
          </Text>
        </Flex>

        {/* Select All */}
        <Box style={{ marginBottom: '1rem' }}>
          <Flex gap="2" align="center">
            <Checkbox
              checked={selectedWorkflows.length === workflows.length && workflows.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <Text size="2">Select All Workflows</Text>
          </Flex>
        </Box>

        {/* Bulk Action Controls */}
        {selectedWorkflows.length > 0 && (
          <Flex gap="3" align="center" wrap="wrap">
            <Box>
              <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
                Action
              </Text>
              <Select.Root value={selectedAction} onValueChange={setSelectedAction}>
                <Select.Trigger placeholder="Select action..." />
                <Select.Content>
                  <Select.Item value="pause">Pause Workflows</Select.Item>
                  <Select.Item value="resume">Resume Workflows</Select.Item>
                  <Select.Item value="terminate">Terminate Workflows</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>

            {selectedAction && (
              <Box>
                <Text size="2" color="gray">
                  {actionableCount} of {selectedWorkflows.length} workflows can be {selectedAction}d
                </Text>
              </Box>
            )}

            {selectedAction && actionableCount > 0 && (
              <AlertDialog.Root>
                <AlertDialog.Trigger>
                  <Button 
                    color={getActionColor(selectedAction) as any}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : `${selectedAction.charAt(0).toUpperCase() + selectedAction.slice(1)} ${actionableCount} Workflows`}
                  </Button>
                </AlertDialog.Trigger>
                <AlertDialog.Content>
                  <AlertDialog.Title>Confirm Bulk Action</AlertDialog.Title>
                  <AlertDialog.Description>
                    {getActionDescription(selectedAction)}
                    <br /><br />
                    This will affect {actionableCount} workflow(s). This action cannot be undone.
                  </AlertDialog.Description>
                  <Flex gap="3" mt="4" justify="end">
                    <AlertDialog.Cancel>
                      <Button variant="soft" color="gray">
                        Cancel
                      </Button>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action>
                      <Button 
                        color={getActionColor(selectedAction) as any}
                        onClick={handleBulkAction}
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Processing...' : 'Confirm'}
                      </Button>
                    </AlertDialog.Action>
                  </Flex>
                </AlertDialog.Content>
              </AlertDialog.Root>
            )}
          </Flex>
        )}

        {/* Selected Workflows List */}
        {selectedWorkflows.length > 0 && (
          <Box style={{ marginTop: '1rem' }}>
            <Text size="2" weight="medium" style={{ marginBottom: '0.5rem' }}>
              Selected Workflows:
            </Text>
            <Box style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--gray-6)', borderRadius: 'var(--radius-3)', padding: '0.5rem' }}>
              {selectedWorkflows.map(workflowId => {
                const workflow = workflows.find(w => w.id === workflowId);
                if (!workflow) return null;

                return (
                  <Flex key={workflowId} justify="between" align="center" style={{ padding: '0.25rem 0' }}>
                    <Flex gap="2" align="center">
                      <Checkbox
                        checked={selectedWorkflows.includes(workflowId)}
                        onCheckedChange={(checked) => handleSelectWorkflow(workflowId, checked as boolean)}
                      />
                      <Text size="2">{workflow.title}</Text>
                      <Text size="1" color="gray">({workflow.tenantName})</Text>
                    </Flex>
                    <Text size="1" color="gray">{workflow.status}</Text>
                  </Flex>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    </Card>
  );
} 