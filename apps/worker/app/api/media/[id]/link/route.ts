import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { config } from '@/lib/config';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { encrypt } from '@/lib/encryption';


interface LinkRequest {
  expiresIn: number | null;
  maxAccesses: number | null;
  password?: string;
}

interface MediaFile {
  FileName: string;
  TenantId?: string;
}

export async function POST(
  request: NextRequest,
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
    const { id: mediaId } = await params;

    // Check if user is a system admin
    const isAdmin = await isSystemAdmin(access.email, db);

    // Get the media file and verify access
    const media = isAdmin ? 
      // For admin users, just check if the file exists
      await db.prepare(`
        SELECT m.*
        FROM MediaFiles m
        WHERE m.Id = ? AND m.IsDeleted = 0
      `).bind(mediaId).first<MediaFile>() :
      // For non-admin users, verify tenant access
      await db.prepare(`
        SELECT m.*, ma.TenantId
        FROM MediaFiles m
        INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
        WHERE m.Id = ? AND ma.TenantId IN (
          SELECT TenantId FROM TenantUsers WHERE Email = ?
        ) AND m.IsDeleted = 0
      `).bind(mediaId, access.email).first<MediaFile>();

    if (!media) {
      console.error('Media not found or access denied:', { mediaId, isAdmin, email: access.email });
      return new Response('Media not found or access denied', { status: 404 });
    }

    // For admin users, we don't need a tenant ID
    const tenantId = isAdmin ? null : media.TenantId;
    if (!isAdmin && !tenantId) {
      console.error('No tenant ID found for media:', { mediaId, media });
      return new Response('No tenant ID found for media', { status: 500 });
    }

    // Parse request body
    const body = await request.json() as LinkRequest;

    // Generate a unique share token
    const shareToken = crypto.randomUUID();
    const expiresAt = body.expiresIn 
      ? new Date(Date.now() + body.expiresIn * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Encrypt the password if provided
    let passwordHash = null;
    if (body.password) {
      try {
        passwordHash = await encrypt(body.password, shareToken);
      } catch (error) {
        console.error('Error encrypting password:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to encrypt password',
            details: error instanceof Error ? error.message : 'Unknown error'
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create share link in MediaShareLinks table and log the action
    try {
      console.log('Creating share link:', {
        mediaId,
        shareToken,
        createdBy: access.email,
        tenantId,
        expiresAt,
        maxAccesses: body.maxAccesses,
        hasPassword: !!body.password
      });

      const shareLinkResult = await db.prepare(`
        INSERT INTO MediaShareLinks (
          MediaId, ShareToken, CreatedBy, TenantId, ExpiresAt, MaxAccesses, AccessCount, PasswordHash
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).bind(
        mediaId,
        shareToken,
        access.email,
        tenantId,
        expiresAt,
        body.maxAccesses,
        passwordHash
      ).run();

      if (!shareLinkResult.meta.last_row_id) {
        throw new Error('Failed to insert share link');
      }

      console.log('Share link created successfully:', {
        shareLinkId: shareLinkResult.meta.last_row_id,
        mediaId,
        shareToken,
        hasPassword: !!body.password
      });

      // Log the share link creation using NormalizedLogging
      const normalizedLogging = new NormalizedLogging(db);
      const { ipAddress, userAgent } = extractRequestContext(request);
              await normalizedLogging.logMediaOperations({
          userEmail: isAdmin ? 'system_admin' : access.email,
          tenantId: tenantId || undefined,
          activityType: 'create_share_link',
          accessType: 'write',
          targetId: mediaId,
          targetName: media.FileName,
          ipAddress,
          userAgent
        });

      // Return the share URL
      const baseUrl = process.env.NODE_ENV === 'development' ? config.r2.publicUrl : request.nextUrl.origin;
      const shareUrl = `${baseUrl}/share/${shareToken}`;
      return Response.json({ shareUrl });
    } catch (error) {
      console.error('Error in share link creation or logging:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to create share link or log the action',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error creating share link:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 