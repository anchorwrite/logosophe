import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

interface PublishedContent {
  Id: string;
  MediaId: string;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: string;
  R2Key: string;
}

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
    `).bind(token).first() as PublishedContent;

    if (!publishedContent) {
      return new Response('Content not found or invalid token', { status: 404 });
    }

    // Only allow video files for streaming
    if (publishedContent.MediaType !== 'video') {
      return new Response('Only video files can be streamed', { status: 400 });
    }

    // Handle Range requests for video streaming
    const range = request.headers.get('range');
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : (publishedContent.FileSize as number) - 1;
      const chunksize = (end - start) + 1;
      
      // Get the specific range from R2
      const rangeObject = await env.MEDIA_BUCKET.get(publishedContent.R2Key as string, {
        range: { offset: start, length: chunksize }
      });
      
      if (!rangeObject) {
        return new Response('Range not satisfiable', { status: 416 });
      }

      const headers: Record<string, string> = {
        'Content-Range': `bytes ${start}-${end}/${publishedContent.FileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': publishedContent.ContentType as string,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Accept-Ranges, Content-Range',
        'Cache-Control': 'public, max-age=31536000',
      };

      return new Response(rangeObject.body, { 
        status: 206,
        headers 
      });
    }

    // If no range request, return the full file with streaming headers
    const object = await env.MEDIA_BUCKET.get(publishedContent.R2Key as string);
    if (!object) {
      return new Response('File not found in storage', { status: 404 });
    }

    const headers: Record<string, string> = {
      'Content-Type': publishedContent.ContentType as string,
      'Content-Length': (publishedContent.FileSize as number).toString(),
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Accept-Ranges, Content-Range',
      'Cache-Control': 'public, max-age=31536000',
    };

    return new Response(object.body, { headers });

  } catch (error) {
    console.error('Error in content stream API:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
