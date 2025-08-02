import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

interface PublishedContent {
  Id: string;
  MediaId: string;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
  UploadDate: string;
  Description?: string;
  Duration?: number;
  Width?: number;
  Height?: number;
  Language?: string;
  FormId?: string;
  GenreId?: string;
  FormName?: string;
  GenreName?: string;
  PublisherId: string;
  PublishedAt: string;
  PublishingSettings: string;
  AccessToken?: string;
}

interface MediaFile {
  Id: string;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: string;
  UploadDate: string;
  Description?: string;
  Duration?: number;
  Width?: number;
  Height?: number;
  Language?: string;
  R2Key: string;
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

    // Get the published content by token
    const publishedContent = await db.prepare(`
      SELECT pc.*, f.Name as FormName, g.Name as GenreName
      FROM PublishedContent pc
      LEFT JOIN Form f ON pc.FormId = f.Id
      LEFT JOIN Genre g ON pc.GenreId = g.Id
      WHERE pc.AccessToken = ?
    `).bind(token).first<PublishedContent>();

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

    // Get the media file
    const mediaFile = await db.prepare(`
      SELECT * FROM MediaFiles WHERE Id = ?
    `).bind(publishedContent.MediaId).first<MediaFile>();

    if (!mediaFile) {
      return new Response('Media file not found', { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Parse publishing settings
    let publishingSettings;
    try {
      publishingSettings = JSON.parse(publishedContent.PublishingSettings);
    } catch {
      publishingSettings = {};
    }

    // Log the view for analytics
    try {
      const userAgent = request.headers.get('user-agent') || '';
      const ipAddress = request.headers.get('cf-connecting-ip') || 
                       request.headers.get('x-forwarded-for') || 
                       'unknown';
      
      await db.prepare(`
        INSERT INTO ContentUsage (ContentId, UserEmail, UsageType, IpAddress, UserAgent)
        VALUES (?, ?, 'view', ?, ?)
      `).bind(publishedContent.Id, null, ipAddress, userAgent).run();
    } catch (error) {
      console.error('Error logging content view:', error);
      // Don't fail the request if logging fails
    }

    // Return the content data
    return Response.json({
      content: publishedContent,
      media: mediaFile,
      mediaUrl: `${process.env.CLOUDFLARE_WORKER_URL}/api/media/${publishedContent.MediaId}/download`,
      publishingSettings
    });

  } catch (error) {
    console.error('Error in content view API:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 