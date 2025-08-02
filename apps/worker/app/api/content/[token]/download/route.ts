import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { token } = await params;

    // Get the published content by token
    const publishedContent = await db.prepare(`
      SELECT pc.*, m.FileName, m.ContentType, m.R2Key
      FROM PublishedContent pc
      INNER JOIN MediaFiles m ON pc.MediaId = m.Id
      WHERE pc.AccessToken = ?
    `).bind(token).first();

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
        const userAgent = request.headers.get('user-agent') || '';
        const ipAddress = request.headers.get('cf-connecting-ip') || 
                         request.headers.get('x-forwarded-for') || 
                         'unknown';
        
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