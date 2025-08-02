import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { SystemLogs } from '@/lib/system-logs';

export const runtime = 'edge';

type Params = Promise<{ id: string; tenantId: string }>

interface MediaFile {
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
  R2Key: string;
}

// Remove media from a specific tenant
export async function DELETE(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'editor', 'author']
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id: mediaId, tenantId } = await context.params;

    // Verify user has access to the tenant
    const tenantAccess = await db.prepare(`
      SELECT 1 FROM TenantUsers
      WHERE Email = ? AND TenantId = ?
    `).bind(access.email, tenantId).first();

    if (!tenantAccess) {
      return new Response('Unauthorized', { status: 401 });
    }

    // First check if the media file exists
    const mediaFile = await db.prepare(`
      SELECT * FROM MediaFiles 
      WHERE Id = ?
    `).bind(mediaId).first<MediaFile>();

    if (!mediaFile) {
      return new Response('Media file not found', { status: 404 });
    }

    // Delete the media access record
    const deleteResult = await db.prepare(`
      DELETE FROM MediaAccess
      WHERE MediaId = ? AND TenantId = ?
    `).bind(mediaId, tenantId).run();

    if (deleteResult.meta.changes === 0) {
      return new Response('No media access record found', { status: 404 });
    }

    // Log the removal using SystemLogs
    const systemLogs = new SystemLogs(db);
    await systemLogs.logMediaAccess({
      userEmail: access.email,
      tenantId,
      accessType: 'remove_tenant',
      targetId: mediaId,
      targetName: mediaFile.FileName,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error removing media from tenant:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Add media to a specific tenant
export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'editor', 'author']
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id: mediaId, tenantId } = await params;

    // Verify user has access to the tenant
    const tenantAccess = await db.prepare(`
      SELECT 1 FROM TenantUsers 
      WHERE Email = ? AND TenantId = ?
    `).bind(access.email, tenantId).first();

    if (!tenantAccess) {
      return new Response('You do not have access to this tenant', { status: 403 });
    }

    // Get the original media file details
    const originalMedia = await db.prepare(`
      SELECT * FROM MediaFiles 
      WHERE Id = ?
    `).bind(mediaId).first<MediaFile>();

    if (!originalMedia) {
      return new Response('Media file not found', { status: 404 });
    }

    // Check if media already exists for this tenant
    const existingMedia = await db.prepare(`
      SELECT 1 FROM MediaFiles 
      WHERE R2Key = ? AND TenantId = ?
    `).bind(originalMedia.R2Key, tenantId).first();

    if (existingMedia) {
      return new Response('Media already exists for this tenant', { status: 409 });
    }

    // Create a new media file record for this tenant
    const insertResult = await db.prepare(`
      INSERT INTO MediaFiles (
        FileName, FileSize, ContentType, MediaType,
        UploadedBy, TenantId, R2Key, UploadDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      originalMedia.FileName,
      originalMedia.FileSize,
      originalMedia.ContentType,
      originalMedia.MediaType,
      access.email,
      tenantId,
      originalMedia.R2Key
    ).run();

    // Log the addition using SystemLogs
    const systemLogs = new SystemLogs(db);
    await systemLogs.logMediaAccess({
      userEmail: access.email,
      tenantId,
      accessType: 'add_tenant',
      targetId: mediaId,
      targetName: originalMedia.FileName,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    return new Response(null, { status: 201 });
  } catch (error) {
    console.error('Error adding media to tenant:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 