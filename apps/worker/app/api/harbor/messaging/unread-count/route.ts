import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only subscribers can access messaging
    if (session.user.role !== 'subscriber') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get user's tenant information
    const userTenantQuery = `
      SELECT tu.TenantId, t.Name as TenantName
      FROM TenantUsers tu
      LEFT JOIN Tenants t ON tu.TenantId = t.Id
      WHERE tu.Email = ?
    `;

    const userTenantResult = await db.prepare(userTenantQuery)
      .bind(session.user.email)
      .first() as any;

    if (!userTenantResult?.TenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const userTenantId = userTenantResult.TenantId;
    const userTenantName = userTenantResult.TenantName || userTenantId;

    // Get unread message count for the user within their tenant
    const unreadCountQuery = `
      SELECT COUNT(DISTINCT m.Id) as unreadCount
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
      LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
      LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
      WHERE mr.RecipientEmail = ?
      AND mr.IsRead = FALSE
      AND (tu_sender.TenantId = ? OR tu_recipient.TenantId = ?)
      AND m.IsDeleted = FALSE
      AND m.MessageType = 'subscriber'
      AND NOT EXISTS (
        SELECT 1 FROM UserBlocks ub 
        WHERE (ub.BlockerEmail = ? AND ub.BlockedEmail = m.SenderEmail AND ub.TenantId = ? AND ub.IsActive = TRUE)
        OR (ub.BlockerEmail = m.SenderEmail AND ub.BlockedEmail = ? AND ub.TenantId = ? AND ub.IsActive = TRUE)
      )
    `;

    const unreadCountResult = await db.prepare(unreadCountQuery)
      .bind(session.user.email, userTenantId, userTenantId, session.user.email, userTenantId, session.user.email, userTenantId)
      .first() as { unreadCount: number };

    const unreadCount = unreadCountResult?.unreadCount || 0;

    // Get recent unread messages for preview (limit to 3)
    const recentUnreadQuery = `
      SELECT 
        m.Id,
        m.Subject,
        m.SenderEmail,
        s.Name as SenderName,
        m.CreatedAt,
        m.HasAttachments,
        m.AttachmentCount
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
      LEFT JOIN Subscribers s ON m.SenderEmail = s.Email
      LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
      LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
      WHERE mr.RecipientEmail = ?
      AND mr.IsRead = FALSE
      AND (tu_sender.TenantId = ? OR tu_recipient.TenantId = ?)
      AND m.IsDeleted = FALSE
      AND m.MessageType = 'subscriber'
      AND NOT EXISTS (
        SELECT 1 FROM UserBlocks ub 
        WHERE (ub.BlockerEmail = ? AND ub.BlockedEmail = m.SenderEmail AND ub.TenantId = ? AND ub.IsActive = TRUE)
        OR (ub.BlockerEmail = m.SenderEmail AND ub.BlockedEmail = ? AND ub.TenantId = ? AND ub.IsActive = TRUE)
      )
      ORDER BY m.CreatedAt DESC
      LIMIT 3
    `;

    const recentUnreadResult = await db.prepare(recentUnreadQuery)
      .bind(session.user.email, userTenantId, userTenantId, session.user.email, userTenantId, session.user.email, userTenantId)
      .all() as any;

    const recentUnreadMessages = recentUnreadResult.results || [];

    return NextResponse.json({ 
      unreadCount,
      tenantId: userTenantId,
      tenantName: userTenantName,
      recentUnreadMessages,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching unread message count:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
