import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';
import { nanoid } from 'nanoid';
import { isSystemAdmin } from '@/lib/access';
import { encrypt } from '@/lib/encryption';

export const runtime = 'edge';

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

    // Check if user is admin
    const isAdmin = await isSystemAdmin(access.email, db);

    // Get the media file and verify access
    const media = isAdmin ? 
      // For admin users, just check if the file exists
      await db.prepare(`
        SELECT m.*
        FROM MediaFiles m
        WHERE m.Id = ? AND m.IsDeleted = 0
      `).bind(id).first() :
      // For non-admin users, verify tenant access
      await db.prepare(`
        SELECT m.*, ma.TenantId
        FROM MediaFiles m
        INNER JOIN MediaAccess ma ON m.Id = ma.MediaId
        WHERE m.Id = ? AND ma.TenantId IN (
          SELECT TenantId FROM TenantUsers WHERE Email = ?
        ) AND m.IsDeleted = 0
      `).bind(id, access.email).first();

    if (!media) {
      return new Response('Media file not found or access denied', { status: 404 });
    }

    // For admin users, we don't need a tenant ID
    const tenantId = isAdmin ? null : media.TenantId;
    if (!isAdmin && !tenantId) {
      return new Response('No tenant ID found for media', { status: 500 });
    }

    const body = await request.json() as { 
      expiresIn?: number; 
      maxAccesses?: number; 
      password?: string; 
    };
    const { expiresIn, maxAccesses, password } = body;

    // Generate share token
    const shareToken = nanoid(32);

    // Calculate expiry date if provided
    let expiresAt = null;
    if (expiresIn && typeof expiresIn === 'number') {
      expiresAt = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString();
    }

    // Encrypt the password if provided
    let passwordHash = null;
    if (password) {
      try {
        passwordHash = await encrypt(password, shareToken);
      } catch (error) {
        console.error('Error encrypting password:', error);
        return new Response('Failed to encrypt password', { status: 500 });
      }
    }

    // Create share link record
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'https:/local-dev.logosophe.com' 
      : request.nextUrl.origin;
    const shareUrl = `${baseUrl}/share/${shareToken}`;

    // Insert the share link
    await db.prepare(`
      INSERT INTO MediaShareLinks (
        MediaId, ShareToken, CreatedBy, TenantId, 
        ExpiresAt, MaxAccesses, AccessCount, PasswordHash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      shareToken,
      access.email,
      tenantId,
      expiresAt,
      maxAccesses || null,
      0,
      passwordHash
    ).run();

    return Response.json({
      shareUrl: shareUrl
    });
  } catch (error) {
    console.error('Error creating share link:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 