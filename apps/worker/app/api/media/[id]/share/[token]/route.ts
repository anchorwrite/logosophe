import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';

export const runtime = 'edge';

type Params = Promise<{ id: string; token: string }>

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id: mediaId, token } = await params;

    // Verify the share link is valid
    const shareLink = await db.prepare(`
      SELECT * FROM MediaShareLinks 
      WHERE MediaId = ? 
      AND ShareToken = ? 
      AND (ExpiresAt IS NULL OR ExpiresAt > datetime('now'))
      AND (MaxAccesses IS NULL OR AccessCount < MaxAccesses)
    `).bind(mediaId, token).first();

    if (!shareLink) {
      return new Response('Share link not found or expired', { status: 404 });
    }

    // Get the media file
    const media = await db.prepare(`
      SELECT * FROM MediaFiles 
      WHERE Id = ?
    `).bind(mediaId).first();

    if (!media) {
      return new Response('Media not found', { status: 404 });
    }

    // Increment access count
    await db.prepare(`
      UPDATE MediaShareLinks 
      SET AccessCount = AccessCount + 1 
      WHERE Id = ?
    `).bind(shareLink.Id).run();

    // Create a new URL for the preview
    const previewUrl = new URL(`/api/media/${mediaId}/preview`, request.nextUrl.origin);
    previewUrl.searchParams.set('shareToken', token);
    
    // Return a redirect response
    return new Response(null, {
      status: 302,
      headers: {
        'Location': previewUrl.toString()
      }
    });
  } catch (error) {
    console.error('Error accessing shared media:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 