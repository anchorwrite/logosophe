import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SystemLogs } from '@/lib/system-logs';

export async function POST(
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
    const systemLogs = new SystemLogs(db);

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

    // Check if user has permission to resend this invitation
    // Only the inviter or workflow participants can resend invitations
    if (invitationData.InviterEmail !== access.email && !participants.includes(access.email)) {
      return NextResponse.json({ error: 'You do not have permission to resend this invitation' }, { status: 403 });
    }

    // Check if invitation is still pending
    if (invitationData.Status !== 'pending') {
      return NextResponse.json({ error: 'Can only resend pending invitations' }, { status: 400 });
    }

    // Check if invitation has expired
    if (new Date(invitationData.ExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Cannot resend expired invitations' }, { status: 400 });
    }

    // Update invitation with new expiration date (extend by 7 days)
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updatedAt = new Date().toISOString();

    await db.prepare(`
      UPDATE WorkflowInvitations 
      SET ExpiresAt = ?, UpdatedAt = ?
      WHERE Id = ?
    `).bind(newExpiresAt.toISOString(), updatedAt, invitationId).run();

    // Log resend
    await systemLogs.logUserOperation({
      userEmail: access.email,
              activityType: 'workflow_invite_resend',
      targetId: invitationData.WorkflowId,
      targetName: `workflow_${invitationData.WorkflowId}`,
      tenantId: invitationData.TenantId,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { 
        invitationId,
        inviteeEmail: invitationData.InviteeEmail,
        role: invitationData.Role,
        workflowTitle: invitationData.Title,
        newExpiresAt: newExpiresAt.toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully',
      newExpiresAt: newExpiresAt.toISOString()
    });

  } catch (error) {
    console.error('Resend invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 