import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { canRecallMessage, logMessagingActivity } from '@/lib/messaging';
import type { RecallMessageRequest } from '@/types/messaging';


type Params = Promise<{ id: string }>;

// GET /api/messages/[id] - Get a specific message
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

    // Get message with recipient info
    const message = await db.prepare(`
      SELECT m.*, mr.IsRead, mr.ReadAt, mr.IsDeleted as RecipientDeleted
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.RecipientEmail = ?
      WHERE m.Id = ?
      AND (m.SenderEmail = ? OR mr.RecipientEmail = ?)
      AND m.IsDeleted = FALSE
    `).bind(session.user.email, messageId, session.user.email, session.user.email).first();

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Get attachments
    const attachments = await db.prepare(`
      SELECT ma.MediaId, mf.FileName, mf.ContentType, mf.FileSize
      FROM MessageAttachments ma
      JOIN MediaFiles mf ON ma.MediaId = mf.Id
      WHERE ma.MessageId = ?
    `).bind(messageId).all();

    // Get all recipients for sent messages
    let recipients: any[] = [];
    if (message.SenderEmail === session.user.email) {
      const recipientsResult = await db.prepare(`
        SELECT mr.RecipientEmail, mr.IsRead, mr.ReadAt, s.Name
        FROM MessageRecipients mr
        LEFT JOIN Subscribers s ON mr.RecipientEmail = s.Email
        WHERE mr.MessageId = ?
      `).bind(messageId).all();
      recipients = recipientsResult.results || [];
    }

    // Mark as read if user is recipient and message is unread
    if (message.RecipientEmail === session.user.email && !message.IsRead) {
      await db.prepare(`
        UPDATE MessageRecipients 
        SET IsRead = TRUE, ReadAt = datetime('now')
        WHERE MessageId = ? AND RecipientEmail = ?
      `).bind(messageId, session.user.email).run();

      // Log read activity
      await logMessagingActivity(
        'READ_MESSAGE',
        session.user.email,
        message.TenantId as string,
        messageId.toString(),
        String(message.Subject)
      );
    }

    return NextResponse.json({
      ...message,
      attachments: attachments.results || [],
      recipients: recipients
    });

  } catch (error) {
    console.error('Error getting message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/messages/[id] - Update message (mark as read, save, etc.)
export async function PUT(
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

    const body = await request.json() as { action: string; value?: any };
    const { action, value } = body;

    // Verify user has access to this message
    const message = await db.prepare(`
      SELECT m.*, mr.RecipientEmail
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.RecipientEmail = ?
      WHERE m.Id = ?
      AND (m.SenderEmail = ? OR mr.RecipientEmail = ?)
      AND m.IsDeleted = FALSE
    `).bind(session.user.email, messageId, session.user.email, session.user.email).first();

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    switch (action) {
      case 'mark_read':
        if (message.RecipientEmail === session.user.email) {
          await db.prepare(`
            UPDATE MessageRecipients 
            SET IsRead = TRUE, ReadAt = datetime('now')
            WHERE MessageId = ? AND RecipientEmail = ?
          `).bind(messageId, session.user.email).run();

          await logMessagingActivity(
            'MARK_MESSAGE_READ',
            session.user.email,
            message.TenantId as string,
            messageId.toString(),
            String(message.Subject)
          );
        }
        break;

      case 'mark_unread':
        if (message.RecipientEmail === session.user.email) {
          await db.prepare(`
            UPDATE MessageRecipients 
            SET IsRead = FALSE, ReadAt = NULL
            WHERE MessageId = ? AND RecipientEmail = ?
          `).bind(messageId, session.user.email).run();
        }
        break;

      case 'save':
        if (message.RecipientEmail === session.user.email) {
          await db.prepare(`
            UPDATE MessageRecipients 
            SET IsSaved = TRUE, SavedAt = datetime('now')
            WHERE MessageId = ? AND RecipientEmail = ?
          `).bind(messageId, session.user.email).run();
        }
        break;

      case 'unsave':
        if (message.RecipientEmail === session.user.email) {
          await db.prepare(`
            UPDATE MessageRecipients 
            SET IsSaved = FALSE, SavedAt = NULL
            WHERE MessageId = ? AND RecipientEmail = ?
          `).bind(messageId, session.user.email).run();
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/messages/[id] - Delete message (soft delete for recipient)
export async function DELETE(
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

    // Check if user is sender or recipient
    const message = await db.prepare(`
      SELECT m.*, mr.RecipientEmail
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.RecipientEmail = ?
      WHERE m.Id = ?
      AND (m.SenderEmail = ? OR mr.RecipientEmail = ?)
      AND m.IsDeleted = FALSE
    `).bind(session.user.email, messageId, session.user.email, session.user.email).first();

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.SenderEmail === session.user.email) {
      // Sender is deleting the entire message
      await db.prepare(`
        UPDATE Messages 
        SET IsDeleted = TRUE
        WHERE Id = ?
      `).bind(messageId).run();

      await logMessagingActivity(
        'DELETE_MESSAGE_SENDER',
        session.user.email,
        message.TenantId as string,
        messageId.toString(),
        String(message.Subject)
      );
    } else {
      // Recipient is deleting from their inbox
      await db.prepare(`
        UPDATE MessageRecipients 
        SET IsDeleted = TRUE, DeletedAt = datetime('now')
        WHERE MessageId = ? AND RecipientEmail = ?
      `).bind(messageId, session.user.email).run();

      await logMessagingActivity(
        'DELETE_MESSAGE_RECIPIENT',
        session.user.email,
        message.TenantId as string,
        messageId.toString(),
        String(message.Subject)
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/messages/[id]/recall - Recall a message
export async function POST(
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

    const body = await request.json() as RecallMessageRequest;
    const { reason } = body;

    // Check if message can be recalled
    const canRecall = await canRecallMessage(messageId, session.user.email);
    if (!canRecall) {
      return NextResponse.json({ 
        error: 'Message cannot be recalled. It may have been read, is too old, or you are not the sender.' 
      }, { status: 400 });
    }

    // Recall the message
    await db.prepare(`
      UPDATE Messages 
      SET IsRecalled = TRUE, RecalledAt = datetime('now'), RecallReason = ?
      WHERE Id = ?
    `).bind(reason || 'Message recalled by sender', messageId).run();

    // Log the recall
    await logMessagingActivity(
      'RECALL_MESSAGE',
      session.user.email,
      '', // Will be filled by the function
      messageId.toString(),
      'Message recalled',
      { reason }
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error recalling message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 