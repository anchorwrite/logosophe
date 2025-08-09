'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, Box, Text, Heading, Flex, Button, Badge, Separator, Table, Dialog } from '@radix-ui/themes';
import Link from 'next/link';

interface WorkflowMessage {
  id: string;
  senderEmail: string;
  senderRole: string;
  content: string;
  timestamp: string;
  messageType: string;
}

interface WorkflowParticipant {
  email: string;
  role: string;
  joinedAt: string;
  status: string;
}

interface WorkflowDetails {
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
  completedAt?: string;
  terminatedAt?: string;
  terminatedBy?: string;
  participants?: WorkflowParticipant[];
  messages?: WorkflowMessage[];
  participantCount?: number;
  messageCount?: number;
}

interface WorkflowDetailsResponse {
  success: boolean;
  workflow?: WorkflowDetails;
  error?: string;
}

interface DashboardWorkflowDetailsProps {
  workflowId: string;
  userEmail: string;
  isGlobalAdmin: boolean;
}

export function DashboardWorkflowDetails({ workflowId, userEmail, isGlobalAdmin }: DashboardWorkflowDetailsProps) {
  const [workflow, setWorkflow] = useState<WorkflowDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);

  // Scroll to top when dialogs open
  useEffect(() => {
    if (showTerminateDialog || showDeleteDialog || showPermanentDeleteDialog) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showTerminateDialog, showDeleteDialog, showPermanentDeleteDialog]);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const fetchWorkflowDetails = async () => {
      // Prevent multiple simultaneous requests
      if (fetchingRef.current) {
        return;
      }
      
      try {
        fetchingRef.current = true;
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/dashboard/workflow/${workflowId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('DashboardWorkflowDetails: Response error:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data: WorkflowDetailsResponse = await response.json();
        
        if (data.success && data.workflow) {
          setWorkflow(data.workflow);
        } else {
          setError(data.error || 'Failed to fetch workflow details');
        }
      } catch (err) {
        console.error('Error fetching workflow details:', err);
        setError('Failed to load workflow details');
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    // Only fetch if we have the required data
    if (workflowId && userEmail) {
      fetchWorkflowDetails();
    }
  }, [workflowId, userEmail]);

  const handleAdminAction = async (action: string) => {
    if (!workflow) return;

    try {
      setActionLoading(true);
      
      const response = await fetch(`/api/dashboard/workflow/${workflowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          adminEmail: userEmail,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result = await response.json() as { success: boolean; error?: string };
      
      if (result.success) {
        // Refresh workflow details
        window.location.reload();
      } else {
        setError(result.error || 'Failed to perform action');
      }
    } catch (err) {
      console.error('Error performing admin action:', err);
      setError('Failed to perform action');
    } finally {
      setActionLoading(false);
    }
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
          <Text size="2" color="gray">Loading workflow details...</Text>
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

  if (!workflow) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="gray">Workflow not found.</Text>
        </Box>
      </Card>
    );
  }

  const canManage = (workflow.Status || workflow.status) === 'active' || (workflow.Status || workflow.status) === 'terminated';

  return (
    <Box>
      {/* Workflow Header */}
      <Card style={{ marginBottom: '1rem' }}>
        <Box p="4">
          <Flex justify="between" align="start" style={{ marginBottom: '1rem' }}>
            <Box style={{ flex: '1' }}>
              <Heading size="4" style={{ marginBottom: '0.5rem' }}>
                {workflow.Title || workflow.title}
              </Heading>
              <Text color="gray" size="2" style={{ marginBottom: '1rem' }}>
                {workflow.description}
              </Text>
              <Flex gap="2" align="center">
                <Badge color={getStatusColor(workflow.Status || workflow.status)}>
                  {workflow.Status || workflow.status || 'Unknown'}
                </Badge>
                <Text size="2" color="gray">
                  Tenant: {workflow.TenantName || workflow.tenantName || 'Unknown'}
                </Text>
              </Flex>
            </Box>
            <Flex gap="2">
              <Button variant="soft" asChild>
                <Link href="/dashboard/workflow">
                  ← Back to Workflows
                </Link>
              </Button>
              {canManage && (
                <Flex gap="2">
                  {(workflow.Status || workflow.status) === 'terminated' ? (
                    <Button 
                      size="2" 
                      variant="soft" 
                      color="green"
                      disabled={actionLoading}
                      onClick={() => setShowTerminateDialog(true)}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button 
                      size="2" 
                      variant="soft" 
                      color="red"
                      disabled={actionLoading}
                      onClick={() => setShowTerminateDialog(true)}
                    >
                      Terminate
                    </Button>
                  )}
                  <Button 
                    size="2" 
                    variant="soft" 
                    color="orange"
                    disabled={actionLoading}
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    Delete
                  </Button>
                </Flex>
              )}
              {canManage && (workflow.Status || workflow.status) === 'deleted' && (
                <Flex gap="2">
                  <Button 
                    size="2" 
                    variant="solid" 
                    color="red"
                    disabled={actionLoading}
                    onClick={() => setShowPermanentDeleteDialog(true)}
                  >
                    Permanently Delete
                  </Button>
                </Flex>
              )}
            </Flex>
          </Flex>
        </Box>
      </Card>

      {/* Workflow Information */}
      <Flex gap="4" wrap="wrap" style={{ marginBottom: '2rem' }}>
        <Card style={{ flex: '1', minWidth: '300px' }}>
          <Box p="4">
            <Heading size="3" style={{ marginBottom: '1rem' }}>Workflow Information</Heading>
            <Flex direction="column" gap="2">
              <Box>
                <Text size="1" color="gray">Initiator</Text>
                <Text size="2">{workflow.InitiatorEmail || workflow.initiatorEmail || 'Unknown'} ({workflow.initiatorRole || 'Unknown'})</Text>
              </Box>
              <Box>
                <Text size="1" color="gray">Created</Text>
                <Text size="2">{formatDate(workflow.CreatedAt || workflow.createdAt || new Date().toISOString())}</Text>
              </Box>
              <Box>
                <Text size="1" color="gray">Last Updated</Text>
                <Text size="2">{formatDate(workflow.UpdatedAt || workflow.updatedAt || new Date().toISOString())}</Text>
              </Box>
              {workflow.completedAt && (
                <Box>
                  <Text size="1" color="gray">Completed</Text>
                  <Text size="2">{formatDate(workflow.completedAt)}</Text>
                </Box>
              )}
              {workflow.terminatedAt && (
                <Box>
                  <Text size="1" color="gray">Terminated</Text>
                  <Text size="2">{formatDate(workflow.terminatedAt)}</Text>
                  {workflow.terminatedBy && (
                    <Text size="1" color="gray">by {workflow.terminatedBy}</Text>
                  )}
                </Box>
              )}
            </Flex>
          </Box>
        </Card>

        <Card style={{ flex: '1', minWidth: '300px' }}>
          <Box p="4">
            <Heading size="3" style={{ marginBottom: '1rem' }}>Statistics</Heading>
            <Flex direction="column" gap="2">
              <Box>
                <Text size="1" color="gray">Participants</Text>
                <Text size="2">{workflow.participantCount || 0}</Text>
              </Box>
              <Box>
                <Text size="1" color="gray">Messages</Text>
                <Text size="2">{workflow.messageCount || 0}</Text>
              </Box>
              <Box>
                <Text size="1" color="gray">Workflow ID</Text>
                <Text size="2" style={{ fontFamily: 'monospace' }}>{workflow.Id || workflow.id || 'Unknown'}</Text>
              </Box>
            </Flex>
          </Box>
        </Card>
      </Flex>

      {/* Participants */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box p="4">
          <Heading size="3" style={{ marginBottom: '1rem' }}>Participants</Heading>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Joined</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {workflow.participants?.map((participant) => (
                <Table.Row key={participant.email}>
                  <Table.Cell>
                    <Text size="2">{participant.email}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{participant.role}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={participant.status === 'active' ? 'green' : 'gray'}>
                      {participant.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{formatDate(participant.joinedAt)}</Text>
                  </Table.Cell>
                </Table.Row>
              )) || (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <Text size="2" color="gray">No participants found.</Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      </Card>

      {/* Messages */}
      <Card>
        <Box p="4">
          <Heading size="3" style={{ marginBottom: '1rem' }}>Messages</Heading>
          {!workflow.messages || workflow.messages.length === 0 ? (
            <Text size="2" color="gray">No messages in this workflow.</Text>
          ) : (
            <Flex direction="column" gap="3">
              {workflow.messages.map((message) => (
                <Box key={message.id} style={{ border: '1px solid var(--gray-6)', borderRadius: 'var(--radius-3)', padding: '1rem' }}>
                  <Flex justify="between" align="center" style={{ marginBottom: '0.5rem' }}>
                    <Flex gap="2" align="center">
                      <Text size="2" weight="medium">{message.senderEmail}</Text>
                      <Text size="1" color="gray">({message.senderRole})</Text>
                      <Badge size="1" color="blue">{message.messageType}</Badge>
                    </Flex>
                    <Text size="1" color="gray">{formatDate(message.timestamp)}</Text>
                  </Flex>
                  <Text size="2">{message.content}</Text>
                </Box>
              ))}
            </Flex>
          )}
        </Box>
      </Card>

      {/* Terminate/Reactivate Confirmation Dialog */}
      <Dialog.Root open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
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
          <Dialog.Title>
            {(workflow.Status || workflow.status) === 'terminated' ? 'Reactivate Workflow' : 'Terminate Workflow'}
          </Dialog.Title>
          <Box mb="4">
            <Text size="2" mb="2">
              {(workflow.Status || workflow.status) === 'terminated' 
                ? 'Are you sure you want to reactivate this workflow? This action will:'
                : 'Are you sure you want to terminate this workflow? This action will:'
              }
            </Text>
            {(workflow.Status || workflow.status) === 'terminated' ? (
              <>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', marginBottom: '1rem' }}>
                  <li>Resume active collaboration</li>
                  <li>Allow new messages to be sent</li>
                  <li>Restore the workflow to active status</li>
                </ul>
                <Text size="2" color="green" style={{ fontWeight: 'bold' }}>
                  The workflow will be available for collaboration again.
                </Text>
              </>
            ) : (
              <>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', marginBottom: '1rem' }}>
                  <li>Stop all active collaboration</li>
                  <li>Prevent new messages from being sent</li>
                  <li>Record the termination in workflow history</li>
                </ul>
                <Text size="2" color="red" style={{ fontWeight: 'bold' }}>
                  This action cannot be undone.
                </Text>
              </>
            )}
          </Box>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button 
              color={(workflow.Status || workflow.status) === 'terminated' ? 'green' : 'red'}
              disabled={actionLoading}
              onClick={async () => {
                setShowTerminateDialog(false);
                await handleAdminAction((workflow.Status || workflow.status) === 'terminated' ? 'reactivate' : 'terminate');
              }}
            >
              {actionLoading 
                ? ((workflow.Status || workflow.status) === 'terminated' ? 'Reactivating...' : 'Terminating...') 
                : ((workflow.Status || workflow.status) === 'terminated' ? 'Reactivate Workflow' : 'Terminate Workflow')
              }
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
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
          <Dialog.Title>Delete Workflow</Dialog.Title>
          <Box mb="4">
            <Text size="2" mb="2">
              Are you sure you want to delete this workflow? This action will:
            </Text>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', marginBottom: '1rem' }}>
              <li>Mark the workflow as deleted</li>
              <li>Hide it from active workflow lists</li>
              <li>Preserve all data for audit purposes</li>
            </ul>
            <Text size="2" color="blue" style={{ fontWeight: 'bold' }}>
              The workflow can be permanently deleted later if needed.
            </Text>
          </Box>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button 
              color="orange" 
              disabled={actionLoading}
              onClick={async () => {
                setShowDeleteDialog(false);
                await handleAdminAction('delete');
              }}
            >
              {actionLoading ? 'Deleting...' : 'Delete Workflow'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog.Root open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
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
          <Dialog.Title>Permanently Delete Workflow</Dialog.Title>
          <Box mb="4">
            <Text size="2" mb="2">
              Are you sure you want to PERMANENTLY delete this workflow? This action will:
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
              disabled={actionLoading}
              onClick={async () => {
                setShowPermanentDeleteDialog(false);
                await handleAdminAction('hard_delete');
              }}
            >
              {actionLoading ? 'Permanently Deleting...' : 'Permanently Delete'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
} 