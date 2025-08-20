import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin or tenant admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = !isAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(session.user.email).first();

    if (!isAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get tenant IDs from query parameter (frontend should pass this)
    const tenantIdsParam = request.nextUrl.searchParams.get('tenantIds');
    let accessibleTenants: Array<{ Id: string }> = [];
    
    if (!isAdmin && tenantIdsParam) {
      const tenantIds = tenantIdsParam.split(',');
      accessibleTenants = tenantIds.map(id => ({ Id: id }));
    }

    // Get system-wide unread message statistics for admins
    let unreadCountQuery: string;
    let unreadCountParams: any[];

    if (isAdmin) {
      // System admins can see all unread messages across all tenants
      unreadCountQuery = `
        SELECT COUNT(DISTINCT m.Id) as unreadCount
        FROM Messages m
        LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
        WHERE mr.IsRead = FALSE
        AND m.IsDeleted = FALSE
        AND m.MessageType = 'admin'
      `;
      unreadCountParams = [];
    } else {
      // Tenant admins can only see unread messages within their accessible tenants
      const tenantIds = accessibleTenants.map(tenant => tenant.Id);
      const tenantPlaceholders = tenantIds.map(() => '?').join(',');
      unreadCountQuery = `
        SELECT COUNT(DISTINCT m.Id) as unreadCount
        FROM Messages m
        LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
        LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
        LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
        WHERE mr.IsRead = FALSE
        AND m.IsDeleted = FALSE
        AND m.MessageType = 'admin'
        AND (tu_sender.TenantId IN (${tenantPlaceholders}) OR tu_recipient.TenantId IN (${tenantPlaceholders}))
      `;
      unreadCountParams = [...tenantIds, ...tenantIds];
    }

    const unreadCountResult = await db.prepare(unreadCountQuery)
      .bind(...unreadCountParams)
      .first() as { unreadCount: number };

    const unreadCount = unreadCountResult?.unreadCount || 0;

    // Get recent unread messages for preview (limit to 5 for admins)
    let recentUnreadQuery: string;
    let recentUnreadParams: any[];

    if (isAdmin) {
      recentUnreadQuery = `
        SELECT 
          m.Id,
          m.Subject,
          m.SenderEmail,
          m.CreatedAt,
          m.HasAttachments,
          m.AttachmentCount,
          t.Name as TenantName
        FROM Messages m
        LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
        LEFT JOIN Tenants t ON m.TenantId = t.Id
        WHERE mr.IsRead = FALSE
        AND m.IsDeleted = FALSE
        AND m.MessageType = 'admin'
        ORDER BY m.CreatedAt DESC
        LIMIT 5
      `;
      recentUnreadParams = [];
    } else {
      const tenantIds = accessibleTenants.map(tenant => tenant.Id);
      const tenantPlaceholders = tenantIds.map(() => '?').join(',');
      recentUnreadQuery = `
        SELECT 
          m.Id,
          m.Subject,
          m.SenderEmail,
          m.CreatedAt,
          m.HasAttachments,
          m.AttachmentCount,
          t.Name as TenantName
        FROM Messages m
        LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
        LEFT JOIN Tenants t ON m.TenantId = t.Id
        LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
        LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
        WHERE mr.IsRead = FALSE
        AND m.IsDeleted = FALSE
        AND m.MessageType = 'admin'
        AND (tu_sender.TenantId IN (${tenantPlaceholders}) OR tu_recipient.TenantId IN (${tenantPlaceholders}))
        ORDER BY m.CreatedAt DESC
        LIMIT 5
      `;
      recentUnreadParams = [...tenantIds, ...tenantIds];
    }

    const recentUnreadResult = await db.prepare(recentUnreadQuery)
      .bind(...recentUnreadParams)
      .all() as any;

    const recentUnreadMessages = recentUnreadResult.results || [];

    // Get additional admin statistics
    let systemStatsQuery: string;
    let systemStatsParams: any[];

    if (isAdmin) {
      systemStatsQuery = `
        SELECT 
          COUNT(DISTINCT m.Id) as totalMessages,
          COUNT(DISTINCT CASE WHEN m.IsRecalled = TRUE THEN m.Id END) as recalledMessages,
          COUNT(DISTINCT CASE WHEN m.HasAttachments = TRUE THEN m.Id END) as messagesWithAttachments
        FROM Messages m
        WHERE m.IsDeleted = FALSE
        AND m.MessageType = 'admin'
      `;
      systemStatsParams = [];
    } else {
      const tenantIds = accessibleTenants.map(tenant => tenant.Id);
      const tenantPlaceholders = tenantIds.map(() => '?').join(',');
      systemStatsQuery = `
        SELECT 
          COUNT(DISTINCT m.Id) as totalMessages,
          COUNT(DISTINCT CASE WHEN m.IsRecalled = TRUE THEN m.Id END) as recalledMessages,
          COUNT(DISTINCT CASE WHEN m.HasAttachments = TRUE THEN m.Id END) as messagesWithAttachments
        FROM Messages m
        LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
        LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
        LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
        WHERE m.IsDeleted = FALSE
        AND m.MessageType = 'admin'
        AND (tu_sender.TenantId IN (${tenantPlaceholders}) OR tu_recipient.TenantId IN (${tenantPlaceholders}))
      `;
      systemStatsParams = [...tenantIds, ...tenantIds];
    }

    const systemStatsResult = await db.prepare(systemStatsQuery)
      .bind(...systemStatsParams)
      .first() as any;

    // Log the activity
    const { ipAddress, userAgent } = extractRequestContext(request);
    const normalizedLogging = new NormalizedLogging(db);
    await normalizedLogging.logMessagingOperations({
      userEmail: session.user.email,
      tenantId: accessibleTenants.length === 1 ? accessibleTenants[0].Id : 'multiple',
      activityType: 'FETCH_UNREAD_COUNT_DASHBOARD',
      accessType: 'read',
      targetId: 'system',
      targetName: `Fetched unread count: ${unreadCount} messages`,
      ipAddress,
      userAgent
    });

    return NextResponse.json({ 
      unreadCount,
      accessibleTenants: accessibleTenants.map(tenant => tenant.Id),
      recentUnreadMessages,
      systemStats: {
        totalMessages: systemStatsResult?.totalMessages || 0,
        recalledMessages: systemStatsResult?.recalledMessages || 0,
        messagesWithAttachments: systemStatsResult?.messagesWithAttachments || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching dashboard unread message count:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
