import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import { auth } from '@/auth';


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

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || 'https:/www.logosophe.com';
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 hours
      'Vary': 'Origin',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id: mediaId } = await params;
    const origin = request.headers.get('origin') || 'https:/www.logosophe.com';

    // Debug logging
    console.log('=== Media Preview Request Debug ===');
    console.log('Method:', request.method);
    console.log('Media ID:', mediaId);
    console.log('Headers:', {
      range: request.headers.get('range'),
      accept: request.headers.get('accept'),
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent')
    });
    console.log('URL Params:', {
      shareToken: request.nextUrl.searchParams.get('shareToken'),
      download: request.nextUrl.searchParams.get('download')
    });

    // Check if this is a shared access request
    const shareToken = request.nextUrl.searchParams.get('shareToken');
    let media: MediaFile | null = null;

    if (shareToken) {
      console.log('Processing shared access request');
      media = await db.prepare(`
        SELECT m.Id, m.FileName, m.FileSize, m.ContentType, m.MediaType, m.UploadDate, m.Description, m.Duration, m.Width, m.Height, m.R2Key, msl.TenantId
        FROM MediaFiles m
        INNER JOIN MediaShareLinks msl ON m.Id = msl.MediaId
        WHERE m.Id = ? AND msl.ShareToken = ? 
        AND (msl.ExpiresAt IS NULL OR msl.ExpiresAt > datetime('now'))
        AND (msl.MaxAccesses IS NULL OR msl.AccessCount < msl.MaxAccesses)
      `).bind(mediaId, shareToken).first<MediaFile>();

      if (!media) {
        console.log('Shared access: Media not found or access denied');
        // Check if the share link exists but has expired
        const expiredLink = await db.prepare(`
          SELECT ExpiresAt, MaxAccesses, AccessCount
          FROM MediaShareLinks
          WHERE MediaId = ? AND ShareToken = ?
        `).bind(mediaId, shareToken).first();
        
        if (expiredLink) {
          const expiresAt = expiredLink.ExpiresAt as string;
          const maxAccesses = expiredLink.MaxAccesses as number;
          const accessCount = expiredLink.AccessCount as number;
          
          if (new Date(expiresAt) < new Date()) {
            return new Response('Share link has expired', { status: 410 });
          }
          
          if (maxAccesses && accessCount >= maxAccesses) {
            return new Response('Share link has reached maximum access count', { status: 410 });
          }
        }
        
        // Check if the media file exists
        const mediaExists = await db.prepare(`
          SELECT 1 FROM MediaFiles WHERE Id = ?
        `).bind(mediaId).first();
        
        const headers = new Headers({
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        
        if (!mediaExists) {
          return new Response('Media file not found', { status: 404, headers });
        }
        
        return new Response('Invalid share link', { status: 404, headers });
      } else {
        console.log('Shared access: Media found', {
          id: media.Id,
          type: media.MediaType,
          contentType: media.ContentType
        });
        // Update access count
        await db.prepare(`
          UPDATE MediaShareLinks 
          SET AccessCount = AccessCount + 1 
          WHERE ShareToken = ?
        `).bind(shareToken).run();

        // Log shared access
        const systemLogs = new SystemLogs(db);
        await systemLogs.logMediaAccess({
          userEmail: 'shared_access',
          tenantId: media.TenantId,
          accessType: 'view',
          targetId: mediaId.toString(),
          targetName: media.FileName,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
          metadata: {
            shareToken,
            contentType: media.ContentType,
            fileSize: media.FileSize,
            mediaType: media.MediaType
          }
        });

        // Get the file from R2
        const object = await env.MEDIA_BUCKET.get(media.R2Key);
        if (!object) {
          console.log('File not found in R2 storage');
          return new Response('File not found in storage', { status: 404 });
        }

        // Set appropriate headers based on content type
        const headers = new Headers();
        
        // Handle video content type mapping
        let contentType = media.ContentType;
        if (media.ContentType === 'video/quicktime') {
          contentType = 'video/mp4'; // Map QuickTime to MP4 for better browser support
        }
        
        headers.set('Content-Type', contentType);
        headers.set('Content-Length', object.size.toString());
        
        // Check if this is a download request
        const isDownload = request.nextUrl.searchParams.get('download') === 'true';
        console.log('Request type:', isDownload ? 'download' : 'view');
        if (isDownload) {
          headers.set('Content-Disposition', `attachment; filename="${media.FileName}"`);
        } else {
          headers.set('Content-Disposition', `inline; filename="${media.FileName}"`);
        }
        
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept-Encoding');
        headers.set('Access-Control-Allow-Credentials', 'true');
        headers.set('Vary', 'Origin, Accept-Encoding');
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Cache-Control', 'public, max-age=31536000');

        // Handle range requests
        const range = request.headers.get('range');
        if (range && media.MediaType === 'video') {
          console.log('Processing video range request:', range);
          const [start, end] = range.replace('bytes=', '').split('-').map(Number);
          const chunkSize = (end || object.size) - start;
          
          headers.set('Content-Range', `bytes ${start}-${end || object.size - 1}/${object.size}`);
          headers.set('Content-Length', chunkSize.toString());
          
          // Create a new ReadableStream that only includes the requested range
          const stream = new ReadableStream({
            async start(controller) {
              const reader = object.body.getReader();
              let position = 0;
              let reading = true;
              
              while (reading) {
                const { done, value } = await reader.read();
                if (done) {
                  reading = false;
                  break;
                }
                
                if (position + value.length > start) {
                  const chunkStart = Math.max(0, start - position);
                  const chunkEnd = end ? Math.min(value.length, end - position + 1) : value.length;
                  controller.enqueue(value.slice(chunkStart, chunkEnd));
                }
                
                position += value.length;
                if (end && position > end) {
                  reading = false;
                  break;
                }
              }
              
              controller.close();
            }
          });

          return new Response(stream, {
            status: 206,
            headers,
          });
        }

        console.log('Returning full file response');
        return new Response(object.body, {
          headers,
        });
      }
    } else {
      console.log('Processing authenticated access request');
      const access = await checkAccess({
        requireAuth: true,
      });

      if (!access.hasAccess) {
        return new Response('Unauthorized', { status: 401 });
      }

      // Check if user is a system admin
      const isAdmin = access.email ? await isSystemAdmin(access.email, db) : false;

      // Check if user is a tenant admin
      const credentialsUser = await db.prepare(
        'SELECT Role FROM Credentials WHERE Email = ?'
      ).bind(access.email).first();
      const isTenantAdmin = credentialsUser?.Role === 'tenant';

      // Get the media file and verify tenant access
      if (isAdmin) {
        // For admin users, just check if the file exists
        media = await db.prepare(`
          SELECT m.Id, m.FileName, m.FileSize, m.ContentType, m.MediaType, m.UploadDate, m.Description, m.Duration, m.Width, m.Height, m.R2Key, ma.TenantId
          FROM MediaFiles m
          LEFT JOIN MediaAccess ma ON m.Id = ma.MediaId
          WHERE m.Id = ?
        `).bind(mediaId).first<MediaFile>();
      } else {
        // For regular users, check tenant access
        media = await db.prepare(`
          SELECT m.Id, m.FileName, m.FileSize, m.ContentType, m.MediaType, m.UploadDate, m.Description, m.Duration, m.Width, m.Height, m.R2Key, ma.TenantId
          FROM MediaFiles m
          INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
          INNER JOIN TenantUsers tu ON ma.TenantId = tu.TenantId
          WHERE m.Id = ? AND tu.Email = ?
          GROUP BY m.Id
        `).bind(mediaId, access.email).first<MediaFile>();
      }

      if (!media) {
        console.log('Authenticated access: Media not found or access denied');
        return new Response('Media file not found or access denied', { status: 404 });
      } else {
        console.log('Authenticated access: Media found', {
          id: media.Id,
          type: media.MediaType,
          contentType: media.ContentType
        });
      }

      // Initialize systemLogs
      const systemLogs = new SystemLogs(db);

      // Get the file from R2
      const object = await env.MEDIA_BUCKET.get(media.R2Key);
      if (!object) {
        console.log('File not found in R2 storage');
        return new Response('File not found in storage', { status: 404 });
      }

      // Set appropriate headers based on content type
      const headers = new Headers();
      
      // Handle video content type mapping
      let contentType = media.ContentType;
      if (media.ContentType === 'video/quicktime') {
        contentType = 'video/mp4'; // Map QuickTime to MP4 for better browser support
      }
      
      headers.set('Content-Type', contentType);
      headers.set('Content-Length', object.size.toString());
      
      // Check if this is a download request
      const isDownload = request.nextUrl.searchParams.get('download') === 'true';
      console.log('Request type:', isDownload ? 'download' : 'view');
      if (isDownload) {
        headers.set('Content-Disposition', `attachment; filename="${media.FileName}"`);
      } else {
        headers.set('Content-Disposition', `inline; filename="${media.FileName}"`);
      }
      
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept-Encoding');
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Vary', 'Origin, Accept-Encoding');
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=31536000');

      // Handle range requests
      const range = request.headers.get('range');
      if (range && media.MediaType === 'video') {
        console.log('Processing video range request:', range);
        const [start, end] = range.replace('bytes=', '').split('-').map(Number);
        const chunkSize = (end || object.size) - start;
        
        headers.set('Content-Range', `bytes ${start}-${end || object.size - 1}/${object.size}`);
        headers.set('Content-Length', chunkSize.toString());
        
        // Create a new ReadableStream that only includes the requested range
        const stream = new ReadableStream({
          async start(controller) {
            const reader = object.body.getReader();
            let position = 0;
            let reading = true;
            
            while (reading) {
              const { done, value } = await reader.read();
              if (done) {
                reading = false;
                break;
              }
              
              if (position + value.length > start) {
                const chunkStart = Math.max(0, start - position);
                const chunkEnd = end ? Math.min(value.length, end - position + 1) : value.length;
                controller.enqueue(value.slice(chunkStart, chunkEnd));
              }
              
              position += value.length;
              if (end && position > end) {
                reading = false;
                break;
              }
            }
            
            controller.close();
          }
        });

        // Only log if this is the first chunk (start = 0)
        if (start === 0) {
          const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;
          const userAgent = request.headers.get('user-agent') ?? undefined;
          const session = await auth();
          await systemLogs.createLog({
            logType: 'MEDIA_ACCESS',
            timestamp: new Date().toISOString(),
            userId: shareToken ? undefined : session?.user?.id,
            userEmail: shareToken ? 'shared_access' : access.email!,
            tenantId: media.TenantId,
            accessType: isDownload ? 'download' : 'view',
            targetId: mediaId.toString(),
            targetName: media.FileName,
            ipAddress,
            userAgent,
            activityType: 'media',
            provider: (isAdmin || isTenantAdmin) ? 'credentials' : 'tenant',
            metadata: {
              ...(shareToken ? { shareToken } : { isAdmin }),
              contentType: media.ContentType,
              fileSize: media.FileSize,
              mediaType: media.MediaType,
              isRangeRequest: true
            }
          });
        }
        
        return new Response(stream, {
          status: 206,
          headers,
        });
      }

      // For non-video files or non-range requests, log only if there's no range header
      if (!range) {
        const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;
        const userAgent = request.headers.get('user-agent') ?? undefined;
        const session = await auth();
        await systemLogs.createLog({
          logType: 'MEDIA_ACCESS',
          timestamp: new Date().toISOString(),
          userId: shareToken ? undefined : session?.user?.id,
          userEmail: shareToken ? 'shared_access' : access.email!,
          tenantId: media.TenantId,
          accessType: isDownload ? 'download' : 'view',
          targetId: mediaId.toString(),
          targetName: media.FileName,
          ipAddress,
          userAgent,
          activityType: 'media',
          provider: (isAdmin || isTenantAdmin) ? 'credentials' : 'tenant',
          metadata: {
            ...(shareToken ? { shareToken } : { isAdmin }),
            contentType: media.ContentType,
            fileSize: media.FileSize,
            mediaType: media.MediaType,
            isRangeRequest: false
          }
        });
      }

      console.log('Returning full file response');
      return new Response(object.body, {
        headers,
      });
    }
  } catch (error) {
    console.error('Error in media preview:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 