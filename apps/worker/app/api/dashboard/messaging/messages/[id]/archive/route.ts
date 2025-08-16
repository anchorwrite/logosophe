import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';

// POST /api/dashboard/messaging/messages/[id]/archive - Archive a message
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
      SELECT m.Id, m.TenantId, m.SenderEmail, m.IsArchived
      FROM Messages m
      WHERE m.Id = ? AND m.IsDeleted = FALSE
    `;
    
    const message = await db.prepare(messageQuery)
      .bind(messageId)
      .first() as { Id: number; TenantId: string; SenderEmail: string; IsArchived: boolean } | null;

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check if user has access to this message (sender or recipient)
    const hasAccess = message.SenderEmail === session.user.email || 
      await db.prepare(`
        SELECT 1 FROM MessageRecipients 
        WHERE MessageId = ? AND RecipientEmail = ? AND IsDeleted = FALSE
      `).bind(messageId, session.user.email).first();

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this message' }, { status: 403 });
    }

    // Toggle archive status
    const newArchiveStatus = !message.IsArchived;
    const updateQuery = `
      UPDATE Messages 
      SET IsArchived = ?, ArchivedAt = ${newArchiveStatus ? 'datetime(\'now\')' : 'NULL'}
      WHERE Id = ? AND IsDeleted = FALSE
    `;
    
    await db.prepare(updateQuery)
      .bind(newArchiveStatus ? 1 : 0, messageId)
      .run();

    return NextResponse.json({ 
      success: true,
      message: newArchiveStatus ? 'Message archived' : 'Message unarchived',
      isArchived: newArchiveStatus
    });

  } catch (error) {
    console.error('Error archiving message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
