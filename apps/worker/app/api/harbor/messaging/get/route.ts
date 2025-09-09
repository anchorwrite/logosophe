import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { isUserBlocked } from '@/lib/messaging';
import { GetMessagesResponse, Message, MessageRecipient } from '@/types/messaging';

export async function GET(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userEmail = session.user.email;
    const { searchParams } = new URL(request.url);
    
    const tenantId = searchParams.get('tenantId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100); // Max 100 per page
    const messageType = searchParams.get('messageType');
    const hasAttachments = searchParams.get('hasAttachments');
    const isRead = searchParams.get('isRead');
    const search = searchParams.get('search');

    if (!tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing tenantId parameter' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to this tenant
    let hasAccess = false;
    
    // System admins have access to all tenants
    if (await isSystemAdmin(userEmail, db)) {
      hasAccess = true;
    } else {
      // Check if user is a tenant admin for this tenant
      if (await isTenantAdminFor(userEmail, tenantId)) {
        hasAccess = true;
      } else {
        // Check if user is a member of this tenant
        const userTenant = await db.prepare(`
          SELECT 1 FROM TenantUsers 
          WHERE TenantId = ? AND Email = ?
        `).bind(tenantId, userEmail).first();
        
        hasAccess = !!userTenant;
      }
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: User does not have access to this tenant' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build the base query with system-wide block override
    let baseQuery = `
      FROM Messages m
      INNER JOIN MessageRecipients mr ON m.Id = mr.MessageId
      LEFT JOIN Subscribers s ON m.SenderEmail = s.Email AND s.Active = TRUE
      WHERE m.TenantId = ? AND mr.RecipientEmail = ? AND m.IsDeleted = FALSE AND mr.IsDeleted = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM UserBlocks ub 
        WHERE (
          -- System-wide blocks (from admins) override personal blocks
          (ub.BlockerEmail IN (
            SELECT Email FROM Credentials WHERE Role IN ('admin', 'tenant')
          ) AND (ub.BlockedEmail = m.SenderEmail OR ub.BlockedEmail = ?))
          OR
          -- Personal blocks (bidirectional)
          ((ub.BlockerEmail = ? AND ub.BlockedEmail = m.SenderEmail AND ub.TenantId = ? AND ub.IsActive = TRUE)
          OR (ub.BlockerEmail = m.SenderEmail AND ub.BlockedEmail = ? AND ub.TenantId = ? AND ub.IsActive = TRUE))
        )
      )
    `;
    
    const queryParams: any[] = [tenantId, userEmail, userEmail, userEmail, tenantId, userEmail, tenantId];

    // Add filters
    if (messageType) {
      baseQuery += ` AND m.MessageType = ?`;
      queryParams.push(messageType);
    }

    if (hasAttachments !== null) {
      baseQuery += ` AND m.HasAttachments = ?`;
      queryParams.push(hasAttachments === 'true');
    }

    if (isRead !== null) {
      baseQuery += ` AND mr.IsRead = ?`;
      queryParams.push(isRead === 'true');
    }

    if (search) {
      baseQuery += ` AND (m.Subject LIKE ? OR m.Body LIKE ?)`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    // Get total count (without pagination parameters)
    const countQuery = `SELECT COUNT(DISTINCT m.Id) as total ${baseQuery}`;
    const countResult = await db.prepare(countQuery).bind(...queryParams).first();
    const total = parseInt(countResult?.total as string) || 0;

    // Get messages with pagination (add pagination parameters)
    const messagesQuery = `
      SELECT DISTINCT m.*, mr.IsRead, mr.ReadAt, s.Name as SenderName
      ${baseQuery}
      ORDER BY m.CreatedAt DESC
      LIMIT ? OFFSET ?
    `;
    
    const offset = (page - 1) * pageSize;
    const messagesParams = [...queryParams, pageSize, offset];
    const messagesResult = await db.prepare(messagesQuery)
      .bind(...messagesParams)
      .all();

    // Process messages to include attachments and links
    const messages: any[] = [];
    
    for (const message of messagesResult.results) {
      // Get recipients
      const recipientsResult = await db.prepare(`
        SELECT Id, MessageId, RecipientEmail, IsRead, ReadAt, IsDeleted, DeletedAt, IsForwarded, ForwardedAt, IsSaved, SavedAt, IsReplied, RepliedAt, IsArchived, ArchivedAt
        FROM MessageRecipients 
        WHERE MessageId = ? AND IsDeleted = FALSE
      `).bind(message.Id).all();

      // Get attachments
      const attachmentsResult = await db.prepare(`
        SELECT ma.Id, ma.MessageId, ma.AttachmentType, ma.FileName, ma.FileSize, ma.ContentType, ma.CreatedAt, ma.R2Key
        FROM MessageAttachments ma
        WHERE ma.MessageId = ?
      `).bind(message.Id).all();

      // Get links
      const linksResult = await db.prepare(`
        SELECT Id, MessageId, Url, Title, Description, ThumbnailUrl, Domain, CreatedAt
        FROM MessageLinks 
        WHERE MessageId = ?
      `).bind(message.Id).all();

      // Transform to response format
      const messageResponse = {
        Id: message.Id,
        Subject: message.Subject,
        Body: message.Body,
        SenderEmail: message.SenderEmail,
        SenderName: message.SenderName || message.SenderEmail,
        CreatedAt: message.CreatedAt,
        IsRead: message.IsRead,
        MessageType: message.MessageType,
        RecipientCount: recipientsResult.results.length,
        HasAttachments: attachmentsResult.results.length > 0,
        AttachmentCount: attachmentsResult.results.length,
        // Include attachments data for the frontend
        attachments: attachmentsResult.results.map(a => ({
          Id: a.Id,
          MessageId: a.MessageId,
          AttachmentType: a.AttachmentType,
          FileName: a.FileName,
          FileSize: a.FileSize,
          ContentType: a.ContentType,
          CreatedAt: a.CreatedAt,
          R2Key: a.R2Key
        })),
        // Include links data for the frontend
        links: linksResult.results.map(l => ({
          id: l.Id,
          url: l.Url,
          title: l.Title,
          description: l.Description,
          thumbnailUrl: l.ThumbnailUrl,
          domain: l.Domain
        }))
      };

      messages.push(messageResponse);
    }

    // Calculate pagination info
    const totalPages = Math.ceil(total / pageSize);

    // Get message statistics with system-wide block override
    const statsResult = await db.prepare(`
      SELECT 
        COUNT(DISTINCT m.Id) as totalMessages,
        COUNT(DISTINCT CASE WHEN mr.IsRead = FALSE THEN m.Id END) as unreadMessages,
        COUNT(DISTINCT CASE WHEN m.SenderEmail = ? THEN m.Id END) as sentMessages,
        COUNT(DISTINCT CASE WHEN m.SenderEmail != ? THEN m.Id END) as receivedMessages,
        SUM(m.AttachmentCount) as attachmentsCount,
        0 as linksCount
      FROM Messages m
      INNER JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE m.TenantId = ? AND mr.RecipientEmail = ? AND m.IsDeleted = FALSE AND mr.IsDeleted = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM UserBlocks ub 
        WHERE (
          -- System-wide blocks (from admins) override personal blocks
          (ub.BlockerEmail IN (
            SELECT Email FROM Credentials WHERE Role IN ('admin', 'tenant')
          ) AND (ub.BlockedEmail = m.SenderEmail OR ub.BlockedEmail = ?))
          OR
          -- Personal blocks (bidirectional)
          ((ub.BlockerEmail = ? AND ub.BlockedEmail = m.SenderEmail AND ub.TenantId = ? AND ub.IsActive = TRUE)
          OR (ub.BlockerEmail = m.SenderEmail AND ub.BlockedEmail = ? AND ub.TenantId = ? AND ub.IsActive = TRUE))
        )
      )
    `).bind(userEmail, userEmail, tenantId, userEmail, userEmail, userEmail, tenantId, userEmail, tenantId).first();

    return new Response(JSON.stringify({
      success: true,
      messages: messages,
      total,
      page,
      pageSize,
      totalPages,
      stats: {
        totalMessages: statsResult?.totalMessages || 0,
        unreadMessages: statsResult?.unreadMessages || 0,
        sentMessages: statsResult?.sentMessages || 0,
        receivedMessages: statsResult?.receivedMessages || 0,
        attachmentsCount: statsResult?.attachmentsCount || 0,
        linksCount: statsResult?.linksCount || 0
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting messages:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
