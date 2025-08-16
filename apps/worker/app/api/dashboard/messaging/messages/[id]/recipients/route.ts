import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import type { D1Result } from '@cloudflare/workers-types';

type Params = Promise<{ id: string }>;

// GET /api/dashboard/messaging/messages/[id]/recipients - Get recipients for a specific message
export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id } = await params;
    const messageId = parseInt(id);

    if (isNaN(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    // Check if user has admin access
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const accessibleTenants = await getUserMessagingTenants(session.user.email);
    
    if (!isAdmin && accessibleTenants.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get the message to check tenant access
    const messageQuery = isAdmin 
      ? `SELECT * FROM Messages WHERE Id = ? AND IsDeleted = FALSE`
      : `SELECT * FROM Messages WHERE Id = ? AND IsDeleted = FALSE AND TenantId IN (${accessibleTenants.map(() => '?').join(',')})`;
    
    const messageParams = isAdmin ? [messageId] : [messageId, ...accessibleTenants];
    const message = await db.prepare(messageQuery).bind(...messageParams).first();

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Get all recipients for this message
    const recipientsResult = await db.prepare(`
      SELECT 
        mr.RecipientEmail,
        mr.IsRead,
        mr.ReadAt,
        mr.IsDeleted,
        s.Name
      FROM MessageRecipients mr
      LEFT JOIN Subscribers s ON mr.RecipientEmail = s.Email
      WHERE mr.MessageId = ?
      ORDER BY mr.RecipientEmail
    `).bind(messageId).all() as D1Result<any>;

    const recipients = recipientsResult.results || [];

    // Transform to response format
    const formattedRecipients = recipients.map(r => ({
      Email: r.RecipientEmail,
      Name: r.Name || r.RecipientEmail.split('@')[0],
      IsRead: r.IsRead,
      ReadAt: r.ReadAt,
      IsDeleted: r.IsDeleted
    }));

    return NextResponse.json({
      success: true,
      recipients: formattedRecipients,
      totalRecipients: formattedRecipients.length,
      readCount: formattedRecipients.filter(r => r.IsRead).length
    });

  } catch (error) {
    console.error('Error fetching message recipients for dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
