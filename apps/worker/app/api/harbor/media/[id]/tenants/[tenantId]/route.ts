import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { createMediaMetadata, MediaDeleteMetadata } from '@/lib/media-metadata';


type Params = Promise<{ id: string; tenantId: string }>

interface MediaFile {
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
  R2Key: string;
}

// Remove media from a specific tenant (harbor-specific)
export async function DELETE(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'editor', 'author', 'publisher']
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

    // Log the removal using NormalizedLogging with enhanced metadata
    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
    const removeMetadata = createMediaMetadata<MediaDeleteMetadata>({
      fileName: mediaFile.FileName,
      harborDelete: true,
      lastTenant: false,
      otherTenants: []
    }, 'remove_tenant', mediaId);

    await normalizedLogging.logMediaOperations({
      userEmail: access.email,
      tenantId,
      activityType: 'remove_tenant_access',
      accessType: 'delete',
      targetId: mediaId.toString(),
      targetName: mediaFile.FileName,
      ipAddress,
      userAgent,
      metadata: removeMetadata
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error removing media from tenant:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 