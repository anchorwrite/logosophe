import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const { id: workflowId } = await params;
    
    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin (Credentials table with admin role)
    const isAdmin = await isSystemAdmin(access.email, db);
    
    let tenantId: string | null = null;
    
    if (isAdmin) {
      // System admins have full access to all tenants
      // Get the workflow's tenant
      const workflowTenant = await db.prepare(`
        SELECT TenantId FROM Workflows WHERE Id = ?
      `).bind(workflowId).first<{ TenantId: string }>();
      
      if (!workflowTenant) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }
      
      tenantId = workflowTenant.TenantId;
    } else {
      // Check if user is a tenant admin (Credentials table with tenant role)
      const tenantAdminCheck = await db.prepare(`
        SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
      `).bind(access.email).first();

      if (tenantAdminCheck) {
        // Tenant admins have full access within their assigned tenants
        // Get the workflow's tenant and verify access
        const workflowTenant = await db.prepare(`
          SELECT w.TenantId FROM Workflows w
          JOIN TenantUsers tu ON w.TenantId = tu.TenantId
          WHERE w.Id = ? AND tu.Email = ?
        `).bind(workflowId, access.email).first<{ TenantId: string }>();
        
        if (!workflowTenant) {
          return NextResponse.json({ error: 'Workflow not found or you do not have access' }, { status: 404 });
        }
        
        tenantId = workflowTenant.TenantId;
      } else {
        // Regular users need specific role assignments in the tenant
        const userTenantCheck = await db.prepare(`
          SELECT tu.TenantId, tu.RoleId 
          FROM TenantUsers tu
          JOIN Workflows w ON tu.TenantId = w.TenantId
          WHERE w.Id = ? AND tu.Email = ?
        `).bind(workflowId, access.email).first<{ TenantId: string; RoleId: string }>();

        if (!userTenantCheck) {
          return NextResponse.json({ error: 'Workflow not found or you do not have access' }, { status: 404 });
        }

        // Check if the user has a role that allows viewing workflow history
        const allowedRoles = ['author', 'editor', 'agent', 'reviewer', 'subscriber'];
        if (!allowedRoles.includes(userTenantCheck.RoleId)) {
          return NextResponse.json(
            { error: 'Your role does not allow viewing workflow history' },
            { status: 403 }
          );
        }
        
        tenantId = userTenantCheck.TenantId;
      }
    }

    // Verify the user is a participant in this workflow
    const participantCheck = await db.prepare(`
      SELECT 1 FROM WorkflowParticipants 
      WHERE WorkflowId = ? AND ParticipantEmail = ?
    `).bind(workflowId, access.email).first();

    if (!participantCheck) {
      return NextResponse.json({ error: 'You are not a participant in this workflow' }, { status: 403 });
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
        w.TenantId
      FROM Workflows w
      WHERE w.Id = ?
    `;

    const workflow = await db.prepare(workflowQuery).bind(workflowId).first();

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get all messages for this workflow
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
    `;

    const messages = await db.prepare(messagesQuery).bind(workflowId).all();

    // Get participants with role names
    const participantsQuery = `
      SELECT 
        wp.ParticipantEmail,
        COALESCE(r.Name, wp.Role) as Role,
        wp.JoinedAt
      FROM WorkflowParticipants wp
      LEFT JOIN Roles r ON wp.Role = r.Id
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
    console.error('Error in workflow history detail API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 