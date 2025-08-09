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

    // Get workflow details with tenant and initiator information
    const workflowQuery = `
      SELECT w.Id,
             w.TenantId,
             w.InitiatorEmail,
             w.Title,
             w.Status,
             w.CreatedAt,
             w.UpdatedAt,
             w.CompletedAt,
             w.CompletedBy,
             t.Name as TenantName,
             tu.RoleId as initiatorRole,
             COUNT(DISTINCT wp.ParticipantEmail) as participantCount,
             COUNT(DISTINCT wm.Id) as messageCount
      FROM Workflows w
      LEFT JOIN Tenants t ON w.TenantId = t.Id
      LEFT JOIN TenantUsers tu ON w.InitiatorEmail = tu.Email AND w.TenantId = tu.TenantId
      LEFT JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      LEFT JOIN WorkflowMessages wm ON w.Id = wm.WorkflowId
      WHERE w.Id = ?
      GROUP BY w.Id, w.TenantId, w.InitiatorEmail, w.Title, w.Status, w.CreatedAt, w.UpdatedAt, w.CompletedAt, w.CompletedBy, t.Name, tu.RoleId
    `;

    const workflow = await db.prepare(workflowQuery).bind(workflowId).first();

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get recent messages with sender role information
    const messagesQuery = `
      SELECT 
        wm.Id,
        wm.SenderEmail,
        wm.Content,
        wm.MessageType,
        wm.CreatedAt,
        wm.MediaFileId,
        wm.ShareToken,
        COALESCE(wp.Role, 'Unknown') as senderRole
      FROM WorkflowMessages wm
      LEFT JOIN WorkflowParticipants wp ON wm.SenderEmail = wp.ParticipantEmail AND wm.WorkflowId = wp.WorkflowId
      WHERE wm.WorkflowId = ?
      ORDER BY wm.CreatedAt ASC
      LIMIT 10
    `;

    const messages = await db.prepare(messagesQuery).bind(workflowId).all();

    // Get participants
    const participantsQuery = `
      SELECT 
        wp.ParticipantEmail as email,
        wp.Role as role,
        wp.JoinedAt as joinedAt,
        'active' as status
      FROM WorkflowParticipants wp
      WHERE wp.WorkflowId = ?
      ORDER BY wp.JoinedAt
    `;

    const participants = await db.prepare(participantsQuery).bind(workflowId).all();

    // Map messages to match component interface with unique keys
    const mappedMessages = (messages.results || []).map((msg: any, index: number) => ({
      id: msg.Id || `message-${index}`, // Ensure unique ID
      senderEmail: msg.SenderEmail || 'Unknown',
      senderRole: msg.senderRole || 'Unknown',
      content: msg.Content || '',
      timestamp: msg.CreatedAt || new Date().toISOString(),
      messageType: msg.MessageType || 'unknown'
    }));

    return NextResponse.json({
      success: true,
      workflow: {
        ...workflow,
        messages: mappedMessages,
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
    if (!['terminate', 'reactivate', 'delete', 'hard_delete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Only terminate, reactivate, delete, or hard_delete are allowed' }, { status: 400 });
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
        // Soft delete - set status to deleted
        updateQuery = 'UPDATE Workflows SET Status = ?, UpdatedAt = datetime("now") WHERE Id = ?';
        updateParams.push('deleted', workflowId);
        break;
      case 'hard_delete':
        // Hard delete - permanently remove all related records
        try {
          // Get workflow data for logging before deletion
          const workflowData = await db.prepare('SELECT * FROM Workflows WHERE Id = ?')
            .bind(workflowId)
            .first();

          if (!workflowData) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
          }

          // Ensure workflow is in deleted state before hard delete
          if (workflowData.Status !== 'deleted') {
            return NextResponse.json({ error: 'Only deleted workflows can be permanently deleted' }, { status: 400 });
          }

          // Log permanent deletion to WorkflowHistory before deleting
          const { getWorkflowHistoryLogger } = await import('@/lib/workflow-history');
          const workflowHistoryLogger = await getWorkflowHistoryLogger();
          await workflowHistoryLogger.logWorkflowPermanentlyDeleted(workflowData, access.email);

          // Delete in order to respect foreign key constraints
          await db.prepare('DELETE FROM WorkflowMessages WHERE WorkflowId = ?').bind(workflowId).run();
          await db.prepare('DELETE FROM WorkflowParticipants WHERE WorkflowId = ?').bind(workflowId).run();
          await db.prepare('DELETE FROM WorkflowInvitations WHERE WorkflowId = ?').bind(workflowId).run();
          await db.prepare('DELETE FROM Workflows WHERE Id = ?').bind(workflowId).run();

          return NextResponse.json({
            success: true,
            message: 'Workflow permanently deleted successfully'
          });

        } catch (deleteError) {
          console.error('Error during hard delete:', deleteError);
          return NextResponse.json({ error: 'Failed to permanently delete workflow' }, { status: 500 });
        }
    }

    if (updateQuery) {
      await db.prepare(updateQuery).bind(...updateParams).run();
    }

    return NextResponse.json({
      success: true,
      message: `Workflow ${action}d successfully`
    });

  } catch (error) {
    console.error('Dashboard workflow management error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 