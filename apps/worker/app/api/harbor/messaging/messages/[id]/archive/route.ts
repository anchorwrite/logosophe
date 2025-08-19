import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { SystemLogs } from '@/lib/system-logs';


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

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);
    const { id } = await params;
    const messageId = parseInt(id);

    if (isNaN(messageId)) {
      return new Response(JSON.stringify({ error: 'Invalid message ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to this message (sender or recipient)
    const checkAccessQuery = `
      SELECT m.SenderEmail, mr.RecipientEmail, mr.IsArchived
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.RecipientEmail = ?
      WHERE m.Id = ? AND (m.SenderEmail = ? OR mr.RecipientEmail = ?)
      AND m.IsDeleted = FALSE
    `;

    const accessResult = await db.prepare(checkAccessQuery)
      .bind(access.email, messageId, access.email, access.email)
      .first() as any;

    if (!accessResult) {
      return new Response(JSON.stringify({ error: 'Message not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If user is the sender, archive the entire message
    if (accessResult.SenderEmail === access.email) {
      // Try to update with archiving columns, fall back to just marking as deleted if columns don't exist
      try {
        await db.prepare(`
          UPDATE Messages 
          SET IsArchived = TRUE, ArchivedAt = ?
          WHERE Id = ?
        `).bind(new Date().toISOString(), messageId).run();

        // Also mark all recipients as archived
        await db.prepare(`
          UPDATE MessageRecipients 
          SET IsArchived = TRUE, ArchivedAt = ?
          WHERE MessageId = ?
        `).bind(new Date().toISOString(), messageId).run();
      } catch (error) {
        // If archiving columns don't exist, just mark as deleted
        await db.prepare(`
          UPDATE Messages 
          SET IsDeleted = TRUE
          WHERE Id = ?
        `).bind(messageId).run();
      }
    } else {
      // If user is a recipient, only mark their recipient record as archived
      try {
        const isArchived = accessResult.IsArchived === 1;
        const newArchivedState = !isArchived;
        
        await db.prepare(`
          UPDATE MessageRecipients 
          SET IsArchived = ?, ArchivedAt = ?
          WHERE MessageId = ? AND RecipientEmail = ?
        `).bind(newArchivedState ? 1 : 0, newArchivedState ? new Date().toISOString() : null, messageId, access.email).run();
      } catch (error) {
        // If archiving columns don't exist, just mark as deleted
        await db.prepare(`
          UPDATE MessageRecipients 
          SET IsDeleted = TRUE, DeletedAt = ?
          WHERE MessageId = ? AND RecipientEmail = ?
        `).bind(new Date().toISOString(), messageId, access.email).run();
      }
    }

    // Log the archive action
    await systemLogs.createLog({
      logType: 'activity',
      timestamp: new Date().toISOString(),
      userEmail: access.email,
              activityType: 'message_archived',
      metadata: {
        messageId,
        isSender: accessResult.SenderEmail === access.email
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Message archived successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error archiving message:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 