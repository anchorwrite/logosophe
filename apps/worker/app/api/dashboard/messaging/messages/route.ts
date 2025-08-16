import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import type { D1Result } from '@cloudflare/workers-types';

interface RecentMessage {
  Id: number;
  Subject: string;
  Body: string;
  SenderEmail: string;
  SenderName: string;
  CreatedAt: string;
  IsRead: boolean;
  MessageType: string;
  RecipientCount: number;
  TenantId: string;
}

// GET /api/dashboard/messaging/messages - Get recent messages for dashboard interface
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user has access to messaging
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const accessibleTenants = await getUserMessagingTenants(session.user.email);
    
    if (!isAdmin && accessibleTenants.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get user's recent messages
    let recentMessagesQuery: string;
    let queryParams: any[];

    if (isAdmin) {
      // System admins see messages where they are sender or recipient (across all tenants)
      recentMessagesQuery = `
        SELECT DISTINCT
          m.Id,
          m.Subject,
          m.Body,
          m.SenderEmail,
          COALESCE(s.Name, m.SenderEmail) as SenderName,
          m.CreatedAt,
          m.MessageType,
          m.TenantId,
          (SELECT COUNT(DISTINCT mr2.RecipientEmail) FROM MessageRecipients mr2 WHERE mr2.MessageId = m.Id AND mr2.IsDeleted = FALSE) as RecipientCount,
          (SELECT CASE WHEN m.SenderEmail = ? THEN TRUE ELSE COALESCE(mr3.IsRead, FALSE) END FROM MessageRecipients mr3 WHERE mr3.MessageId = m.Id AND mr3.RecipientEmail = ? AND mr3.IsDeleted = FALSE) as IsRead
        FROM Messages m
        LEFT JOIN Subscribers s ON m.SenderEmail = s.Email
        WHERE (m.SenderEmail = ? OR EXISTS (SELECT 1 FROM MessageRecipients mr4 WHERE mr4.MessageId = m.Id AND mr4.RecipientEmail = ? AND mr4.IsDeleted = FALSE))
        AND m.IsDeleted = FALSE
        AND m.IsArchived = FALSE
        ORDER BY m.CreatedAt DESC
        LIMIT 20
      `;
      queryParams = [session.user.email, session.user.email, session.user.email, session.user.email];
    } else {
      // Tenant admins see messages where they are sender or recipient
      recentMessagesQuery = `
        SELECT DISTINCT
          m.Id,
          m.Subject,
          m.Body,
          m.SenderEmail,
          COALESCE(s.Name, m.SenderEmail) as SenderName,
          m.CreatedAt,
          m.MessageType,
          m.TenantId,
          (SELECT COUNT(DISTINCT mr2.RecipientEmail) FROM MessageRecipients mr2 WHERE mr2.MessageId = m.Id AND mr2.IsDeleted = FALSE) as RecipientCount,
          (SELECT CASE WHEN m.SenderEmail = ? THEN TRUE ELSE COALESCE(mr3.IsRead, FALSE) END FROM MessageRecipients mr3 WHERE mr3.MessageId = m.Id AND mr3.RecipientEmail = ? AND mr3.IsDeleted = FALSE) as IsRead
        FROM Messages m
        LEFT JOIN Subscribers s ON m.SenderEmail = s.Email
        WHERE (m.SenderEmail = ? OR EXISTS (SELECT 1 FROM MessageRecipients mr4 WHERE mr4.MessageId = m.Id AND mr4.RecipientEmail = ? AND mr4.IsDeleted = FALSE))
        AND m.TenantId IN (${accessibleTenants.map(() => '?').join(',')})
        AND m.IsDeleted = FALSE
        AND m.IsArchived = FALSE
        ORDER BY m.CreatedAt DESC
        LIMIT 20
      `;
      queryParams = [session.user.email, session.user.email, session.user.email, session.user.email, ...accessibleTenants];
    }

    const recentMessagesResult = await db.prepare(recentMessagesQuery)
      .bind(...queryParams)
      .all() as D1Result<RecentMessage>;
    
    const recentMessages = recentMessagesResult.results || [];

    return NextResponse.json({ 
      messages: recentMessages,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
