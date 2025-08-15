import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
// Removed messaging events import - no longer needed

export async function POST(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    const r2 = context.env.MEDIA_BUCKET;
    
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
    
    const file = formData.get('file') as File;
    const tenantId = formData.get('tenantId') as string;
    const messageId = formData.get('messageId') as string;

    // Validate required fields
    if (!file || !tenantId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: file, tenantId' 
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

    // Validate file
    const maxFileSize = 50 * 1024 * 1024; // 50MB limit
    if (file.size > maxFileSize) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `File size exceeds limit of ${maxFileSize / (1024 * 1024)}MB` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-rar-compressed'
    ];

    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `File type ${file.type} is not allowed` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}_${randomId}.${fileExtension}`;
    const key = `messaging/${tenantId}/${fileName}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await r2.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type
      },
      customMetadata: {
        originalName: file.name,
        uploadedBy: userEmail,
        tenantId: tenantId,
        messageId: messageId || 'pending'
      }
    });

    // If this is for a specific message, add it as an attachment directly
    if (messageId) {
      await db.prepare(`
        INSERT INTO MessageAttachments (MessageId, MediaId, AttachmentType, FileName, FileSize, ContentType, R2Key, UploadDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        parseInt(messageId),
        null, // MediaId is no longer needed since we store file data directly
        'upload',
        file.name,
        file.size,
        file.type,
        key,
        new Date().toISOString()
      ).run();

      // Update message attachment count
      await db.prepare(`
        UPDATE Messages 
        SET HasAttachments = TRUE, AttachmentCount = AttachmentCount + 1
        WHERE Id = ?
      `).bind(parseInt(messageId)).run();

      // SSE events are now handled by the polling-based endpoint
      // No need to broadcast - clients will receive updates automatically
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        mediaFileId: null, // No longer using MediaFiles
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        key,
        messageId: messageId || null
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;
    const r2 = context.env.MEDIA_BUCKET;
    
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userEmail = session.user.email;
    const body = await request.json() as { mediaFileId: string };
    const { mediaFileId } = body;

    if (!mediaFileId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing mediaFileId' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get media file info
    const mediaFile = await db.prepare(`
      SELECT mf.*, ma.MessageId 
      FROM MediaFiles mf
      LEFT JOIN MessageAttachments ma ON mf.Id = ma.MediaId
      WHERE mf.Id = ?
    `).bind(mediaFileId).first();

    if (!mediaFile) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Media file not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has access to delete this file
    let hasAccess = false;
    
    // System admins can delete any file
    if (await isSystemAdmin(userEmail, db)) {
      hasAccess = true;
    } else {
      // Check if user is a tenant admin for this tenant
      if (await isTenantAdminFor(userEmail, mediaFile.TenantId as string)) {
        hasAccess = true;
      } else {
        // Check if user uploaded the file
        if (mediaFile.UploadedBy === userEmail) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: User does not have permission to delete this file' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete from R2
    try {
      await r2.delete(mediaFile.FileKey as string);
    } catch (error) {
      console.warn('Failed to delete from R2:', error);
      // Continue with database cleanup even if R2 deletion fails
    }

    // Delete from database (cascade will handle MessageAttachments)
    await db.prepare('DELETE FROM MediaFiles WHERE Id = ?').bind(mediaFileId).run();

    // Update message attachment count if this was attached to a message
    if (mediaFile.MessageId) {
      const attachmentCount = await db.prepare(`
        SELECT COUNT(*) as count FROM MessageAttachments WHERE MessageId = ?
      `).bind(mediaFile.MessageId).first();

      if (attachmentCount && typeof attachmentCount.count === 'number') {
        await db.prepare(`
          UPDATE Messages 
          SET HasAttachments = ?, AttachmentCount = ?
          WHERE Id = ?
        `).bind(
          attachmentCount.count > 0,
          attachmentCount.count
        ).bind(mediaFile.MessageId).run();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'File deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
