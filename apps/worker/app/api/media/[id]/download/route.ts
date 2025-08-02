import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';

export const runtime = 'edge';

type Params = Promise<{ id: string }>

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id } = await params;

    // Check if user is a system admin
    const isAdmin = access.email ? await isSystemAdmin(access.email, db) : false;

    // Get the media file and verify tenant access
    const media = await db.prepare(`
      SELECT m.*, ma.TenantId
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      INNER JOIN TenantUsers tu ON ma.TenantId = tu.TenantId
      WHERE m.Id = ? AND (tu.Email = ? OR ? = true) AND m.IsDeleted = 0
    `).bind(id, access.email, isAdmin).first<{
      Id: string;
      FileName: string;
      FileSize: number;
      ContentType: string;
      R2Key: string;
      TenantId: string;
    }>();

    if (!media) {
      return new Response('Media file not found or access denied', { status: 404 });
    }

    // Log the download using SystemLogs
    const systemLogs = new SystemLogs(db);
    await systemLogs.logMediaAccess({
      userEmail: access.email,
      tenantId: media.TenantId,
      accessType: 'download',
      targetId: id,
      targetName: media.FileName,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    // Get the file from R2
    const file = await env.MEDIA_BUCKET.get(media.R2Key);
    if (!file) {
      return new Response('File not found in storage', { status: 404 });
    }

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', media.ContentType);
    headers.set('Content-Length', media.FileSize.toString());
    headers.set('Content-Disposition', `attachment; filename="${media.FileName}"`);

    return new Response(file.body, { headers });
  } catch (error) {
    return new Response('Internal server error', { status: 500 });
  }
} 