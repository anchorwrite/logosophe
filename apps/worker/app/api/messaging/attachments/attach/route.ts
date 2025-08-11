import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { MessagingEventBroadcaster, createAttachmentEventData } from '@/lib/messaging-events';

export async function POST(request: NextRequest) {
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
    const body = await request.json() as { messageId: string; mediaFileId: string; tenantId: string };
    
    const { messageId, mediaFileId, tenantId } = body;
    
    // Validate required fields
    if (!messageId || !mediaFileId || !tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: messageId, mediaFileId, tenantId' 
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

    // Verify message exists and user has access to it
    const message = await db.prepare(`
      SELECT m.*, mr.RecipientEmail 
      FROM Messages m
      INNER JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE m.Id = ? AND m.TenantId = ? AND (m.SenderEmail = ? OR mr.RecipientEmail = ?)
    `).bind(messageId, tenantId, userEmail, userEmail).first();

    if (!message) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Message not found or access denied' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify media file exists and user has access to it
    const mediaFile = await db.prepare(`
      SELECT mf.*, ma.TenantId as MediaTenantId
      FROM MediaFiles mf
      LEFT JOIN MediaAccess ma ON mf.Id = ma.MediaId
      WHERE mf.Id = ? AND (mf.TenantId = ? OR ma.TenantId = ? OR mf.CreatedBy = ?)
    `).bind(mediaFileId, tenantId, tenantId, userEmail).first();

    if (!mediaFile) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Media file not found or access denied' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if attachment already exists
    const existingAttachment = await db.prepare(`
      SELECT 1 FROM MessageAttachments 
      WHERE MessageId = ? AND MediaFileId = ?
    `).bind(messageId, mediaFileId).first();

    if (existingAttachment) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'File is already attached to this message' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create message attachment record
    const attachmentResult = await db.prepare(`
      INSERT INTO MessageAttachments (MessageId, MediaFileId, AttachmentType, FileName, FileSize, ContentType, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      messageId,
      mediaFileId,
      'media_library',
      mediaFile.FileName,
      mediaFile.FileSize,
      mediaFile.ContentType
    ).run();

    const attachmentId = attachmentResult.meta.last_row_id;

    // Update message to reflect attachment status
    await db.prepare(`
      UPDATE Messages 
      SET HasAttachments = TRUE, AttachmentCount = (
        SELECT COUNT(*) FROM MessageAttachments WHERE MessageId = ?
      )
      WHERE Id = ?
    `).bind(messageId, messageId).run();

    // Broadcast attachment added event
    const eventData = createAttachmentEventData(
      parseInt(messageId),
      tenantId,
      attachmentId,
      mediaFile.FileName as string,
      parseInt(mediaFile.FileSize as string),
      mediaFile.ContentType as string,
      'media_library',
      parseInt(mediaFileId)
    );
    
    MessagingEventBroadcaster.broadcastAttachmentAdded(tenantId, eventData);

    return new Response(JSON.stringify({
      success: true,
      attachmentId,
      mediaFileId,
      fileName: mediaFile.FileName,
      fileSize: mediaFile.FileSize,
      contentType: mediaFile.ContentType
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Media library attachment error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
