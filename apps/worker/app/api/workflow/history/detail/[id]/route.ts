import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('Workflow history detail API called');
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const { id: workflowId } = await params;
    console.log('Workflow ID:', workflowId);
    
    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin (Credentials table with admin role)
    const isAdmin = await isSystemAdmin(access.email, db);
    console.log('User email:', access.email, 'Is admin:', isAdmin);
    
    let tenantId: string | null = null;
    
    if (isAdmin) {
      console.log('User is system admin, granting access');
      // System admins have full access to all tenants
      // Get the workflow's tenant
      const workflowTenant = await db.prepare(`
        SELECT TenantId FROM Workflows WHERE Id = ?
      `).bind(workflowId).first<{ TenantId: string }>();
      
      if (!workflowTenant) {
        console.log('Workflow not found for admin');
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }
      
      tenantId = workflowTenant.TenantId;
    } else {
      // Check if user is a tenant admin (Credentials table with tenant role)
      const tenantAdminCheck = await db.prepare(`
        SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
      `).bind(access.email).first();

      console.log('User is tenant admin:', !!tenantAdminCheck);

      if (tenantAdminCheck) {
        // Tenant admins have full access within their assigned tenants
        // Get the workflow's tenant and verify access
        const workflowTenant = await db.prepare(`
          SELECT w.TenantId FROM Workflows w
          JOIN TenantUsers tu ON w.TenantId = tu.TenantId
          WHERE w.Id = ? AND tu.Email = ?
        `).bind(workflowId, access.email).first<{ TenantId: string }>();
        
        if (!workflowTenant) {
          console.log('Tenant admin: workflow not found or no access');
          return NextResponse.json({ error: 'Workflow not found or you do not have access' }, { status: 404 });
        }
        
        tenantId = workflowTenant.TenantId;
      } else {
        // Regular users need specific role assignments in the tenant
        // Get all user roles for the workflow's tenant
        const userRolesQuery = `
          SELECT ur.TenantId, ur.RoleId 
          FROM UserRoles ur
          JOIN Workflows w ON ur.TenantId = w.TenantId
          WHERE w.Id = ? AND ur.Email = ?
        `;
        
        const userRolesResult = await db.prepare(userRolesQuery)
          .bind(workflowId, access.email)
          .all() as any;

        console.log('Regular user roles check:', userRolesResult);

        if (!userRolesResult?.results || userRolesResult.results.length === 0) {
          console.log('Regular user: workflow not found or no access');
          return NextResponse.json({ error: 'Workflow not found or you do not have access' }, { status: 404 });
        }

        // Check if the user has any role that allows viewing workflow history
        const allowedRoles = ['author', 'editor', 'agent', 'reviewer', 'subscriber'];
        const userRoles = userRolesResult.results.map((r: any) => r.RoleId);
        console.log('User roles:', userRoles, 'Allowed roles:', allowedRoles);
        
        const hasAllowedRole = userRoles.some((role: string) => allowedRoles.includes(role));
        if (!hasAllowedRole) {
          console.log('User has no allowed roles for workflow history');
          return NextResponse.json(
            { error: 'Your role does not allow viewing workflow history' },
            { status: 403 }
          );
        }
        
        tenantId = userRolesResult.results[0].TenantId;
      }
    }

    // Verify the user is a participant in this workflow
    const participantCheck = await db.prepare(`
      SELECT 1 FROM WorkflowParticipants 
      WHERE WorkflowId = ? AND ParticipantEmail = ?
    `).bind(workflowId, access.email).first();

    console.log('Participant check for user:', access.email, 'Result:', !!participantCheck);

    if (!participantCheck) {
      console.log('User is not a participant in this workflow');
      return NextResponse.json({ error: 'You are not a participant in this workflow' }, { status: 403 });
    }

    // Get workflow details
    const workflowQuery = `
      SELECT 
        w.Id,
        w.Title,
        w.Status,
        w.CreatedAt,
        w.UpdatedAt,
        w.CompletedAt,
        w.CompletedBy,
        w.TenantId,
        w.InitiatorEmail
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

    // Determine the event type based on workflow status
    let eventType = 'created';
    let eventTimestamp = workflow.CreatedAt;
    let eventPerformedBy = workflow.InitiatorEmail;

    if (workflow.Status === 'terminated') {
      eventType = 'terminated';
      eventTimestamp = workflow.UpdatedAt;
      eventPerformedBy = 'Unknown'; // We don't have TerminatedBy in the table
    } else if (workflow.CompletedAt) {
      eventType = 'completed';
      eventTimestamp = workflow.CompletedAt;
      eventPerformedBy = workflow.CompletedBy || 'Unknown';
    }

    return NextResponse.json({
      success: true,
      workflow: {
        ...workflow,
        EventType: eventType,
        EventTimestamp: eventTimestamp,
        EventPerformedBy: eventPerformedBy,
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