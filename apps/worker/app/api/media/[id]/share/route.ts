import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { nanoid } from 'nanoid';
import { checkAccess } from '@/lib/access-control';
import { config } from '@/lib/config';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';


interface ShareLinkRequest {
  expiresIn: number;
  maxAccesses: number;
  password?: string;
}

interface ShareLink {
  Id: string;
  MediaId: string;
  ShareToken: string;
  ExpiresAt: string;
  MaxAccesses: number;
  CreatedAt: string;
  CreatedBy: string;
  TenantId: string;
  AccessCount: number;
}

interface MediaFile {
  Id: string;
  FileName: string;
  MimeType: string;
  FileData: ArrayBuffer;
  TenantId: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    const shareLinks = await db.prepare(
      'SELECT * FROM MediaShareLinks WHERE MediaId = ? AND CreatedBy = ?'
    ).bind(id, session.user.id).all<ShareLink>();

    return Response.json(shareLinks);
  } catch (error) {
    console.error('Error fetching share links:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

type Params = Promise<{ id: string }>

export async function POST(
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
    const { id: mediaId } = await params;

    // Get the media file and verify tenant access
    const media = await db.prepare(`
      SELECT m.*, ma.TenantId
      FROM MediaFiles m
      INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
      WHERE m.Id = ? AND ma.TenantId IN (
        SELECT TenantId FROM TenantUsers WHERE Email = ?
      ) AND m.IsDeleted = 0
    `).bind(mediaId, access.email).first<MediaFile>();

    if (!media) {
      return new Response('Media not found or access denied', { status: 404 });
    }

    // Use the tenant ID from the media access
    const tenantId = media.TenantId;

    // Parse request body
    const body = await request.json() as ShareLinkRequest;
    console.log('Share link request body:', JSON.stringify(body, null, 2));

    // Generate a unique share token
    const shareToken = crypto.randomUUID();
    const expiresAt = body.expiresIn 
      ? new Date(Date.now() + body.expiresIn * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Create share link in MediaShareLinks table
    try {
      const shareSql = `
        INSERT INTO MediaShareLinks (
          MediaId, ShareToken, CreatedBy, TenantId, ExpiresAt, MaxAccesses, AccessCount, PasswordHash
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `;
      const shareParams = [
        mediaId,
        shareToken,
        access.email,
        tenantId,
        expiresAt,
        body.maxAccesses,
        body.password || null
      ];
      
      console.log('Share link SQL:', shareSql);
      console.log('Share link params:', JSON.stringify(shareParams, null, 2));
      
      const result = await db.prepare(shareSql).bind(...shareParams).run();
      console.log('Share link insert result:', result);
    } catch (error) {
      console.error('Error creating share link:', error);
      const errorResponse = {
        error: 'Failed to create share link',
        details: {
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
      return new Response(
        JSON.stringify(errorResponse),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log the share action
    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
            await normalizedLogging.logMediaOperations({
          userEmail: access.email,
          tenantId: tenantId,
          activityType: 'create_share_link',
          accessType: 'write',
          targetId: mediaId.toString(),
          targetName: media.FileName,
          ipAddress,
          userAgent
        });

    // Return the share URL
    const baseUrl = process.env.NODE_ENV === 'development' ? config.r2.publicUrl : request.nextUrl.origin;
    const shareUrl = new URL('/share/' + shareToken, baseUrl).toString();
    return Response.json({ shareUrl });
  } catch (error) {
    console.error('Error creating share link:', error);
    return new Response('Internal server error', { status: 500 });
  }
}