/**
 * Client-side utilities for workflow invitations
 */

export interface WorkflowInvitation {
  id: string;
  workflowId: string;
  workflowTitle: string;
  workflowStatus: string;
  inviterEmail: string;
  inviteeEmail: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  message?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  isExpired?: boolean;
}

export interface InviteParticipantRequest {
  inviteeEmail: string;
  role: string;
  message?: string;
}

/**
 * Invite a participant to a workflow
 */
export async function inviteParticipant(
  workflowId: string, 
  request: InviteParticipantRequest
): Promise<{ success: boolean; invitationId?: string; message?: string; error?: string }> {
  try {
    const response = await fetch(`/api/workflow/${workflowId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: (data as any).error || 'Failed to send invitation'
      };
    }

    return {
      success: true,
      invitationId: (data as any).invitationId,
      message: (data as any).message
    };
  } catch (error) {
    console.error('Error inviting participant:', error);
    return {
      success: false,
      error: 'Network error occurred'
    };
  }
}

/**
 * Accept a workflow invitation
 */
export async function acceptInvitation(invitationId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`/api/workflow/invitations/${invitationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'accept' }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: (data as any).error || 'Failed to accept invitation'
      };
    }

    return {
      success: true,
      message: (data as any).message
    };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return {
      success: false,
      error: 'Network error occurred'
    };
  }
}

/**
 * Reject a workflow invitation
 */
export async function rejectInvitation(invitationId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`/api/workflow/invitations/${invitationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'reject' }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: (data as any).error || 'Failed to reject invitation'
      };
    }

    return {
      success: true,
      message: (data as any).message
    };
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    return {
      success: false,
      error: 'Network error occurred'
    };
  }
}

/**
 * Get invitation details
 */
export async function getInvitation(invitationId: string): Promise<{ success: boolean; invitation?: WorkflowInvitation; error?: string }> {
  try {
    const response = await fetch(`/api/workflow/invitations/${invitationId}`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: (data as any).error || 'Failed to get invitation'
      };
    }

    return {
      success: true,
      invitation: (data as any).invitation
    };
  } catch (error) {
    console.error('Error getting invitation:', error);
    return {
      success: false,
      error: 'Network error occurred'
    };
  }
}

/**
 * Get all invitations for the current user
 */
export async function getInvitations(): Promise<{ success: boolean; invitations?: WorkflowInvitation[]; error?: string }> {
  try {
    const response = await fetch('/api/workflow/invitations');
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: (data as any).error || 'Failed to get invitations'
      };
    }

    return {
      success: true,
      invitations: (data as any).invitations
    };
  } catch (error) {
    console.error('Error getting invitations:', error);
    return {
      success: false,
      error: 'Network error occurred'
    };
  }
}

/**
 * Check if an invitation is expired
 */
export function isInvitationExpired(invitation: WorkflowInvitation): boolean {
  return new Date(invitation.expiresAt) < new Date();
}

/**
 * Format invitation expiration time
 */
export function formatExpirationTime(expiresAt: string): string {
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  const diffInHours = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    return 'Expires soon';
  } else if (diffInHours < 24) {
    return `Expires in ${diffInHours} hour${diffInHours > 1 ? 's' : ''}`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    return `Expires in ${diffInDays} day${diffInDays > 1 ? 's' : ''}`;
  }
} 