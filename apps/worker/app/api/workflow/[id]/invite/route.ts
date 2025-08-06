import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import { randomUUID } from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workflowId } = await params;
  
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      inviteeEmail: string;
      role: string;
      message?: string;
    };

    const { inviteeEmail, role, message } = body;

    if (!inviteeEmail || !role) {
      return NextResponse.json({ error: 'Invitee email and role are required' }, { status: 400 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(access.email, db);

    // Get workflow details and verify access
    const workflowQuery = `
      SELECT w.*, wp.ParticipantEmail
      FROM Workflows w
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      WHERE w.Id = ?
    `;

    const workflow = await db.prepare(workflowQuery)
      .bind(workflowId)
      .all() as any;

    if (!workflow.results || workflow.results.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const workflowData = workflow.results[0];
    const participants = workflow.results.map((r: any) => r.ParticipantEmail).filter(Boolean);

    // Check if user has access to this workflow
    if (!isAdmin && !participants.includes(access.email)) {
      return NextResponse.json({ error: 'You do not have permission to invite participants to this workflow' }, { status: 403 });
    }

    // Check if invitee is already a participant
    if (participants.includes(inviteeEmail)) {
      return NextResponse.json({ error: 'User is already a participant in this workflow' }, { status: 400 });
    }

    // Check if there's already a pending invitation
    const existingInvitation = await db.prepare(`
      SELECT 1 FROM WorkflowInvitations 
      WHERE WorkflowId = ? AND InviteeEmail = ? AND Status = 'pending'
    `).bind(workflowId, inviteeEmail).first();

    if (existingInvitation) {
      return NextResponse.json({ error: 'User already has a pending invitation to this workflow' }, { status: 400 });
    }

    // Create invitation
    const invitationId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const createdAt = new Date().toISOString();

    await db.prepare(`
      INSERT INTO WorkflowInvitations (
        Id, WorkflowId, InviterEmail, InviteeEmail, Role, Status, 
        Message, ExpiresAt, CreatedAt, UpdatedAt
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).bind(
      invitationId, workflowId, access.email, inviteeEmail, role,
      message || '', expiresAt.toISOString(), createdAt, createdAt
    ).run();

    // Log the invitation
    await systemLogs.logUserOperation({
      userEmail: access.email,
      activityType: 'WORKFLOW_INVITE',
      targetId: inviteeEmail,
      targetName: `workflow_invitation_${workflowId}`,
      tenantId: workflowData.TenantId,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { 
        workflowId, 
        role, 
        invitationId,
        message: message || ''
      }
    });

    return NextResponse.json({
      success: true,
      invitationId,
      message: 'Invitation sent successfully'
    });

  } catch (error) {
    console.error('Workflow invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 