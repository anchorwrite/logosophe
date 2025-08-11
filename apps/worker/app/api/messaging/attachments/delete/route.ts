import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { MessagingEventBroadcaster, createAttachmentEventData } from '@/lib/messaging-events';

export async function DELETE(request: NextRequest) {
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
    const url = new URL(request.url);
    const attachmentId = url.searchParams.get('attachmentId');

    if (!attachmentId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing attachmentId parameter' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get attachment details to check access
    const attachment = await db.prepare(`
      SELECT 
        ma.Id,
        ma.MessageId,
        ma.MediaId,
        ma.AttachmentType,
        ma.FileName,
        ma.FileSize,
        ma.ContentType,
        m.SenderEmail,
        m.TenantId,
        mf.FileKey,
        mf.TenantId as MediaTenantId
      FROM MessageAttachments ma
      JOIN Messages m ON ma.MessageId = m.Id
      JOIN MediaFiles mf ON ma.MediaId = mf.Id
      WHERE ma.Id = ?
    `).bind(attachmentId).first();

    if (!attachment) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Attachment not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has permission to delete this attachment
    let hasPermission = false;
    
    // System admins can delete any attachment
    if (await isSystemAdmin(userEmail, db)) {
      hasPermission = true;
    } else {
      // Check if user is the sender of the message
      if (attachment.SenderEmail === userEmail) {
        hasPermission = true;
      } else {
        // Check if user is a tenant admin for this tenant
        if (await isTenantAdminFor(userEmail, attachment.TenantId as string)) {
          hasPermission = true;
        }
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: You do not have permission to delete this attachment' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete the attachment (soft delete from MediaFiles if no other references)
    await db.prepare(`
      DELETE FROM MessageAttachments WHERE Id = ?
    `).bind(attachmentId).run();

    // Check if this media file is used by other messages
    const otherAttachments = await db.prepare(`
      SELECT 1 FROM MessageAttachments WHERE MediaId = ?
    `).bind(attachment.MediaId).first();

    // If no other attachments use this media file, soft delete it
    if (!otherAttachments) {
      await db.prepare(`
        UPDATE MediaFiles 
        SET DeletedAt = datetime('now'), DeletedBy = ?
        WHERE Id = ?
      `).bind(userEmail, attachment.MediaId).run();
    }

    // Broadcast attachment removed event
    try {
      const eventData = createAttachmentEventData(
        parseInt(attachment.MessageId as string),
        attachment.TenantId as string,
        parseInt(attachmentId),
        attachment.FileName as string,
        parseInt(attachment.FileSize as string),
        attachment.ContentType as string,
        attachment.AttachmentType as 'media_library' | 'upload',
        parseInt(attachment.MediaId as string)
      );
      
      MessagingEventBroadcaster.broadcastAttachmentRemoved(attachment.TenantId as string, eventData);
    } catch (broadcastError) {
      console.error('Failed to broadcast attachment removal event:', broadcastError);
      // Don't fail the request if broadcasting fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Attachment deleted successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting attachment:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
