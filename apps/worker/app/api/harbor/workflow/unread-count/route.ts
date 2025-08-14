import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';

export async function GET(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Check access control
    let hasAccess = false;
    
    // System admins have access to all tenants
    if (await isSystemAdmin(userEmail, db)) {
      hasAccess = true;
    } else {
      // Check if user is a tenant admin for this tenant
      if (await isTenantAdminFor(userEmail, tenantId)) {
        hasAccess = true;
      } else {
        // Check if user is a member of this tenant
        const userTenant = await db.prepare(`
          SELECT 1 FROM TenantUsers 
          WHERE TenantId = ? AND Email = ?
        `).bind(tenantId, userEmail).first();
        
        if (userTenant) {
          hasAccess = true;
        } else {
          // Check if user has subscriber role in UserRoles table for this tenant
          const userRole = await db.prepare(`
            SELECT 1 FROM UserRoles 
            WHERE TenantId = ? AND Email = ? AND RoleId = 'subscriber'
          `).bind(tenantId, userEmail).first();
          
          hasAccess = !!userRole;
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get unread workflow message count
    const unreadCountQuery = `
      SELECT COUNT(DISTINCT wm.Id) as unreadCount
      FROM WorkflowMessages wm
      INNER JOIN Workflows w ON wm.WorkflowId = w.Id
      INNER JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      LEFT JOIN WorkflowMessageRecipients wmr ON wm.Id = wmr.WorkflowMessageId AND wmr.ParticipantEmail = ?
      WHERE w.TenantId = ?
        AND wp.ParticipantEmail = ?
        AND wm.SenderEmail != ?
        AND (wmr.IsRead IS NULL OR wmr.IsRead = FALSE)
        AND w.Status != 'deleted'
    `;

    const unreadResult = await db.prepare(unreadCountQuery)
      .bind(userEmail, tenantId, userEmail, userEmail)
      .first() as { unreadCount: number } | undefined;

    const unreadCount = unreadResult?.unreadCount || 0;

    // Get recent unread workflows for additional context
    const recentUnreadQuery = `
      SELECT DISTINCT 
        w.Id as workflowId,
        w.Title as workflowTitle,
        wm.Id as messageId,
        wm.SenderEmail,
        wm.Content,
        wm.CreatedAt as messageCreatedAt
      FROM WorkflowMessages wm
      INNER JOIN Workflows w ON wm.WorkflowId = w.Id
      INNER JOIN WorkflowParticipants wp ON w.Id = wp.WorkflowId
      LEFT JOIN WorkflowMessageRecipients wmr ON wm.Id = wmr.WorkflowMessageId AND wmr.ParticipantEmail = ?
      WHERE w.TenantId = ?
        AND wp.ParticipantEmail = ?
        AND wm.SenderEmail != ?
        AND (wmr.IsRead IS NULL OR wmr.IsRead = FALSE)
        AND w.Status != 'deleted'
      ORDER BY wm.CreatedAt DESC
      LIMIT 5
    `;

    const recentUnreadResult = await db.prepare(recentUnreadQuery)
      .bind(userEmail, tenantId, userEmail, userEmail)
      .all() as { results: any[] };

    const recentUnreadWorkflows = recentUnreadResult.results || [];

    return NextResponse.json({
      unreadCount,
      tenantId,
      recentUnreadWorkflows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting unread workflow count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
