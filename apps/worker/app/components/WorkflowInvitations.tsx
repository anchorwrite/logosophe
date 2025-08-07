'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Text, Flex, Dialog, Box, Heading, Badge, Table } from '@radix-ui/themes';
import { getInvitations, inviteParticipant, type WorkflowInvitation } from '@/lib/workflow-invitations';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import WorkflowInvitationParticipantSelector from './WorkflowInvitationParticipantSelector';

interface WorkflowInvitationsProps {
  workflowId: string;
  workflowTitle: string;
  currentUserEmail: string;
  workflowTenantId: string;
  existingParticipants: Array<{ email: string; role: string }>;
}

export default function WorkflowInvitations({ 
  workflowId, 
  workflowTitle, 
  currentUserEmail,
  workflowTenantId,
  existingParticipants
}: WorkflowInvitationsProps) {
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<WorkflowInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const { showToast } = useToast();
  const { t } = useTranslation('translations');

  // Load invitations
  const loadInvitations = async () => {
    try {
      setLoading(true);
      const result = await getInvitations();
      
      if (result.success && result.invitations) {
        // Filter invitations for this workflow
        const workflowInvitations = result.invitations.filter(inv => inv.workflowId === workflowId);
        setInvitations(workflowInvitations);
      } else {
        setError(result.error || 'Failed to load invitations');
      }
    } catch (error) {
      setError('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, [workflowId]);

  const handleInviteParticipants = async (selectedParticipants: Array<{ email: string; role: string }>) => {
    if (selectedParticipants.length === 0) return;

    setIsInviting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const participant of selectedParticipants) {
      try {
        const result = await inviteParticipant(workflowId, {
          inviteeEmail: participant.email,
          role: participant.role,
          message: `You have been invited to join the workflow "${workflowTitle}"`
        });

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Failed to invite ${participant.email}:`, result.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error inviting ${participant.email}:`, error);
      }
    }

    // Show results
    if (successCount > 0) {
      showToast({
        type: 'success',
        title: 'Invitations Sent',
        content: `Successfully sent ${successCount} invitation${successCount > 1 ? 's' : ''}`
      });
    }

    if (errorCount > 0) {
      showToast({
        type: 'error',
        title: 'Some Invitations Failed',
        content: `Failed to send ${errorCount} invitation${errorCount > 1 ? 's' : ''}`
      });
    }

    // Reload invitations to show new ones
    await loadInvitations();
    setShowInviteDialog(false);
    setIsInviting(false);
  };

  const getInvitationStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'orange';
      case 'accepted':
        return 'green';
      case 'rejected':
        return 'red';
      case 'expired':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card>
      <Box p="4">
        <Flex justify="between" align="center" mb="4">
          <Heading size="4">Workflow Invitations</Heading>
          <Button 
            onClick={() => setShowInviteDialog(true)}
            disabled={isInviting}
          >
            {isInviting ? 'Inviting...' : 'Invite Participants'}
          </Button>
        </Flex>

        {error && (
          <Text color="red" mb="3">{error}</Text>
        )}

        {loading ? (
          <Text>Loading invitations...</Text>
        ) : invitations.length === 0 ? (
          <Text color="gray">No invitations for this workflow</Text>
        ) : (
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Invitee</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Invited</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Expires</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {invitations.map((invitation) => (
                <Table.Row key={invitation.id}>
                  <Table.Cell>
                    <Text weight="medium">{invitation.inviteeEmail}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{invitation.role}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={getInvitationStatusColor(invitation.status)}>
                      {invitation.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {formatDate(invitation.createdAt)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {formatDate(invitation.expiresAt)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Box>

      {/* Invite Participants Dialog */}
      <Dialog.Root open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <Dialog.Content style={{ maxWidth: '1000px', maxHeight: '80vh' }}>
          <Dialog.Title>Invite Participants to Workflow</Dialog.Title>
          <WorkflowInvitationParticipantSelector
            userEmail={currentUserEmail}
            selectedTenantId={workflowTenantId}
            existingParticipants={existingParticipants}
            onSelectionChange={handleInviteParticipants}
            onClose={() => setShowInviteDialog(false)}
          />
        </Dialog.Content>
      </Dialog.Root>
    </Card>
  );
} 