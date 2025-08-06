import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: NextRequest) {
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

    // Get user's invitations
    const invitationsQuery = `
      SELECT 
        wi.Id,
        wi.WorkflowId,
        wi.InviterEmail,
        wi.InviteeEmail,
        wi.Role,
        wi.Status,
        wi.Message,
        wi.ExpiresAt,
        wi.CreatedAt,
        wi.UpdatedAt,
        w.Title as WorkflowTitle,
        w.Status as WorkflowStatus,
        w.TenantId
      FROM WorkflowInvitations wi
      JOIN Workflows w ON wi.WorkflowId = w.Id
      WHERE wi.InviteeEmail = ?
      ORDER BY wi.CreatedAt DESC
    `;

    const invitations = await db.prepare(invitationsQuery)
      .bind(access.email)
      .all() as any;

    // Filter out expired invitations
    const now = new Date();
    const validInvitations = invitations.results?.filter((invitation: any) => {
      return new Date(invitation.ExpiresAt) > now;
    }) || [];

    return NextResponse.json({
      success: true,
      invitations: validInvitations.map((invitation: any) => ({
        id: invitation.Id,
        workflowId: invitation.WorkflowId,
        workflowTitle: invitation.WorkflowTitle,
        workflowStatus: invitation.WorkflowStatus,
        inviterEmail: invitation.InviterEmail,
        inviteeEmail: invitation.InviteeEmail,
        role: invitation.Role,
        status: invitation.Status,
        message: invitation.Message,
        expiresAt: invitation.ExpiresAt,
        createdAt: invitation.CreatedAt,
        updatedAt: invitation.UpdatedAt,
        isExpired: new Date(invitation.ExpiresAt) <= now
      }))
    });

  } catch (error) {
    console.error('Get invitations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 