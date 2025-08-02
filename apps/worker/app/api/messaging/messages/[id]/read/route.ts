import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { SystemLogs } from '@/lib/system-logs';

export const runtime = 'edge';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const messageId = parseInt(id);
    if (isNaN(messageId)) {
      return new Response(JSON.stringify({ error: 'Invalid message ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);

    // Check if user is a recipient of this message
    const checkRecipientQuery = `
      SELECT mr.Id, mr.IsRead
      FROM MessageRecipients mr
      WHERE mr.MessageId = ? AND mr.RecipientEmail = ?
    `;

    const recipientResult = await db.prepare(checkRecipientQuery)
      .bind(messageId, access.email)
      .first() as any;

    if (!recipientResult) {
      return new Response(JSON.stringify({ error: 'Message not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If already read, return success
    if (recipientResult.IsRead) {
      return new Response(JSON.stringify({ success: true, alreadyRead: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mark as read
    const updateQuery = `
      UPDATE MessageRecipients 
      SET IsRead = TRUE, ReadAt = ?
      WHERE MessageId = ? AND RecipientEmail = ?
    `;

    const readAt = new Date().toISOString();
    
    await db.prepare(updateQuery)
      .bind(readAt, messageId, access.email)
      .run();

    // Log the read action
    await systemLogs.createLog({
      logType: 'ACTIVITY',
      timestamp: readAt,
      userEmail: access.email,
      activityType: 'MESSAGE_READ',
      metadata: {
        messageId,
        readAt
      }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      readAt 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error marking message as read:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 