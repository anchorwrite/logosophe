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
      SELECT tu.TenantId
      FROM TenantUsers tu
      WHERE tu.Email = ?
    `;

    const userTenantResult = await db.prepare(userTenantQuery)
      .bind(session.user.email)
      .first() as any;

    if (!userTenantResult?.TenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const userTenantId = userTenantResult.TenantId;

    // Get unread message count for the user within their tenant
    const unreadCountQuery = `
      SELECT COUNT(DISTINCT m.Id) as unreadCount
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
      LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email
      LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email
      WHERE mr.RecipientEmail = ?
      AND mr.IsRead = FALSE
      AND (tu_sender.TenantId = ? OR tu_recipient.TenantId = ?)
      AND m.IsDeleted = FALSE
      AND m.MessageType = 'subscriber'
    `;

    const unreadCountResult = await db.prepare(unreadCountQuery)
      .bind(session.user.email, userTenantId, userTenantId)
      .first() as { unreadCount: number };

    const unreadCount = unreadCountResult?.unreadCount || 0;

    return NextResponse.json({ 
      unreadCount,
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
