import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';


type Params = Promise<{ id: string }>

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'editor', 'author']
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id: linkId } = await params;

    // Verify the user owns this share link
    const link = await db.prepare(`
      SELECT 1 FROM MediaShareLinks 
      WHERE Id = ? AND CreatedBy = ?
    `).bind(linkId, access.email).first();

    if (!link) {
      return new Response('Share link not found or access denied', { status: 404 });
    }

    // Delete the share link
    await db.prepare(`
      DELETE FROM MediaShareLinks 
      WHERE Id = ? AND CreatedBy = ?
    `).bind(linkId, access.email).run();

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting share link:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 