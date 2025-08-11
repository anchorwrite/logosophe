import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
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

    // Build the base query
    let baseQuery = `
      FROM Messages m
      INNER JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE m.TenantId = ? AND mr.RecipientEmail = ? AND m.IsDeleted = FALSE AND mr.IsDeleted = FALSE
    `;
    
    const queryParams: any[] = [tenantId, userEmail];

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

    // Get total count
    const countQuery = `SELECT COUNT(DISTINCT m.Id) as total ${baseQuery}`;
    const countResult = await db.prepare(countQuery).bind(...queryParams).first();
    const total = parseInt(countResult?.total as string) || 0;

    // Get messages with pagination
    const messagesQuery = `
      SELECT DISTINCT m.*, mr.IsRead, mr.ReadAt
      ${baseQuery}
      ORDER BY m.CreatedAt DESC
      LIMIT ? OFFSET ?
    `;
    
    const offset = (page - 1) * pageSize;
    const messagesResult = await db.prepare(messagesQuery)
      .bind(...queryParams, pageSize, offset)
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
        SELECT ma.Id, ma.MessageId, ma.MediaId, ma.AttachmentType, ma.FileName, ma.FileSize, ma.ContentType, ma.CreatedAt,
               mf.R2Key
        FROM MessageAttachments ma
        INNER JOIN MediaFiles mf ON ma.MediaId = mf.Id
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
        id: message.Id,
        senderEmail: message.SenderEmail,
        subject: message.Subject,
        body: message.Body,
        tenantId: message.TenantId,
        messageType: message.MessageType,
        priority: message.Priority,
        createdAt: message.CreatedAt,
        expiresAt: message.ExpiresAt,
        isDeleted: message.IsDeleted,
        isRecalled: message.IsRecalled,
        recalledAt: message.RecalledAt,
        recallReason: message.RecallReason,
        isArchived: message.IsArchived,
        archivedAt: message.ArchivedAt,
        deletedAt: message.DeletedAt,
        hasAttachments: message.HasAttachments,
        attachmentCount: message.AttachmentCount,
        recipients: recipientsResult.results.map(r => ({
          Id: r.Id,
          MessageId: r.MessageId,
          RecipientEmail: r.RecipientEmail,
          IsRead: r.IsRead,
          ReadAt: r.ReadAt,
          IsDeleted: r.IsDeleted,
          DeletedAt: r.DeletedAt,
          IsForwarded: r.IsForwarded,
          ForwardedAt: r.ForwardedAt,
          IsSaved: r.IsSaved,
          SavedAt: r.SavedAt,
          IsReplied: r.IsReplied,
          RepliedAt: r.RepliedAt,
          IsArchived: r.IsArchived,
          ArchivedAt: r.ArchivedAt
        })),
        attachments: attachmentsResult.results.map(a => ({
          id: a.Id,
          fileName: a.FileName,
          fileSize: a.FileSize,
          contentType: a.ContentType,
          attachmentType: a.AttachmentType,
          mediaId: a.MediaId,
          downloadUrl: `/api/media/download/${a.MediaId}`,
          previewUrl: (a.ContentType as string).startsWith('image/') ? `/api/media/preview/${a.MediaId}` : undefined
        })),
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

    // Get message statistics
    const statsResult = await db.prepare(`
      SELECT 
        COUNT(DISTINCT m.Id) as totalMessages,
        COUNT(DISTINCT CASE WHEN mr.IsRead = FALSE THEN m.Id END) as unreadMessages,
        COUNT(DISTINCT CASE WHEN m.SenderEmail = ? THEN m.Id END) as sentMessages,
        COUNT(DISTINCT CASE WHEN m.SenderEmail != ? THEN m.Id END) as receivedMessages,
        SUM(m.AttachmentCount) as attachmentsCount,
        (SELECT COUNT(*) FROM MessageLinks ml WHERE ml.MessageId IN (SELECT DISTINCT m2.Id FROM Messages m2 INNER JOIN MessageRecipients mr2 ON m2.Id = mr2.MessageId WHERE m2.TenantId = ? AND mr2.RecipientEmail = ? AND m2.IsDeleted = FALSE AND mr2.IsDeleted = FALSE)) as linksCount
      FROM Messages m
      INNER JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE m.TenantId = ? AND mr.RecipientEmail = ? AND m.IsDeleted = FALSE AND mr.IsDeleted = FALSE
    `).bind(userEmail, userEmail, tenantId, userEmail, tenantId, userEmail).first();

    const response = {
      items: messages,
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
    };

    return new Response(JSON.stringify({
      success: true,
      data: response
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
