import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';
import { SystemLogs } from '@/lib/system-logs';

export const runtime = 'edge';

type Params = Promise<{ id: string }>

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id } = await params;

    // Get the avatar
    const avatar = await db.prepare(`
      SELECT * FROM UserAvatars WHERE Id = ?
    `).bind(id).first();

    if (!avatar) {
      return new Response('Avatar not found', { status: 404 });
    }

    // Check if user has access to this avatar
    // Allow access if:
    // 1. It's a preset avatar
    // 2. It belongs to the user
    // 3. The user is in the same tenant as the avatar owner
    if (!avatar.IsPreset && avatar.UserId !== session.user.id) {
      // Check if users are in the same tenant
      const sameTenant = await db.prepare(`
        SELECT 1 FROM TenantUsers tu1
        JOIN TenantUsers tu2 ON tu1.TenantId = tu2.TenantId
        WHERE tu1.Email = ? AND tu2.Email = (
          SELECT email FROM users WHERE id = ?
        )
      `).bind(session.user.email, avatar.UserId).first();

      if (!sameTenant) {
        return new Response('Access denied', { status: 403 });
      }
    }

    // Get the image from R2
    const r2Key = avatar.R2Key as string;
    const object = await env.MEDIA_BUCKET.get(r2Key);

    if (!object) {
      return new Response('Avatar image not found', { status: 404 });
    }

    // Log the access
    // const systemLogs = new SystemLogs(db);
    // const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    // await systemLogs.createLog({
    //   logType: 'MAIN_ACCESS',
    //   timestamp: new Date().toISOString(),
    //   userEmail: session.user.email || undefined,
    //   accessType: 'view_avatar',
    //   targetId: id,
    //   targetName: avatar.R2Key as string,
    //   ipAddress: ipAddress || undefined,
    //   userAgent: request.headers.get('user-agent') || undefined,
    //   metadata: {
    //     avatarId: id,
    //     userId: session.user.id,
    //     r2Key: avatar.R2Key
    //   }
    // });

    // Create a new ReadableStream from the R2 object's body
    const stream = object.body;
    if (!stream) {
      return new Response('No image data found', { status: 404 });
    }

    // Set up response headers
    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    if (object.httpEtag) {
      headers.set('ETag', object.httpEtag);
    }

    // Return the stream directly
    return new Response(stream, { headers });
  } catch (error) {
    console.error('Error fetching avatar:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 