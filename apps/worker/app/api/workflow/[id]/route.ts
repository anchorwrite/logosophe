import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get session directly as backup to ensure we have the email
    const session = await auth();
    const userEmail = access.email || session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workflow details from database
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get workflow details
    const workflowQuery = `
      SELECT w.*, 
             COUNT(DISTINCT wp.ParticipantEmail) as participantCount,
             COUNT(DISTINCT wm.Id) as messageCount
      FROM Workflows w
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      WHERE w.Id = ?
      GROUP BY w.Id
    `;

    const workflow = await db.prepare(workflowQuery)
      .bind(id)
      .first() as any;

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get participants
    const participantsQuery = `
      SELECT wp.ParticipantEmail, wp.Role, wp.JoinedAt
      FROM WorkflowParticipants wp
      WHERE wp.WorkflowId = ?
      ORDER BY wp.JoinedAt
    `;

    const participants = await db.prepare(participantsQuery)
      .bind(id)
      .all() as any;

    // Get media files from WorkflowMessages table
    const mediaFilesQuery = `
      SELECT DISTINCT wm.MediaFileId, mf.FileName, mf.FilePath, mf.FileSize, mf.MimeType, mf.ContentType
      FROM WorkflowMessages wm
      JOIN MediaFiles mf ON wm.MediaFileId = mf.Id
      WHERE wm.WorkflowId = ? AND wm.MediaFileId IS NOT NULL
      ORDER BY wm.CreatedAt
    `;

    const mediaFiles = await db.prepare(mediaFilesQuery)
      .bind(id)
      .all() as any;

    // Get recent messages
    const messagesQuery = `
      SELECT wm.*
      FROM WorkflowMessages wm
      WHERE wm.WorkflowId = ?
      ORDER BY wm.CreatedAt DESC
      LIMIT 50
    `;

    const messages = await db.prepare(messagesQuery)
      .bind(id)
      .all() as any;

    return NextResponse.json({
      workflow,
      participants: participants.results || [],
      mediaFiles: mediaFiles.results || [],
      messages: messages.results || []
    });

  } catch (error) {
    console.error('Workflow API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      status?: 'active' | 'completed' | 'cancelled';
      title?: string;
    };

    // Get workflow details from database
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if workflow exists and user has access
    const workflowQuery = `
      SELECT w.*, wp.ParticipantEmail
      FROM Workflows w
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      WHERE w.Id = ?
    `;

    const workflow = await db.prepare(workflowQuery)
      .bind(id)
      .all() as any;

    if (!workflow.results || workflow.results.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const workflowData = workflow.results[0];
    const participants = workflow.results.map((r: any) => r.ParticipantEmail).filter(Boolean);

    // Check if user is a participant or system admin
    const isSystemAdmin = await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'admin'
    `).bind(access.email).first();

    if (!isSystemAdmin && !participants.includes(access.email)) {
      return NextResponse.json({ error: 'You do not have permission to modify this workflow' }, { status: 403 });
    }

    // Update workflow
    const updateFields = [];
    const updateValues = [];

    if (body.status !== undefined) {
      updateFields.push('Status = ?');
      updateValues.push(body.status);
    }

    if (body.title !== undefined) {
      updateFields.push('Title = ?');
      updateValues.push(body.title);
    }

    if (updateFields.length > 0) {
      updateFields.push('UpdatedAt = ?');
      updateValues.push(new Date().toISOString());

      const updateQuery = `
        UPDATE Workflows 
        SET ${updateFields.join(', ')}
        WHERE Id = ?
      `;

      updateValues.push(id);

      await db.prepare(updateQuery)
        .bind(...updateValues)
        .run();
    }

    // Get the WorkflowDurableObject for this workflow
    const workflowDO = env.WORKFLOW_DO;
    const workflowDurableObjectId = workflowDO.idFromName(id);
    const workflowStub = workflowDO.get(workflowDurableObjectId);

    // Notify the Durable Object about the workflow update
    await workflowStub.fetch('http://localhost/notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'workflow_updated',
        data: {
          workflowId: id,
          updates: body,
          updatedBy: access.email
        }
      })
    });

    return NextResponse.json({ 
      message: 'Workflow updated successfully',
      workflowId: id
    });

  } catch (error) {
    console.error('Workflow API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}