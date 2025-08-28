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

    // For videos, return an HTML page with a video player
    if (publishedContent.MediaType === 'video') {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${publishedContent.FileName}</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: Arial, sans-serif;
        }
        .video-container {
            max-width: 100%;
            width: 100%;
            max-width: 1200px;
        }
        video {
            width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .title {
            color: white;
            text-align: center;
            margin-bottom: 20px;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div class="video-container">
        <div class="title">${publishedContent.FileName}</div>
        <video controls autoplay>
            <source src="/api/content/${token}/stream" type="${publishedContent.ContentType}">
            Your browser does not support the video tag.
        </video>
    </div>
</body>
</html>`;
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    // For images, return them directly with inline display
    if (publishedContent.MediaType === 'image') {
      const object = await env.MEDIA_BUCKET.get(publishedContent.R2Key as string);
      if (!object) {
        return new Response('Image not found in storage', { status: 404 });
      }

      return new Response(object.body, {
        headers: {
          'Content-Type': publishedContent.ContentType as string,
          'Content-Length': (publishedContent.FileSize as number).toString(),
          'Content-Disposition': `inline; filename="${publishedContent.FileName as string}"`,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    // For PDFs, return them with inline display
    if (publishedContent.ContentType?.includes('pdf')) {
      const object = await env.MEDIA_BUCKET.get(publishedContent.R2Key as string);
      if (!object) {
        return new Response('PDF not found in storage', { status: 404 });
      }

      return new Response(object.body, {
        headers: {
          'Content-Type': publishedContent.ContentType as string,
          'Content-Length': (publishedContent.FileSize as number).toString(),
          'Content-Disposition': `inline; filename="${publishedContent.FileName as string}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // For other file types, return them with inline display
    const object = await env.MEDIA_BUCKET.get(publishedContent.R2Key as string);
    if (!object) {
      return new Response('File not found in storage', { status: 404 });
    }

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