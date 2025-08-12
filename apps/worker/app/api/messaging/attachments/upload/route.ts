import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
// Removed messaging events import - no longer needed

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
    const formData = await request.formData();
    
    const messageId = formData.get('messageId') as string;
    const tenantId = formData.get('tenantId') as string;
    const file = formData.get('file') as File;
    
    // Validate required fields
    if (!messageId || !tenantId || !file) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: messageId, tenantId, file' 
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

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'File size exceeds maximum limit of 10MB' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate file type (basic check)
    const allowedTypes = [
      'image/', 'text/', 'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const isAllowedType = allowedTypes.some(type => file.type.startsWith(type));
    if (!isAllowedType) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'File type not allowed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert file to buffer for storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store file in MediaFiles table (using existing Harbor Media Library infrastructure)
    const mediaFileResult = await db.prepare(`
      INSERT INTO MediaFiles (FileName, FileSize, ContentType, MediaType, TenantId, CreatedBy, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      file.name,
      file.size,
      file.type,
      'document', // Default media type for uploaded files
      tenantId,
      userEmail
    ).run();

    const mediaFileId = mediaFileResult.meta.last_row_id;

    // Create message attachment record
    const attachmentResult = await db.prepare(`
      INSERT INTO MessageAttachments (MessageId, MediaFileId, AttachmentType, FileName, FileSize, ContentType, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      messageId,
      mediaFileId,
      'upload',
      file.name,
      file.size,
      file.type
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

    // SSE events are now handled by the polling-based endpoint
    // No need to broadcast - clients will receive updates automatically

    return new Response(JSON.stringify({
      success: true,
      attachmentId,
      mediaFileId,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('File upload error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
