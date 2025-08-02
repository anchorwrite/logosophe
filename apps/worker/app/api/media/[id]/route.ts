import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';
import { SystemLogs } from '@/lib/system-logs';
import { isSystemAdmin } from '@/lib/access';


interface MediaFile {
  Id: string;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
  UploadDate: string;
  Description?: string;
  Duration?: number;
  Width?: number;
  Height?: number;
  TenantId: string;
  R2Key: string;
}

type Params = Promise<{ id: string }>

// Helper function to convert null to undefined
function getHeaderValue(header: Headers, key: string): string | undefined {
  const value = header.get(key);
  return value === null ? undefined : value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id } = await params;

    // Get the media file and verify tenant access
    const media = await db.prepare(`
      SELECT m.*, ma.TenantId
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      INNER JOIN TenantUsers tu ON ma.TenantId = tu.TenantId
      WHERE m.Id = ? AND tu.Email = ?
    `).bind(id, access.email).first<MediaFile>();

    if (!media) {
      return new Response('Media file not found or access denied', { status: 404 });
    }

    // Log the access using SystemLogs
    const systemLogs = new SystemLogs(db);
    await systemLogs.logMediaAccess({
      userEmail: access.email,
      tenantId: media.TenantId,
      accessType: 'view',
      targetId: id,
      targetName: media.FileName,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    return Response.json(media);
  } catch (error) {
    return new Response('Internal server error', { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id: mediaId } = await params;

    // Check if user is a system admin
    const isAdmin = await isSystemAdmin(access.email, db);

    // Get the media file and verify access
    const mediaFile = isAdmin ? 
      // For admin users, just check if the file exists
      await db.prepare(`
        SELECT FileName, R2Key FROM MediaFiles WHERE Id = ?
      `).bind(mediaId).first<{ FileName: string; R2Key: string }>() :
      // For non-admin users, verify tenant access
      await db.prepare(`
        SELECT m.FileName, m.R2Key
        FROM MediaFiles m
        INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
        INNER JOIN TenantUsers tu ON ma.TenantId = tu.TenantId
        WHERE m.Id = ? AND tu.Email = ?
      `).bind(mediaId, access.email).first<{ FileName: string; R2Key: string }>();

    if (!mediaFile) {
      return new Response('Media file not found or access denied', { status: 404 });
    }

    // Soft delete the file instead of hard delete
    await db.prepare(`
      UPDATE MediaFiles 
      SET IsDeleted = 1, 
          DeletedAt = datetime('now'), 
          DeletedBy = ?
      WHERE Id = ?
    `).bind(access.email, mediaId).run();

    // Delete any share links for this file
    await db.prepare(`
      DELETE FROM MediaShareLinks 
      WHERE MediaId = ?
    `).bind(mediaId).run();

    // Delete from MediaAccess
    await db.prepare(`
      DELETE FROM MediaAccess 
      WHERE MediaId = ?
    `).bind(mediaId).run();

    // Log the soft deletion using SystemLogs
    const systemLogs = new SystemLogs(db);
    await systemLogs.logMediaAccess({
      userEmail: access.email,
      tenantId: isAdmin ? 'system_admin' : access.email,
      accessType: 'soft_delete',
      targetId: mediaId,
      targetName: mediaFile.FileName,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        softDeleted: true,
        r2Key: mediaFile.R2Key,
        canBeRestored: true
      }
    });

    // Note: File remains in R2 storage for potential restoration

    return new Response('File deleted successfully');
  } catch (error) {
    console.error('Error deleting media file:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 