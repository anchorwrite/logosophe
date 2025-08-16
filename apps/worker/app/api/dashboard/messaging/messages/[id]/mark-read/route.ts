import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';

// POST /api/dashboard/messaging/messages/[id]/mark-read - Mark message as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const messageId = parseInt(id);
    
    if (isNaN(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user has access to messaging
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const accessibleTenants = await getUserMessagingTenants(session.user.email);
    
    if (!isAdmin && accessibleTenants.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the message exists and user has access to it
    const messageQuery = `
      SELECT m.Id, m.TenantId, m.SenderEmail
      FROM Messages m
      WHERE m.Id = ? AND m.IsDeleted = FALSE
    `;
    
    const message = await db.prepare(messageQuery)
      .bind(messageId)
      .first() as { Id: number; TenantId: string; SenderEmail: string } | null;

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check if user is the sender (can't mark own messages as read)
    if (message.SenderEmail === session.user.email) {
      return NextResponse.json({ error: 'Cannot mark own messages as read' }, { status: 400 });
    }

    // Check if user is a recipient of this message
    const recipientQuery = `
      SELECT 1 FROM MessageRecipients 
      WHERE MessageId = ? AND RecipientEmail = ? AND IsDeleted = FALSE
    `;
    
    const recipient = await db.prepare(recipientQuery)
      .bind(messageId, session.user.email)
      .first();

    if (!recipient) {
      return NextResponse.json({ error: 'Not a recipient of this message' }, { status: 403 });
    }

    // Mark the message as read for this user
    const updateQuery = `
      UPDATE MessageRecipients 
      SET IsRead = TRUE, ReadAt = datetime('now')
      WHERE MessageId = ? AND RecipientEmail = ? AND IsDeleted = FALSE
    `;
    
    await db.prepare(updateQuery)
      .bind(messageId, session.user.email)
      .run();

    return NextResponse.json({ 
      success: true,
      message: 'Message marked as read'
    });

  } catch (error) {
    console.error('Error marking message as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
