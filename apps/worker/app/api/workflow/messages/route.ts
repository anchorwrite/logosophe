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
      return NextResponse.json({ error: 'You do not have permission to view workflow messages' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const limit = searchParams.get('limit') || '50';

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Get messages from database
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user has access to this workflow
    const accessQuery = `
      SELECT 1 FROM WorkflowParticipants 
      WHERE WorkflowId = ? AND ParticipantEmail = ?
    `;

    const hasAccess = await db.prepare(accessQuery)
      .bind(workflowId, access.email)
      .first();

    // Also check if user is system admin
    const isSystemAdmin = await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'admin'
    `).bind(access.email).first();

    if (!hasAccess && !isSystemAdmin) {
      return NextResponse.json({ error: 'You do not have permission to view messages for this workflow' }, { status: 403 });
    }

    // Get messages
    const messagesQuery = `
      SELECT wm.*
      FROM WorkflowMessages wm
      WHERE wm.WorkflowId = ?
      ORDER BY wm.CreatedAt ASC
      LIMIT ?
    `;

    const messages = await db.prepare(messagesQuery)
      .bind(workflowId, parseInt(limit))
      .all() as any;

    return NextResponse.json({
      messages: messages.results || []
    });

  } catch (error) {
    console.error('Workflow messages API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to send workflow messages' }, { status: 403 });
    }

    const body = await request.json() as {
      workflowId: string;
      content: string;
      messageType?: 'request' | 'response' | 'upload' | 'share_link' | 'review';
      mediaFileId?: number;
      shareToken?: string;
    };

    const { workflowId, content, messageType = 'message', mediaFileId, shareToken } = body;

    if (!workflowId || !content) {
      return NextResponse.json({ error: 'Workflow ID and content are required' }, { status: 400 });
    }

    // Get workflow details and check access
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user has access to this workflow
    const accessQuery = `
      SELECT w.TenantId, wp.Role
      FROM Workflows w
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId AND wp.ParticipantEmail = ?
      WHERE w.Id = ?
    `;

    const workflowAccess = await db.prepare(accessQuery)
      .bind(access.email, workflowId)
      .first() as any;

    // Also check if user is system admin
    const isSystemAdmin = await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'admin'
    `).bind(access.email).first();

    if (!workflowAccess && !isSystemAdmin) {
      return NextResponse.json({ error: 'You do not have permission to send messages to this workflow' }, { status: 403 });
    }

    // Create message in database
    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const insertMessageQuery = `
      INSERT INTO WorkflowMessages (Id, WorkflowId, SenderEmail, MessageType, Content, MediaFileId, ShareToken, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(insertMessageQuery)
      .bind(messageId, workflowId, access.email, messageType, content, mediaFileId, shareToken, createdAt)
      .run();

    // Get the WorkflowDurableObject for this workflow
    const workflowDO = env.WORKFLOW_DO;
    const workflowDurableObjectId = workflowDO.idFromName(workflowId);
    const workflowStub = workflowDO.get(workflowDurableObjectId);

    // Notify the Durable Object about the new message
    await workflowStub.fetch('http://localhost/notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_message',
        data: {
          messageId,
          workflowId,
          senderEmail: access.email,
          messageType,
          content,
          mediaFileId,
          shareToken,
          createdAt
        }
      })
    });

    return NextResponse.json({
      id: messageId,
      workflowId,
      senderEmail: access.email,
      messageType,
      content,
      mediaFileId,
      shareToken,
      createdAt
    });

  } catch (error) {
    console.error('Workflow messages API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 