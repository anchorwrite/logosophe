import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';


interface PublishedContent {
  Id: string;
  MediaId: string;
  TenantId: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get the published content by token with tenant information
    const publishedContent = await db.prepare(`
      SELECT pc.*, m.FileName, m.ContentType, m.R2Key, m.FileSize, ma.TenantId
      FROM PublishedContent pc
      INNER JOIN MediaFiles m ON pc.MediaId = m.Id
      LEFT JOIN MediaAccess ma ON m.Id = ma.MediaId
      WHERE pc.AccessToken = ?
      LIMIT 1
    `).bind(token).first() as PublishedContent;

    if (!publishedContent) {
      return new Response('Content not found or invalid token', { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Get the media file from the database
    const mediaFile = await db.prepare(`
      SELECT * FROM MediaFiles WHERE Id = ?
    `).bind(publishedContent.MediaId).first() as any;

    if (!mediaFile) {
      return new Response('Media file not found', { status: 404 });
    }

    // Log the download for analytics (unless noLog parameter is present)
    const url = new URL(request.url);
    const noLog = url.searchParams.get('noLog');
    
    if (!noLog) {
      try {
        const { ipAddress, userAgent } = extractRequestContext(request);
        const normalizedLogging = new NormalizedLogging(db);
        
        // Log to NormalizedLogging for user engagement tracking
        await normalizedLogging.logMediaOperations({
          userEmail: 'anonymous', // Content downloads are typically anonymous
          tenantId: publishedContent.TenantId || 'unknown',
          activityType: 'download_content',
          accessType: 'read',
          targetId: publishedContent.Id.toString(),
          targetName: mediaFile.FileName,
          ipAddress,
          userAgent,
          metadata: { 
            contentType: mediaFile.ContentType,
            fileSize: mediaFile.FileSize,
            accessToken: token,
            noLog: false
          }
        });
        
        // Also log to ContentUsage table for backward compatibility
        await db.prepare(`
          INSERT INTO ContentUsage (ContentId, UserEmail, UsageType, IpAddress, UserAgent)
          VALUES (?, ?, 'download', ?, ?)
        `).bind(publishedContent.Id, null, ipAddress, userAgent).run();
      } catch (error) {
        console.error('Error logging content download:', error);
        // Don't fail the request if logging fails
      }
    } else {
      console.log('Skipping download logging due to noLog parameter');
    }

    // Get the file from R2 storage
    const object = await env.MEDIA_BUCKET.get(mediaFile.R2Key);
    if (!object) {
      return new Response('File not found in storage', { status: 404 });
    }

    // Return the file data from R2
    return new Response(object.body, {
      headers: {
        'Content-Type': mediaFile.ContentType,
        'Content-Disposition': `attachment; filename="${mediaFile.FileName}"`,
        'Content-Length': object.size.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Error in content download API:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 