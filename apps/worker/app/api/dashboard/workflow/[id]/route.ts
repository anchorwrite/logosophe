import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';


type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id } = await params;
    
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view workflow details' }, { status: 403 });
    }

    const workflowId = id;
    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(access.email).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to view workflow details' }, { status: 403 });
    }

    // If tenant admin, verify they have access to this workflow's tenant
    if (!isGlobalAdmin) {
      const workflowTenant = await db.prepare(`
        SELECT w.TenantId
        FROM Workflows w
        WHERE w.Id = ?
      `).bind(workflowId).first() as { TenantId: string } | null;

      if (!workflowTenant) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      const userTenantAccess = await db.prepare(`
        SELECT 1 FROM TenantUsers tu
        WHERE tu.Email = ? AND tu.TenantId = ?
      `).bind(access.email, workflowTenant.TenantId).first();

      if (!userTenantAccess) {
        return NextResponse.json({ error: 'You do not have access to this workflow' }, { status: 403 });
      }
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
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
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
    console.error('Dashboard workflow details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id } = await params;
    
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to manage workflows' }, { status: 403 });
    }

    const workflowId = id;
    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    const body = await request.json() as { action: string };
    const { action } = body;

    // Only allow specific admin actions
    if (!['terminate', 'reactivate', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Only terminate, reactivate, or delete are allowed' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(access.email).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to manage workflows' }, { status: 403 });
    }

    // If tenant admin, verify they have access to this workflow's tenant
    if (!isGlobalAdmin) {
      const workflowTenant = await db.prepare(`
        SELECT w.TenantId
        FROM Workflows w
        WHERE w.Id = ?
      `).bind(workflowId).first() as { TenantId: string } | null;

      if (!workflowTenant) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      const userTenantAccess = await db.prepare(`
        SELECT 1 FROM TenantUsers tu
        WHERE tu.Email = ? AND tu.TenantId = ?
      `).bind(access.email, workflowTenant.TenantId).first();

      if (!userTenantAccess) {
        return NextResponse.json({ error: 'You do not have access to this workflow' }, { status: 403 });
      }
    }

    // Update workflow based on action
    let updateQuery = '';
    const updateParams: any[] = [];

    switch (action) {
      case 'terminate':
        updateQuery = 'UPDATE Workflows SET Status = ?, CompletedAt = datetime("now"), CompletedBy = ? WHERE Id = ?';
        updateParams.push('cancelled', access.email, workflowId);
        break;
      case 'reactivate':
        updateQuery = 'UPDATE Workflows SET Status = ?, CompletedAt = NULL, CompletedBy = NULL WHERE Id = ?';
        updateParams.push('active', workflowId);
        break;
      case 'delete':
        updateQuery = 'DELETE FROM Workflows WHERE Id = ?';
        updateParams.push(workflowId);
        break;
    }

    await db.prepare(updateQuery).bind(...updateParams).run();

    return NextResponse.json({
      success: true,
      message: `Workflow ${action}d successfully`
    });

  } catch (error) {
    console.error('Dashboard workflow management error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 