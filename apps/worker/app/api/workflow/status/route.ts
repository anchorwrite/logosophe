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
      return NextResponse.json({ error: 'You do not have permission to view workflow status' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user has access to this workflow
    const workflowAccessCheck = await db.prepare(`
      SELECT 1 FROM WorkflowParticipants 
      WHERE WorkflowId = ? AND ParticipantEmail = ?
    `).bind(workflowId, access.email).first();

    if (!workflowAccessCheck) {
      return NextResponse.json(
        { error: 'You do not have access to this workflow' },
        { status: 403 }
      );
    }

    // Get workflow details
    const workflowQuery = `
      SELECT 
        w.Id,
        w.Title,
        w.Status,
        w.CreatedAt,
        w.CompletedAt,
        w.CompletedBy,
        w.TenantId,
        COUNT(wm.Id) as messageCount,
        COUNT(DISTINCT wp.ParticipantEmail) as participantCount
      FROM Workflows w
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      WHERE w.Id = ?
      GROUP BY w.Id, w.Title, w.Status, w.CreatedAt, w.CompletedAt, w.CompletedBy, w.TenantId
    `;

    const workflow = await db.prepare(workflowQuery).bind(workflowId).first();

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Get recent messages
    const messagesQuery = `
      SELECT 
        wm.Id,
        wm.SenderEmail,
        wm.Content,
        wm.MessageType,
        wm.CreatedAt,
        wm.MediaFileId,
        wm.ShareToken
      FROM WorkflowMessages wm
      WHERE wm.WorkflowId = ?
      ORDER BY wm.CreatedAt ASC
      LIMIT 10
    `;

    const messages = await db.prepare(messagesQuery).bind(workflowId).all();

    // Get participants
    const participantsQuery = `
      SELECT 
        wp.ParticipantEmail,
        wp.Role,
        wp.JoinedAt
      FROM WorkflowParticipants wp
      WHERE wp.WorkflowId = ?
      ORDER BY wp.JoinedAt
    `;

    const participants = await db.prepare(participantsQuery).bind(workflowId).all();

    return NextResponse.json({
      success: true,
      workflow: {
        ...workflow,
        messages: messages.results || [],
        participants: participants.results || []
      }
    });
  } catch (error) {
    console.error('Workflow status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 