'use client';

import { useState } from 'react';
import { Button, Flex } from '@radix-ui/themes';
import { acceptInvitation, rejectInvitation } from '@/lib/workflow-invitations';
import { useToast } from '@/components/Toast';

interface InvitationActionsProps {
  invitationId: string;
  status: string;
  isExpired: boolean;
}

export function InvitationActions({ invitationId, status, isExpired }: InvitationActionsProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const { showToast } = useToast();

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const result = await acceptInvitation(invitationId);
      
      if (result.success) {
        showToast({
          type: 'success',
          title: 'Invitation Accepted',
          content: 'You have successfully joined the workflow'
        });
        // Reload the page to show updated status
        window.location.reload();
      } else {
        showToast({
          type: 'error',
          title: 'Failed to Accept',
          content: result.error || 'Failed to accept invitation'
        });
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Failed to accept invitation'
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const result = await rejectInvitation(invitationId);
      
      if (result.success) {
        showToast({
          type: 'success',
          title: 'Invitation Rejected',
          content: 'You have declined the invitation'
        });
        // Reload the page to show updated status
        window.location.reload();
      } else {
        showToast({
          type: 'error',
          title: 'Failed to Reject',
          content: result.error || 'Failed to reject invitation'
        });
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error',
        content: 'Failed to reject invitation'
      });
    } finally {
      setIsRejecting(false);
    }
  };

  if (status !== 'pending' || isExpired) {
    return (
      <Flex gap="2" align="center">
        <span style={{ fontSize: '12px', color: 'gray' }}>
          {status === 'accepted' ? 'Joined' : 
           status === 'rejected' ? 'Declined' : 
           isExpired ? 'Expired' : 'N/A'}
        </span>
      </Flex>
    );
  }

  return (
    <Flex gap="2">
      <Button 
        size="1" 
        color="green"
        onClick={handleAccept}
        disabled={isAccepting}
      >
        {isAccepting ? 'Accepting...' : 'Accept'}
      </Button>
      <Button 
        size="1" 
        color="red"
        variant="soft"
        onClick={handleReject}
        disabled={isRejecting}
      >
        {isRejecting ? 'Rejecting...' : 'Reject'}
      </Button>
    </Flex>
  );
}
