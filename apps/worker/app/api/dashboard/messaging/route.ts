import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { 
  checkRateLimit, 
  updateRateLimit, 
  canSendMessage, 
  logMessagingActivity,
  isMessagingEnabled 
} from '@/lib/messaging';
import { CreateMessageRequest, SendMessageResponse, GetMessagesRequest, GetMessagesResponse } from '@/types/messaging';


// POST /api/messages - Send a message
export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const body = await request.json() as CreateMessageRequest;
    const { subject, body: messageBody, recipients, tenantId, messageType = 'direct', priority = 'normal', attachments = [] } = body;
    const replyToMessageId = (body as any).replyToMessageId;

    // Validate required fields
    if (!subject || !messageBody || !recipients || !tenantId || !messageType) {
      return NextResponse.json({ 
        error: 'Missing required fields: subject, body, recipients, tenantId, messageType' 
      }, { status: 400 });
    }

    // Check if messaging is enabled
    const messagingEnabled = await isMessagingEnabled();
    if (!messagingEnabled) {
      return NextResponse.json({ 
        error: 'Messaging system is currently disabled' 
      }, { status: 503 });
    }

    // Check rate limiting
    const rateLimitInfo = await checkRateLimit(access.email);
    if (!rateLimitInfo.allowed) {
      return NextResponse.json({
        success: false,
        error: `Rate limit exceeded. Please wait ${rateLimitInfo.waitSeconds} seconds before sending another message.`,
        rateLimitInfo
      } as SendMessageResponse, { status: 429 });
    }

    // Check if user can send message
    const sendCheck = await canSendMessage(access.email, tenantId, messageType, recipients);
    if (!sendCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: sendCheck.error || 'Cannot send message'
      } as SendMessageResponse, { status: 403 });
    }

    // Filter out blocked recipients
    const validRecipients = recipients.filter(r => !sendCheck.blockedRecipients.includes(r));
    if (validRecipients.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'All recipients have blocked you from sending messages'
      } as SendMessageResponse, { status: 403 });
    }

    // Validate attachments if provided
    if (attachments.length > 0) {
      const validAttachments = await db.prepare(`
        SELECT Id FROM MediaFiles WHERE Id IN (${attachments.map(() => '?').join(',')}) AND IsDeleted = 0
      `).bind(...attachments).all();
      
      const validAttachmentIds = validAttachments.results?.map(a => a.Id) || [];
      const invalidAttachments = attachments.filter(a => !validAttachmentIds.includes(a));
      
      if (invalidAttachments.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Invalid attachment IDs: ${invalidAttachments.join(', ')}`
        } as SendMessageResponse, { status: 400 });
      }
    }

    // Create the message
    const messageResult = await db.prepare(`
      INSERT INTO Messages (Subject, Body, SenderEmail, TenantId, MessageType, Priority, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(subject, messageBody, access.email, tenantId, messageType, priority).run();

    const messageId = messageResult.meta.last_row_id;

    // Create recipient entries
    for (const recipient of validRecipients) {
      await db.prepare(`
        INSERT INTO MessageRecipients (MessageId, RecipientEmail)
        VALUES (?, ?)
      `).bind(messageId, recipient).run();
    }

    // Add attachments if provided
    for (const mediaId of attachments) {
      await db.prepare(`
        INSERT INTO MessageAttachments (MessageId, MediaId)
        VALUES (?, ?)
      `).bind(messageId, mediaId).run();
    }

    // Create thread if this is a reply
    if (replyToMessageId) {
      // Check if the parent message allows replies
      const parentMessage = await db.prepare(`
        SELECT MessageType FROM Messages WHERE Id = ? AND IsDeleted = FALSE
      `).bind(replyToMessageId).first() as any;
      
      if (!parentMessage) {
        return NextResponse.json({
          success: false,
          error: 'Parent message not found'
        } as SendMessageResponse, { status: 404 });
      }
      
      if (parentMessage.MessageType !== 'direct') {
        return NextResponse.json({
          success: false,
          error: `Cannot reply to ${parentMessage.MessageType} messages. Only direct messages allow replies.`
        } as SendMessageResponse, { status: 403 });
      }
      
      await db.prepare(`
        INSERT INTO MessageThreads (ParentMessageId, ChildMessageId)
        VALUES (?, ?)
      `).bind(replyToMessageId, messageId).run();
    }

    // Update rate limit
    await updateRateLimit(access.email);

    // Log the activity
    await logMessagingActivity(
      'SEND_MESSAGE',
      access.email,
      tenantId,
      messageId.toString(),
      subject,
      {
        messageType,
        priority,
        recipientCount: validRecipients.length,
        attachmentCount: attachments.length,
        replyToMessageId
      }
    );

    return NextResponse.json({
      success: true,
      messageId,
      rateLimitInfo
    } as SendMessageResponse);

  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    } as SendMessageResponse, { status: 500 });
  }
}

