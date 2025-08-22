import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import type { D1Result } from '@cloudflare/workers-types';

type Params = Promise<{ id: string }>;

// GET /api/dashboard/messaging/messages/[id] - Get a specific message for dashboard
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

    // Build query based on user's access level
    let messageQuery = '';
    let queryParams: any[] = [];

    if (isAdmin) {
      // System admins can see all messages
      messageQuery = `
        SELECT * FROM Messages WHERE Id = ? AND IsDeleted = FALSE
      `;
      queryParams = [messageId];
    } else {
      // Tenant admins can only see messages from their tenants
      messageQuery = `
        SELECT * FROM Messages 
        WHERE Id = ? AND IsDeleted = FALSE 
        AND TenantId IN (${accessibleTenants.map(() => '?').join(',')})
      `;
      queryParams = [messageId, ...accessibleTenants];
    }

    const message = await db.prepare(messageQuery).bind(...queryParams).first();

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Get all recipients
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

    // Get attachments if any
    let attachments: any[] = [];
    if (message.HasAttachments) {
      const attachmentsResult = await db.prepare(`
        SELECT 
          ma.Id,
          ma.FileName,
          ma.FileSize,
          ma.ContentType,
          ma.AttachmentType,
          ma.CreatedAt
        FROM MessageAttachments ma
        WHERE ma.MessageId = ?
        ORDER BY ma.CreatedAt
      `).bind(messageId).all() as D1Result<any>;
      
      attachments = attachmentsResult.results || [];
    }

    // Get sender name
    const senderResult = await db.prepare(`
      SELECT Name FROM Subscribers WHERE Email = ?
    `).bind(message.SenderEmail).first() as { Name: string } | undefined;

    // Log access activity
    const { ipAddress, userAgent } = extractRequestContext(request);
    const normalizedLogging = new NormalizedLogging(db);
    await normalizedLogging.logMessagingOperations({
      userEmail: session.user.email,
      tenantId: message.TenantId as string,
      activityType: 'VIEW_MESSAGE_DASHBOARD',
      accessType: 'read',
      targetId: messageId.toString(),
      targetName: String(message.Subject),
      ipAddress,
      userAgent
    });

    return NextResponse.json({
      ...message,
      senderName: senderResult?.Name || message.SenderEmail,
      recipients: recipients,
      attachments: attachments
    });

  } catch (error) {
    console.error('Error getting message for dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/dashboard/messaging/messages/[id] - Update message (admin operations)
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

    // Check if user has admin access
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const accessibleTenants = await getUserMessagingTenants(session.user.email);
    
    if (!isAdmin && accessibleTenants.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json() as { action: string };
    const { action } = body;

    // Get message data for logging
    const messageData = await db.prepare(`
      SELECT TenantId FROM Messages WHERE Id = ?
    `).bind(messageId).first() as { TenantId: string } | undefined;

    if (action === 'mark-read') {
      // Mark message as read for all recipients
      await db.prepare(`
        UPDATE MessageRecipients 
        SET IsRead = TRUE, ReadAt = datetime('now')
        WHERE MessageId = ?
      `).bind(messageId).run();

      // Log activity
      const { ipAddress, userAgent } = extractRequestContext(request);
      const normalizedLogging = new NormalizedLogging(db);
      await normalizedLogging.logMessagingOperations({
        userEmail: session.user.email,
        tenantId: messageData?.TenantId || 'unknown',
        activityType: 'MARK_READ_DASHBOARD',
        accessType: 'write',
        targetId: messageId.toString(),
        targetName: 'Marked message as read for all recipients',
        ipAddress,
        userAgent
      });

      return NextResponse.json({ success: true, message: 'Message marked as read for all recipients' });
    }

    if (action === 'recall') {
      // Recall message (admin override)
      await db.prepare(`
        UPDATE Messages 
        SET IsRecalled = TRUE, RecalledAt = datetime('now')
        WHERE Id = ?
      `).bind(messageId).run();

      // Log activity
      const { ipAddress, userAgent } = extractRequestContext(request);
      const normalizedLogging = new NormalizedLogging(db);
      await normalizedLogging.logMessagingOperations({
        userEmail: session.user.email,
        tenantId: messageData?.TenantId || 'unknown',
        activityType: 'RECALL_MESSAGE_DASHBOARD',
        accessType: 'write',
        targetId: messageId.toString(),
        targetName: 'Message recalled by admin',
        ipAddress,
        userAgent
      });

      return NextResponse.json({ success: true, message: 'Message recalled successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error updating message for dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/dashboard/messaging/messages/[id] - Delete message (admin only)
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

    // Check if user has admin access
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const accessibleTenants = await getUserMessagingTenants(session.user.email);
    
    if (!isAdmin && accessibleTenants.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get message data for access control and logging
    const messageData = await db.prepare(`
      SELECT TenantId FROM Messages WHERE Id = ?
    `).bind(messageId).first() as { TenantId: string } | undefined;

    if (!messageData) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check access control: Global admins can delete any message, tenant admins can only delete messages from their tenants
    if (!isAdmin) {
      // Tenant admin: check if message belongs to one of their accessible tenants
      if (!accessibleTenants.includes(messageData.TenantId)) {
        return NextResponse.json({ error: 'Access denied: Message not in your tenant scope' }, { status: 403 });
      }
    }

    // Check delete type from query parameters (default to soft delete)
    const url = new URL(request.url);
    const deleteType = url.searchParams.get('type') || 'soft';
    
    if (!['soft', 'hard'].includes(deleteType)) {
      return NextResponse.json({ error: 'Invalid delete type. Use "soft" or "hard"' }, { status: 400 });
    }

    // First, get all attachments for this message to delete from R2
    const attachmentsResult = await db.prepare(`
      SELECT ma.MediaId, mf.R2Key, mf.FileName
      FROM MessageAttachments ma
      JOIN MediaFiles mf ON ma.MediaId = mf.Id
      WHERE ma.MessageId = ?
    `).bind(messageId).all() as D1Result<{ MediaId: number; R2Key: string; FileName: string }>;

    const attachments = attachmentsResult.results || [];

    // Delete files from R2 storage first
    for (const attachment of attachments) {
      try {
        await env.MEDIA_BUCKET.delete(attachment.R2Key);
        console.log(`Deleted R2 file: ${attachment.FileName} (${attachment.R2Key})`);
      } catch (error) {
        console.error(`Failed to delete R2 file ${attachment.FileName}:`, error);
        // Continue with deletion even if R2 deletion fails
        // The file will be orphaned in R2 but database will be cleaned up
      }
    }

    if (deleteType === 'hard') {
      // HARD DELETE: Permanently remove all records
      
      // Delete MessageAttachments (cascade will handle this, but explicit for clarity)
      await db.prepare(`
        DELETE FROM MessageAttachments WHERE MessageId = ?
      `).bind(messageId).run();

      // Delete MessageLinks (cascade will handle this, but explicit for clarity)
      await db.prepare(`
        DELETE FROM MessageLinks WHERE MessageId = ?
      `).bind(messageId).run();

      // Delete MessageRecipients
      await db.prepare(`
        DELETE FROM MessageRecipients WHERE MessageId = ?
      `).bind(messageId).run();

      // Finally delete the message itself
      await db.prepare(`
        DELETE FROM Messages WHERE Id = ?
      `).bind(messageId).run();

      // Log hard delete activity
      const { ipAddress, userAgent } = extractRequestContext(request);
      const normalizedLogging = new NormalizedLogging(db);
      await normalizedLogging.logMessagingOperations({
        userEmail: session.user.email,
        tenantId: messageData.TenantId,
        activityType: 'HARD_DELETE_MESSAGE_DASHBOARD',
        accessType: 'write',
        targetId: messageId.toString(),
        targetName: `Message, ${attachments.length} attachments, and all recipients HARD DELETED by admin`,
        ipAddress,
        userAgent,
        metadata: {
          deleteType: 'hard',
          attachmentsDeleted: attachments.length,
          attachmentNames: attachments.map(a => a.FileName)
        }
      });

      return NextResponse.json({ success: true, message: 'Message permanently deleted' });

    } else {
      // SOFT DELETE: Mark as deleted but keep records
      
      // Soft delete the message
      await db.prepare(`
        UPDATE Messages 
        SET IsDeleted = TRUE, DeletedAt = datetime('now')
        WHERE Id = ?
      `).bind(messageId).run();

      // Also soft delete all MessageRecipients for this message
      await db.prepare(`
        UPDATE MessageRecipients 
        SET IsDeleted = TRUE, DeletedAt = datetime('now')
        WHERE MessageId = ?
      `).bind(messageId).run();

      // Log soft delete activity
      const { ipAddress, userAgent } = extractRequestContext(request);
      const normalizedLogging = new NormalizedLogging(db);
      await normalizedLogging.logMessagingOperations({
        userEmail: session.user.email,
        tenantId: messageData.TenantId,
        activityType: 'DELETE_MESSAGE_DASHBOARD',
        accessType: 'write',
        targetId: messageId.toString(),
        targetName: `Message, ${attachments.length} attachments, and all recipients soft deleted by admin`,
        ipAddress,
        userAgent,
        metadata: {
          deleteType: 'soft',
          attachmentsDeleted: attachments.length,
          attachmentNames: attachments.map(a => a.FileName)
        }
      });

      return NextResponse.json({ success: true, message: 'Message deleted successfully' });
    }

  } catch (error) {
    console.error('Error deleting message for dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
