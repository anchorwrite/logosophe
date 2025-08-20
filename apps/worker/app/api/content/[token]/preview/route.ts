import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';

interface PublishedContent {
  Id: string;
  MediaId: string;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: string;
  R2Key: string;
  TenantId?: string;
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Fetch published content by token with tenant information
    const publishedContent = await db.prepare(`
      SELECT pc.Id, pc.MediaId, pc.PublisherId, pc.PublishedAt, pc.PublishingSettings, pc.AccessToken,
             mf.FileName, mf.FileSize, mf.ContentType, mf.MediaType, mf.R2Key, ma.TenantId
      FROM PublishedContent pc
      JOIN MediaFiles mf ON pc.MediaId = mf.Id
      LEFT JOIN MediaAccess ma ON mf.Id = ma.MediaId
      WHERE pc.AccessToken = ?
    `).bind(token).first() as PublishedContent;

    if (!publishedContent) {
      return new Response('Content not found or invalid token', { status: 404 });
    }

    // Log the view for analytics (unless noLog parameter is present)
    const url = new URL(request.url);
    const noLog = url.searchParams.get('noLog');
    
    if (!noLog) {
      try {
        const { ipAddress, userAgent } = extractRequestContext(request);
        const normalizedLogging = new NormalizedLogging(db);
        
        // Log to NormalizedLogging for user engagement tracking
        await normalizedLogging.logMediaOperations({
          userEmail: 'anonymous', // Content previews are typically anonymous
          tenantId: publishedContent.TenantId || 'unknown',
          activityType: 'preview_content',
          accessType: 'read',
          targetId: publishedContent.Id.toString(),
          targetName: publishedContent.FileName as string,
          ipAddress,
          userAgent,
          metadata: { 
            contentType: publishedContent.ContentType,
            fileSize: publishedContent.FileSize,
            mediaType: publishedContent.MediaType,
            accessToken: token,
            noLog: false
          }
        });
        
        // Also log to ContentUsage table for backward compatibility
        await db.prepare(`
          INSERT INTO ContentUsage (ContentId, UserEmail, UsageType, IpAddress, UserAgent, CreatedAt)
          VALUES (?, ?, 'view', ?, ?, datetime('now'))
        `).bind(publishedContent.Id, null, ipAddress, userAgent).run();
        
        console.log('Successfully logged view for content:', publishedContent.Id);
      } catch (error) {
        console.error('Error logging content view:', error);
        // Don't fail the request if logging fails
      }
    } else {
      console.log('Skipping view logging due to noLog parameter');
    }

    // Fetch the file from R2
    const object = await env.MEDIA_BUCKET.get(publishedContent.R2Key as string);
    if (!object) {
      return new Response('File not found in storage', { status: 404 });
    }

    // Return the file with proper Content-Type header for browser display
    return new Response(object.body, {
      headers: {
        'Content-Type': publishedContent.ContentType as string,
        'Content-Length': (publishedContent.FileSize as number).toString(),
        'Content-Disposition': `inline; filename="${publishedContent.FileName as string}"`,
      },
    });
  } catch (error) {
    console.error('Error serving content preview:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 