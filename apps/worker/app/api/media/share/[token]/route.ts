import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

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
  FileData: ArrayBuffer;
  FileSize: number;
  ContentType: string;
  MediaType: string;
  UploadDate: string;
  Description: string;
  Duration: number;
  Width: number;
  Height: number;
  PasswordHash?: string | null;
}

type Params = Promise<{ token: string }>

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
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
      SELECT m.*, ma.TenantId, msl.PasswordHash
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      INNER JOIN MediaShareLinks msl ON m.Id = msl.MediaId AND msl.ShareToken = ?
      WHERE m.Id = ?
    `).bind(token, shareLink.MediaId).first<MediaFile & { PasswordHash: string | null }>();

    console.log('Media data from database:', {
      id: media?.Id,
      fileName: media?.FileName,
      passwordHash: media?.PasswordHash
    });

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

    // Increment the access count
    await db.prepare(
      'UPDATE MediaShareLinks SET AccessCount = AccessCount + 1 WHERE Id = ?'
    ).bind(shareLink.Id).run();

    // Return the media metadata
    return Response.json({
      id: media.Id,
      fileName: media.FileName,
      fileSize: media.FileSize,
      contentType: media.ContentType,
      mediaType: media.MediaType,
      uploadDate: media.UploadDate,
      description: media.Description,
      duration: media.Duration,
      width: media.Width,
      height: media.Height,
      passwordHash: media.PasswordHash
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error accessing shared media:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 