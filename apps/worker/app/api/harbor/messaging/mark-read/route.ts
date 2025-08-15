import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
// Removed messaging events import - no longer needed


interface MarkReadRequest {
  messageId: number;
}

export async function POST(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userEmail = session.user.email;
    const body: MarkReadRequest = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return new Response(JSON.stringify({ error: 'Message ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is a recipient of this message and get tenant info
    const checkRecipientQuery = `
      SELECT mr.Id, mr.IsRead, m.TenantId
      FROM MessageRecipients mr
      INNER JOIN Messages m ON mr.MessageId = m.Id
      WHERE mr.MessageId = ? AND mr.RecipientEmail = ?
    `;

    const recipientResult = await db.prepare(checkRecipientQuery)
      .bind(messageId, userEmail)
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
      .bind(readAt, messageId, userEmail)
      .run();

    // SSE events are now handled by the polling-based endpoint
    // No need to broadcast - clients will receive updates automatically

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