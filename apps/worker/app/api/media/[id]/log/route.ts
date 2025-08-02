import { NextRequest } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getRequestContext } from '@/lib/request-context';
import { SystemLogs } from '@/lib/system-logs';
import { NextResponse } from 'next/server';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from '@/auth';

interface Params {
  id: string;
}

interface LogRequest {
  fileName: string;
  tenantId: string;
  accessType: string;
}

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);
    const { id: mediaId } = await params;
    const body = await request.json() as LogRequest;

    // Verify the user has access to this media file
    const media = await db.prepare(`
      SELECT m.*, ma.TenantId
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      WHERE m.Id = ? AND ma.TenantId IN (
        SELECT TenantId FROM TenantUsers WHERE Email = ?
      )
    `).bind(mediaId, access.email).first();

    if (!media) {
      return new Response('Media not found or access denied', { status: 404 });
    }

    // Log the action using the new SystemLogs class
    await systemLogs.logMediaShare({
      userEmail: access.email,
      tenantId: body.tenantId,
      accessType: body.accessType,
      targetId: mediaId,
      targetName: body.fileName,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    return new Response('Logged successfully', { status: 200 });
  } catch (error) {
    console.error('Error logging media action:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 