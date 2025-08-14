import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';

export async function POST(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;
    const body = await request.json() as { workflowId: string; messageIds?: string[] };
    const { workflowId, messageIds } = body;

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
    }

    // Get workflow details to check access
    const workflowQuery = `
      SELECT w.Id, w.TenantId, w.Status
      FROM Workflows w
      INNER JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      WHERE w.Id = ? AND wp.ParticipantEmail = ?
    `;

    const workflow = await db.prepare(workflowQuery)
      .bind(workflowId, userEmail)
      .first() as { Id: string; TenantId: string; Status: string } | undefined;

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found or access denied' }, { status: 404 });
    }

    if (workflow.Status === 'deleted') {
      return NextResponse.json({ error: 'Cannot access deleted workflow' }, { status: 400 });
    }

    // Check access control
    let hasAccess = false;
    
    // System admins have access to all tenants
    if (await isSystemAdmin(userEmail, db)) {
      hasAccess = true;
    } else {
      // Check if user is a tenant admin for this tenant
      if (await isTenantAdminFor(userEmail, workflow.TenantId)) {
        hasAccess = true;
      } else {
        // Check if user is a member of this tenant
        const userTenant = await db.prepare(`
          SELECT 1 FROM TenantUsers 
          WHERE TenantId = ? AND Email = ?
        `).bind(workflow.TenantId, userEmail).first();
        
        if (userTenant) {
          hasAccess = true;
        } else {
          // Check if user has subscriber role in UserRoles table for this tenant
          const userRole = await db.prepare(`
            SELECT 1 FROM UserRoles 
            WHERE TenantId = ? AND Email = ? AND RoleId = 'subscriber'
          `).bind(workflow.TenantId, userEmail).first();
          
          hasAccess = !!userRole;
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // If specific message IDs are provided, mark only those as read
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      const markSpecificReadQuery = `
        INSERT OR REPLACE INTO WorkflowMessageRecipients 
        (WorkflowMessageId, ParticipantEmail, IsRead, ReadAt)
        VALUES (?, ?, TRUE, ?)
      `;

      const now = new Date().toISOString();
      
      for (const messageId of messageIds) {
        await db.prepare(markSpecificReadQuery)
          .bind(messageId, userEmail, now)
          .run();
      }
    } else {
      // Mark all unread messages in this workflow as read
      const markAllReadQuery = `
        INSERT OR REPLACE INTO WorkflowMessageRecipients 
        (WorkflowMessageId, ParticipantEmail, IsRead, ReadAt)
        SELECT wm.Id, ?, TRUE, ?
        FROM WorkflowMessages wm
        INNER JOIN Workflows w ON wm.WorkflowId = w.Id
        INNER JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
        LEFT JOIN WorkflowMessageRecipients wmr ON wm.Id = wmr.WorkflowMessageId AND wmr.ParticipantEmail = ?
        WHERE w.Id = ?
          AND wp.ParticipantEmail = ?
          AND wm.SenderEmail != ?
          AND (wmr.IsRead IS NULL OR wmr.IsRead = FALSE)
      `;

      const now = new Date().toISOString();
      
      await db.prepare(markAllReadQuery)
        .bind(userEmail, now, userEmail, workflowId, userEmail, userEmail)
        .run();
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Messages marked as read',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error marking workflow messages as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
