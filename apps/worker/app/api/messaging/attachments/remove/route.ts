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
    const body = await request.json() as { messageId: string; attachmentId: string; tenantId: string };
    const { messageId, attachmentId, tenantId } = body;

    if (!messageId || !attachmentId || !tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: messageId, attachmentId, tenantId' 
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

    // Get message details to check access permissions
    const message = await db.prepare(`
      SELECT m.*, mr.RecipientEmail 
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE m.Id = ? AND m.TenantId = ?
    `).bind(messageId, tenantId).first();

    if (!message) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Message not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to this message (sender or recipient)
    const hasMessageAccess = message.SenderEmail === userEmail || 
      (message.RecipientEmail && message.RecipientEmail === userEmail);

    if (!hasMessageAccess) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Access denied' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is the sender (only sender can remove attachments)
    if (message.SenderEmail !== userEmail) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Only the message sender can remove attachments' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get attachment details
    const attachment = await db.prepare(`
      SELECT ma.*, m.TenantId, m.SenderEmail
      FROM MessageAttachments ma
      INNER JOIN Messages m ON ma.MessageId = m.Id
      WHERE ma.Id = ? AND ma.MessageId = ?
    `).bind(attachmentId, messageId).first();

    if (!attachment) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Attachment not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store attachment details for event broadcasting
    const attachmentDetails = {
      messageId: parseInt(messageId),
      tenantId: tenantId,
      attachmentId: parseInt(attachmentId),
      fileName: attachment.FileName as string,
      fileSize: attachment.FileSize as number,
      contentType: attachment.ContentType as string,
      attachmentType: attachment.AttachmentType as string,
      mediaId: attachment.MediaId as number
    };

    // Remove the attachment
    await db.prepare(`
      DELETE FROM MessageAttachments WHERE Id = ? AND MessageId = ?
    `).bind(attachmentId, messageId).run();

    // Update message to reflect attachment status
    await db.prepare(`
      UPDATE Messages 
      SET HasAttachments = (
        SELECT COUNT(*) > 0 FROM MessageAttachments WHERE MessageId = ?
      ), AttachmentCount = (
        SELECT COUNT(*) FROM MessageAttachments WHERE MessageId = ?
      )
      WHERE Id = ?
    `).bind(messageId, messageId, messageId).run();

    // Broadcast attachment removed event
    const eventData = createAttachmentEventData(
      attachmentDetails.messageId,
      attachmentDetails.tenantId,
      attachmentDetails.attachmentId,
      attachmentDetails.fileName,
      attachmentDetails.fileSize,
      attachmentDetails.contentType,
      attachmentDetails.attachmentType as 'media_library' | 'upload',
      attachmentDetails.mediaId
    );
    
    MessagingEventBroadcaster.broadcastAttachmentRemoved(tenantId, eventData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Attachment removed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error removing attachment:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
