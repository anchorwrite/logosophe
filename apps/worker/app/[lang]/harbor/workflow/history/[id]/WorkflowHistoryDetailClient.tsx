'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, Text, Flex, Badge, Button, Box, Heading, Table, Separator } from '@radix-ui/themes';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import Link from 'next/link';


interface WorkflowHistoryDetail {
  Id: string;
  Title: string;
  TenantId: string;
  InitiatorEmail: string;
  Status: string;
  CreatedAt: string;
  UpdatedAt: string;
  CompletedAt?: string;
  CompletedBy?: string;
  DeletedAt?: string;
  DeletedBy?: string;
  EventType: string;
  EventTimestamp: string;
  EventPerformedBy: string;
}

interface WorkflowParticipant {
  WorkflowId: string;
  ParticipantEmail: string;
  Role: string;
  JoinedAt: string;
}

interface WorkflowHistoryResponse {
  success: boolean;
  workflow?: WorkflowHistoryDetail;
  participants?: WorkflowParticipant[];
  error?: string;
}

interface WorkflowHistoryDetailClientProps {
  workflowId: string;
  lang: string;
  userEmail: string;
  userRole: string;
}

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

export default function WorkflowHistoryDetailClient({ 
  workflowId, 
  lang, 
  userEmail, 
  userRole 
}: WorkflowHistoryDetailClientProps) {
  const [workflow, setWorkflow] = useState<WorkflowHistoryDetail | null>(null);
  const [participants, setParticipants] = useState<WorkflowParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const fetchWorkflowHistory = async () => {
      // Prevent multiple simultaneous requests
      if (fetchingRef.current) {
        return;
      }
      
      try {
        fetchingRef.current = true;
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/workflow/history/detail/${workflowId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: WorkflowHistoryResponse = await response.json();
        
        if (data.success && data.workflow) {
          setWorkflow(data.workflow);
          setParticipants(data.participants || []);
        } else {
          setError(data.error || 'Failed to fetch workflow history');
        }
      } catch (err) {
        console.error('Error fetching workflow history:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    if (workflowId) {
      fetchWorkflowHistory();
    }
  }, [workflowId, userEmail]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'blue';
      case 'completed':
        return 'green';
      case 'terminated':
        return 'orange';
      case 'deleted':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'terminated':
        return 'Terminated';
      case 'deleted':
        return 'Deleted';
      default:
        return status;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'initiator':
        return 'Initiator';
      case 'editor':
        return 'Editor';
      case 'agent':
        return 'Agent';
      case 'reviewer':
        return 'Reviewer';
      case 'recipient':
        return 'Recipient';
      default:
        return role.charAt(0).toUpperCase() + role.slice(1);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <Text>Loading workflow history...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center min-h-64 gap-4">
        <Text color="red">{error}</Text>
        <Button asChild>
          <Link href={`/${lang}/harbor/workflow/history`}>
            Back to History
          </Link>
        </Button>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex flex-col items-center min-h-64 gap-4">
        <Text>Workflow not found</Text>
        <Button asChild>
          <Link href={`/${lang}/harbor/workflow/history`}>
            Back to History
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Box style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <Flex justify="between" align="center" mb="6">
        <Flex align="center" gap="3">
          <Button variant="soft" asChild>
            <Link href={`/${lang}/harbor/workflow/history`}>
              <ArrowLeftIcon />
              Back to History
            </Link>
          </Button>
          <Heading size="5">Workflow History Detail</Heading>
        </Flex>
        <Badge color={getStatusColor(workflow.Status)} variant="soft" size="2">
          {getStatusLabel(workflow.Status)}
        </Badge>
      </Flex>

      {/* Workflow Summary */}
      <Card size="3" mb="4">
        <Box p="4">
          <Heading size="4" mb="4">Workflow Summary</Heading>
          <Table.Root>
            <Table.Body>
              <Table.Row>
                <Table.Cell>
                  <Text size="2" weight="medium">Title</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="3">{workflow.Title}</Text>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <Text size="2" weight="medium">Workflow ID</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="3" style={{ fontFamily: 'monospace' }}>{workflow.Id}</Text>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <Text size="2" weight="medium">Initiator</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="3">{workflow.InitiatorEmail}</Text>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <Text size="2" weight="medium">Status</Text>
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2" align="center">
                    <Badge color={getStatusColor(workflow.Status)}>
                      {getStatusLabel(workflow.Status)}
                    </Badge>
                    {workflow.Status === 'completed' && !workflow.DeletedAt && (
                      <Button size="1" variant="soft" asChild>
                        <Link href={`/${lang}/harbor/workflow/${workflow.Id}`}>
                          View Workflow Details
                        </Link>
                      </Button>
                    )}
                  </Flex>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <Text size="2" weight="medium">Participants</Text>
                </Table.Cell>
                <Table.Cell>
                  <Box>
                    <Text size="3">{participants.length} members</Text>
                    {participants.length > 0 && (
                      <Box mt="2">
                        <Flex direction="column" gap="1">
                          {participants.map((participant, index) => (
                            <Flex key={index} justify="between" align="center">
                              <Text size="2" color="gray">
                                {participant.ParticipantEmail}
                              </Text>
                              <Badge size="1" variant="soft">
                                {getRoleLabel(participant.Role)}
                              </Badge>
                            </Flex>
                          ))}
                        </Flex>
                      </Box>
                    )}
                  </Box>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        </Box>
      </Card>

      {/* Timeline */}
      <Card size="3">
        <Box p="4">
          <Heading size="4" mb="4">Workflow Timeline</Heading>
          <Flex direction="column" gap="3">
            {/* Created */}
            <Flex justify="between" align="center" p="3" style={{ backgroundColor: 'var(--gray-2)', borderRadius: 'var(--radius-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">Workflow Created</Text>
                <Text size="1" color="gray">
                  By: {workflow.InitiatorEmail}
                </Text>
              </Flex>
              <Text size="2" color="gray">
                {formatDate(workflow.CreatedAt)}
              </Text>
            </Flex>

            {/* Last Updated */}
            {workflow.UpdatedAt !== workflow.CreatedAt && (
              <Flex justify="between" align="center" p="3" style={{ backgroundColor: 'var(--gray-2)', borderRadius: 'var(--radius-2)' }}>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">Last Updated</Text>
                  <Text size="1" color="gray">
                    Workflow modified
                  </Text>
                </Flex>
                <Text size="2" color="gray">
                  {formatDate(workflow.UpdatedAt)}
                </Text>
              </Flex>
            )}

            {/* Completed */}
            {workflow.CompletedAt && (
              <Flex justify="between" align="center" p="3" style={{ backgroundColor: 'var(--green-2)', borderRadius: 'var(--radius-2)' }}>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">Workflow Completed</Text>
                  <Text size="1" color="gray">
                    By: {workflow.CompletedBy || 'Unknown'}
                  </Text>
                </Flex>
                <Text size="2" color="gray">
                  {formatDate(workflow.CompletedAt)}
                </Text>
              </Flex>
            )}

            {/* Deleted */}
            {workflow.DeletedAt && (
              <Flex justify="between" align="center" p="3" style={{ backgroundColor: 'var(--red-2)', borderRadius: 'var(--radius-2)' }}>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">Workflow Deleted</Text>
                  <Text size="1" color="gray">
                    By: {workflow.DeletedBy || 'Unknown'}
                  </Text>
                </Flex>
                <Text size="2" color="gray">
                  {formatDate(workflow.DeletedAt)}
                </Text>
              </Flex>
            )}

            {/* Latest Event */}
            <Separator my="3" />
            <Flex justify="between" align="center" p="3" style={{ backgroundColor: 'var(--blue-2)', borderRadius: 'var(--radius-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Latest Event: {workflow.EventType.charAt(0).toUpperCase() + workflow.EventType.slice(1)}
                </Text>
                <Text size="1" color="gray">
                  Performed by: {workflow.EventPerformedBy}
                </Text>
              </Flex>
              <Text size="2" color="gray">
                {formatDate(workflow.EventTimestamp)}
              </Text>
            </Flex>
          </Flex>
        </Box>
      </Card>
    </Box>
  );
} 