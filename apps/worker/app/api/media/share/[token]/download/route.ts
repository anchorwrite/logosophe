import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SystemLogs } from '@/lib/system-logs';

export const runtime = 'edge';

interface ShareLink {
  Id: string;
  MediaId: string;
  ShareToken: string;
  ExpiresAt: string;
  MaxAccesses: number;
  CreatedAt: string;
  CreatedBy: string;
  TenantId: string;
  AccessCount: number;
}

interface MediaFile {
  Id: string;
  FileName: string;
  MimeType: string;
  R2Key: string;
  FileSize: number;
  ContentType: string;
  MediaType: string;
  UploadDate: string;
  Description: string;
  Duration: number;
  Width: number;
  Height: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const r2 = env.MEDIA_BUCKET;
    const { token } = await params;

    // Get the share link
    const shareLink = await db.prepare(`
      SELECT * FROM MediaShareLinks 
      WHERE ShareToken = ? 
      AND (ExpiresAt IS NULL OR ExpiresAt > datetime('now'))
      AND (MaxAccesses IS NULL OR AccessCount < MaxAccesses)
    `).bind(token).first<ShareLink>();

    if (!shareLink) {
      return new Response('Share link not found or expired', { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Get the media file
    const media = await db.prepare(`
      SELECT m.*, ma.TenantId
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      WHERE m.Id = ?
    `).bind(shareLink.MediaId).first<MediaFile>();

    if (!media) {
      return new Response('Media not found', { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Get the file from R2
    const object = await r2.get(media.R2Key);
    if (!object) {
      return new Response('File not found in storage', { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Increment the access count
    await db.prepare(
      'UPDATE MediaShareLinks SET AccessCount = AccessCount + 1 WHERE Id = ?'
    ).bind(shareLink.Id).run();

    // Log the access using SystemLogs
    const systemLogs = new SystemLogs(db);
    await systemLogs.logMediaAccess({
      userEmail: 'shared_access',
      tenantId: shareLink.TenantId,
      accessType: 'download',
      targetId: media.Id,
      targetName: media.FileName,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        shareToken: token,
        contentType: media.ContentType,
        fileSize: media.FileSize,
        mediaType: media.MediaType
      }
    });

    // Return the file
    return new Response(object.body, {
      headers: {
        'Content-Type': media.ContentType,
        'Content-Disposition': `attachment; filename="${media.FileName}"`,
        'Content-Length': object.size.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error downloading shared media:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 