// GET /api/messages - Get messages for the current user
export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const messageType = searchParams.get('messageType') || 'inbox';
    const isRead = searchParams.get('isRead');
    const search = searchParams.get('search') || '';
    const tenantId = searchParams.get('tenantId');
    const offset = (page - 1) * pageSize;

    // Build query based on message type
    let query = '';
    let countQuery = '';
    let params: any[] = [];

    if (messageType === 'inbox') {
      query = `
        SELECT m.*, mr.IsRead, mr.ReadAt, mr.IsDeleted as RecipientDeleted
        FROM Messages m
        JOIN MessageRecipients mr ON m.Id = mr.MessageId
        WHERE mr.RecipientEmail = ?
        AND mr.IsDeleted = FALSE
        AND m.IsDeleted = FALSE
      `;
      countQuery = `
        SELECT COUNT(*) as count
        FROM Messages m
        JOIN MessageRecipients mr ON m.Id = mr.MessageId
        WHERE mr.RecipientEmail = ?
        AND mr.IsDeleted = FALSE
        AND m.IsDeleted = FALSE
      `;
      params = [access.email];
    } else if (messageType === 'sent') {
      query = `
        SELECT m.*, 
               GROUP_CONCAT(mr.RecipientEmail) as Recipients,
               COUNT(mr.Id) as RecipientCount,
               SUM(CASE WHEN mr.IsRead THEN 1 ELSE 0 END) as ReadCount
        FROM Messages m
        LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
        WHERE m.SenderEmail = ?
        AND m.IsDeleted = FALSE
        GROUP BY m.Id
      `;
      countQuery = `
        SELECT COUNT(*) as count
        FROM Messages m
        WHERE m.SenderEmail = ?
        AND m.IsDeleted = FALSE
      `;
      params = [access.email];
    }

    // Add filters
    if (isRead !== null) {
      const readFilter = isRead === 'true' ? 'AND mr.IsRead = TRUE' : 'AND mr.IsRead = FALSE';
      query += ` ${readFilter}`;
    }

    if (search) {
      query += ` AND (m.Subject LIKE ? OR m.Body LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (tenantId) {
      query += ` AND m.TenantId = ?`;
      params.push(tenantId);
    }

    // Add ordering and pagination
    query += ` ORDER BY m.CreatedAt DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Get messages
    const messagesResult = await db.prepare(query).bind(...params).all();
    const countResult = await db.prepare(countQuery).bind(...params.slice(0, -2)).first() as { count: number };

    // Get unread count
    const unreadResult = await db.prepare(`
      SELECT COUNT(*) as count
      FROM Messages m
      JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE mr.RecipientEmail = ?
      AND mr.IsRead = FALSE
      AND mr.IsDeleted = FALSE
      AND m.IsDeleted = FALSE
    `).bind(access.email).first() as { count: number };

    // Get attachments for messages
    const messageIds = messagesResult.results?.map(m => m.Id) || [];
    let attachments: any[] = [];
    
    if (messageIds.length > 0) {
      const attachmentsResult = await db.prepare(`
        SELECT ma.MessageId, ma.MediaId, mf.FileName, mf.ContentType
        FROM MessageAttachments ma
        JOIN MediaFiles mf ON ma.MediaId = mf.Id
        WHERE ma.MessageId IN (${messageIds.map(() => '?').join(',')})
      `).bind(...messageIds).all();
      attachments = attachmentsResult.results || [];
    }

    // Group attachments by message
    const attachmentsByMessage = attachments.reduce((acc, att) => {
      if (!acc[att.MessageId]) acc[att.MessageId] = [];
      acc[att.MessageId].push(att);
      return acc;
    }, {} as Record<number, any[]>);

    // Format response
    const messages = messagesResult.results?.map(message => ({
      ...message,
      attachments: attachmentsByMessage[message.Id as string | number] || []
    })) || [];

    return NextResponse.json({
      messages,
      totalCount: countResult.count,
      unreadCount: unreadResult.count
    } as GetMessagesResponse);

  } catch (error) {
    console.error('Error getting messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 