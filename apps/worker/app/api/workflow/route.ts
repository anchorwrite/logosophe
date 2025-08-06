import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to create workflows' }, { status: 403 });
    }

    const body = await request.json() as {
      title: string;
      tenantId: string;
      participants: Array<{ email: string; role: string }>;
      mediaFileIds: number[];
    };
    const { title, tenantId, participants, mediaFileIds } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin (Credentials table with admin role)
    const isAdmin = await isSystemAdmin(access.email, db);
    
    if (isAdmin) {
      // System admins have full access to all tenants
      // Continue with workflow creation
    } else {
      // Check if user is a tenant admin (Credentials table with tenant role)
      const tenantAdminCheck = await db.prepare(`
        SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
      `).bind(access.email).first();

      if (tenantAdminCheck) {
        // Tenant admins have full access within their assigned tenants
        // We need to verify they have access to this specific tenant
        const tenantAccessCheck = await db.prepare(`
          SELECT 1 FROM TenantUsers WHERE Email = ? AND TenantId = ?
        `).bind(access.email, tenantId).first();

        if (!tenantAccessCheck) {
          return NextResponse.json(
            { error: 'You do not have access to this tenant' },
            { status: 403 }
          );
        }
      } else {
        // Regular users need specific role assignments in the tenant
        const userTenantCheck = await db.prepare(`
          SELECT RoleId FROM TenantUsers WHERE Email = ? AND TenantId = ?
        `).bind(access.email, tenantId).first<{ RoleId: string }>();

        if (!userTenantCheck) {
          return NextResponse.json(
            { error: 'You do not have access to this tenant' },
            { status: 403 }
          );
        }

        // Check if the user has a role that allows creating workflows
        const allowedRoles = ['author', 'editor', 'agent', 'reviewer'];
        if (!allowedRoles.includes(userTenantCheck.RoleId)) {
          return NextResponse.json(
            { error: 'Your role does not allow creating workflows' },
            { status: 403 }
          );
        }
      }
    }

    // Create workflow in database
    const workflowId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    const insertWorkflowQuery = `
      INSERT INTO Workflows (Id, TenantId, Title, InitiatorEmail, Status, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `;

    await db.prepare(insertWorkflowQuery)
      .bind(workflowId, tenantId, title, access.email, createdAt, updatedAt)
      .run();

    // Add participants to workflow
    for (const participant of participants) {
      const joinedAt = new Date().toISOString();

      const insertParticipantQuery = `
        INSERT INTO WorkflowParticipants (WorkflowId, ParticipantEmail, Role, JoinedAt)
        VALUES (?, ?, ?, ?)
      `;

      await db.prepare(insertParticipantQuery)
        .bind(workflowId, participant.email, participant.role, joinedAt)
        .run();
    }

    // Create initial message
    const messageId = crypto.randomUUID();
    let initialMessage = `Workflow "${title}" initiated`;
    if (mediaFileIds && mediaFileIds.length > 0) {
      initialMessage += `\n\nShared ${mediaFileIds.length} media file(s)`;
    }

    await db.prepare(`
      INSERT INTO WorkflowMessages (Id, WorkflowId, SenderEmail, MessageType, Content, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(messageId, workflowId, access.email, 'request', initialMessage, createdAt).run();

    // Create separate messages for each shared media file
    for (const mediaFileId of mediaFileIds) {
      const mediaMessageId = crypto.randomUUID();
      
      await db.prepare(`
        INSERT INTO WorkflowMessages (Id, WorkflowId, SenderEmail, MessageType, MediaFileId, Content, CreatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(mediaMessageId, workflowId, access.email, 'upload', mediaFileId, 'Media file shared', createdAt).run();
    }

    // Get the WorkflowDurableObject and notify it about the new workflow
    const workflowIdObj = env.WORKFLOW_DO.idFromName(workflowId);
    const workflowObj = env.WORKFLOW_DO.get(workflowIdObj);

    await workflowObj.fetch('http://localhost/workflow/notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'workflow_created',
        data: {
          workflowId,
          tenantId,
          initiatorEmail: access.email,
          participants: participants.map(p => p.email)
        }
      })
    });

    return NextResponse.json({
      success: true,
      workflowId,
      message: 'Workflow created successfully'
    });
  } catch (error) {
    console.error('Workflow creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view workflows' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Get workflows from database
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    let workflowsQuery = `
      SELECT w.*, 
             COUNT(DISTINCT wp.ParticipantEmail) as participantCount,
             COUNT(DISTINCT wm.Id) as messageCount
      FROM Workflows w
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      WHERE w.TenantId = ?
    `;

    const queryParams = [tenantId];

    if (status) {
      workflowsQuery += ' AND w.Status = ?';
      queryParams.push(status);
    }

    workflowsQuery += ' GROUP BY w.Id ORDER BY w.CreatedAt DESC';

    const workflows = await db.prepare(workflowsQuery)
      .bind(...queryParams)
      .all() as any;

    return NextResponse.json({
      workflows: workflows.results || []
    });

  } catch (error) {
    console.error('Workflow API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 