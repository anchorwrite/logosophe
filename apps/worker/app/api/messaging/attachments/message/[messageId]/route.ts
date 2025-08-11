import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
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
    const { messageId } = await params;
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

    // Verify message exists and user has access to it
    const message = await db.prepare(`
      SELECT m.*, mr.RecipientEmail 
      FROM Messages m
      LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId
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

    // Get attachments for this message
    const attachments = await db.prepare(`
      SELECT 
        ma.Id,
        ma.MessageId,
        ma.MediaFileId,
        ma.AttachmentType,
        ma.FileName,
        ma.FileSize,
        ma.ContentType,
        ma.CreatedAt,
        mf.FileKey,
        mf.MediaType,
        mf.CreatedBy
      FROM MessageAttachments ma
      INNER JOIN MediaFiles mf ON ma.MediaFileId = mf.Id
      WHERE ma.MessageId = ?
      ORDER BY ma.CreatedAt ASC
    `).bind(messageId).all();

    // Format attachments for response
    const formattedAttachments = attachments.results?.map(attachment => ({
      id: attachment.Id,
      messageId: attachment.MessageId,
      mediaFileId: attachment.MediaFileId,
      attachmentType: attachment.AttachmentType as string,
      fileName: attachment.FileName as string,
      fileSize: attachment.FileSize,
      contentType: attachment.ContentType as string,
      createdAt: attachment.CreatedAt,
      fileKey: attachment.FileKey as string,
      mediaType: attachment.MediaType as string,
      createdBy: attachment.CreatedBy as string,
      // Generate download URL (this would need to be implemented based on your storage system)
      downloadUrl: `/api/media/download/${attachment.MediaFileId}`,
      // Generate preview URL for supported file types
      previewUrl: (attachment.ContentType as string).startsWith('image/') ? 
        `/api/media/preview/${attachment.MediaFileId}` : null
    })) || [];

    return new Response(JSON.stringify({
      success: true,
      attachments: formattedAttachments,
      totalCount: formattedAttachments.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get attachments error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
