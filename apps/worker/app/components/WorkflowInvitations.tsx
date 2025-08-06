'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Text, Flex } from '@radix-ui/themes';
import { getInvitations } from '@/lib/workflow-invitations';

interface WorkflowInvitationsProps {
  workflowId: string;
  workflowTitle: string;
  currentUserEmail: string;
}

export default function WorkflowInvitations({ workflowId, workflowTitle, currentUserEmail }: WorkflowInvitationsProps) {
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card>
      <Flex justify="between" align="center" mb="4">
        <Text size="5" weight="bold">Workflow Invitations</Text>
        <Button>
          Invite Participant
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
        <Text>Found {invitations.length} invitation(s)</Text>
      )}
    </Card>
  );
} 