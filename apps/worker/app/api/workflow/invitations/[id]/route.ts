import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invitationId } = await params;
  
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      action: 'accept' | 'reject';
    };

    const { action } = body;

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "accept" or "reject"' }, { status: 400 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const normalizedLogging = new NormalizedLogging(db);

    // Get invitation details
    const invitationQuery = `
      SELECT wi.*, w.TenantId, w.Title
      FROM WorkflowInvitations wi
      JOIN Workflows w ON wi.WorkflowId = w.Id
      WHERE wi.Id = ?
    `;

    const invitation = await db.prepare(invitationQuery)
      .bind(invitationId)
      .first() as any;

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if invitation is for the current user
    if (invitation.InviteeEmail !== access.email) {
      return NextResponse.json({ error: 'You can only respond to invitations sent to you' }, { status: 403 });
    }

    // Check if invitation is still pending
    if (invitation.Status !== 'pending') {
      return NextResponse.json({ error: 'Invitation has already been responded to' }, { status: 400 });
    }

    // Check if invitation has expired
    if (new Date(invitation.ExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();

    if (action === 'accept') {
      // Add user as participant to workflow
      await db.prepare(`
        INSERT INTO WorkflowParticipants (WorkflowId, ParticipantEmail, Role, JoinedAt)
        VALUES (?, ?, ?, ?)
      `).bind(invitation.WorkflowId, access.email, invitation.Role, updatedAt).run();

      // Update invitation status
      await db.prepare(`
        UPDATE WorkflowInvitations 
        SET Status = 'accepted', UpdatedAt = ?
        WHERE Id = ?
      `).bind(updatedAt, invitationId).run();

      // Log acceptance
      const { ipAddress, userAgent } = extractRequestContext(request);
      await normalizedLogging.logWorkflowOperations({
        userEmail: access.email,
        activityType: 'workflow_invite_accept',
        accessType: 'write',
        targetId: invitation.WorkflowId,
        targetName: `workflow_${invitation.WorkflowId}`,
        tenantId: invitation.TenantId,
        ipAddress,
        userAgent,
        metadata: { 
          invitationId,
          role: invitation.Role,
          workflowTitle: invitation.Title
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Invitation accepted successfully'
      });

    } else {
      // Update invitation status to rejected
      await db.prepare(`
        UPDATE WorkflowInvitations 
        SET Status = 'rejected', UpdatedAt = ?
        WHERE Id = ?
      `).bind(updatedAt, invitationId).run();

      // Log rejection
      const { ipAddress, userAgent } = extractRequestContext(request);
      await normalizedLogging.logWorkflowOperations({
        userEmail: access.email,
        activityType: 'workflow_invite_reject',
        accessType: 'write',
        targetId: invitation.WorkflowId,
        targetName: `workflow_${invitation.WorkflowId}`,
        tenantId: invitation.TenantId,
        ipAddress,
        userAgent,
        metadata: { 
          invitationId,
          role: invitation.Role,
          workflowTitle: invitation.Title
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Invitation rejected successfully'
      });
    }

  } catch (error) {
    console.error('Workflow invitation response error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE endpoint to delete an invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invitationId } = await params;
  
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const normalizedLogging = new NormalizedLogging(db);

    // Get invitation details
    const invitationQuery = `
      SELECT wi.*, w.TenantId, w.Title, wp.ParticipantEmail
      FROM WorkflowInvitations wi
      JOIN Workflows w ON wi.WorkflowId = w.Id
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      WHERE wi.Id = ?
    `;

    const invitation = await db.prepare(invitationQuery)
      .bind(invitationId)
      .all() as any;

    if (!invitation.results || invitation.results.length === 0) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invitationData = invitation.results[0];
    const participants = invitation.results.map((r: any) => r.ParticipantEmail).filter(Boolean);

    // Check if user has permission to delete this invitation
    // Only the inviter or workflow participants can delete invitations
    if (invitationData.InviterEmail !== access.email && !participants.includes(access.email)) {
      return NextResponse.json({ error: 'You do not have permission to delete this invitation' }, { status: 403 });
    }

    // Delete the invitation
    await db.prepare(`
      DELETE FROM WorkflowInvitations WHERE Id = ?
    `).bind(invitationId).run();

    // Log deletion
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logWorkflowOperations({
      userEmail: access.email,
      activityType: 'workflow_invite_delete',
      accessType: 'delete',
      targetId: invitationData.WorkflowId,
      targetName: `workflow_${invitationData.WorkflowId}`,
      tenantId: invitationData.TenantId,
      ipAddress,
      userAgent,
      metadata: { 
        invitationId,
        inviteeEmail: invitationData.InviteeEmail,
        role: invitationData.Role,
        workflowTitle: invitationData.Title
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation deleted successfully'
    });

  } catch (error) {
    console.error('Delete invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint to retrieve invitation details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invitationId } = await params;
  
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get invitation details
    const invitationQuery = `
      SELECT wi.*, w.TenantId, w.Title, w.Status as WorkflowStatus
      FROM WorkflowInvitations wi
      JOIN Workflows w ON wi.WorkflowId = w.Id
      WHERE wi.Id = ?
    `;

    const invitation = await db.prepare(invitationQuery)
      .bind(invitationId)
      .first() as any;

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if invitation is for the current user
    if (invitation.InviteeEmail !== access.email) {
      return NextResponse.json({ error: 'You can only view invitations sent to you' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.Id,
        workflowId: invitation.WorkflowId,
        workflowTitle: invitation.Title,
        workflowStatus: invitation.WorkflowStatus,
        inviterEmail: invitation.InviterEmail,
        inviteeEmail: invitation.InviteeEmail,
        role: invitation.Role,
        status: invitation.Status,
        message: invitation.Message,
        expiresAt: invitation.ExpiresAt,
        createdAt: invitation.CreatedAt,
        updatedAt: invitation.UpdatedAt
      }
    });

  } catch (error) {
    console.error('Get invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 