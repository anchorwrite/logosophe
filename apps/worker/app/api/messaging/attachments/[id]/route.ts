import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { MessagingEventBroadcaster, createAttachmentEventData } from '@/lib/messaging-events';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: attachmentId } = await params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

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

    // Get attachment details and verify access
    const attachment = await db.prepare(`
      SELECT ma.*, m.TenantId, m.SenderEmail, mr.RecipientEmail
      FROM MessageAttachments ma
      INNER JOIN Messages m ON ma.MessageId = m.Id
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
      WHERE ma.Id = ? AND m.TenantId = ?
    `).bind(attachmentId, tenantId).first();

    if (!attachment) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Attachment not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to this message (sender or recipient)
    if (attachment.SenderEmail !== userEmail && attachment.RecipientEmail !== userEmail) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: You can only remove attachments from messages you sent or received' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store attachment details for event broadcasting
    const attachmentDetails = {
      messageId: parseInt(attachment.MessageId as string),
      tenantId: attachment.TenantId as string,
      attachmentId: parseInt(attachmentId),
      fileName: attachment.FileName as string,
      fileSize: parseInt(attachment.FileSize as string),
      contentType: attachment.ContentType as string,
      attachmentType: attachment.AttachmentType as string,
      mediaId: parseInt(attachment.MediaFileId as string)
    };

    // Delete the attachment
    await db.prepare(`
      DELETE FROM MessageAttachments WHERE Id = ?
    `).bind(attachmentId).run();

    // Update message to reflect attachment status
    await db.prepare(`
      UPDATE Messages 
      SET HasAttachments = (
        SELECT COUNT(*) > 0 FROM MessageAttachments WHERE MessageId = ?
      ), AttachmentCount = (
        SELECT COUNT(*) FROM MessageAttachments WHERE MessageId = ?
      )
      WHERE Id = ?
    `).bind(attachment.MessageId, attachment.MessageId, attachment.MessageId).run();

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
    console.error('Attachment removal error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
