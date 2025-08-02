import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Fetch published content by token
    const publishedContent = await db.prepare(`
      SELECT pc.Id, pc.MediaId, pc.PublisherId, pc.PublishedAt, pc.PublishingSettings, pc.AccessToken,
             mf.FileName, mf.FileSize, mf.ContentType, mf.MediaType, mf.R2Key
      FROM PublishedContent pc
      JOIN MediaFiles mf ON pc.MediaId = mf.Id
      WHERE pc.AccessToken = ?
    `).bind(token).first();

    if (!publishedContent) {
      return new Response('Content not found or invalid token', { status: 404 });
    }

    // Log the view for analytics (unless noLog parameter is present)
    const url = new URL(request.url);
    const noLog = url.searchParams.get('noLog');
    
    console.log('Preview URL:', request.url);
    console.log('noLog parameter:', noLog);
    
    if (!noLog) {
      try {
        const userAgent = request.headers.get('user-agent') || '';
        const ipAddress = request.headers.get('cf-connecting-ip') || 
                         request.headers.get('x-forwarded-for') || 
                         'unknown';
        
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