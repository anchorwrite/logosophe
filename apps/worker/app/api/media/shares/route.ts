import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    console.log('[shares/route.ts] Request received:', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check authentication
    console.log('[shares/route.ts] Checking authentication...');
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'editor', 'author']
    });

    if (!access.hasAccess) {
      console.log('[shares/route.ts] Access denied:', access);
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('[shares/route.ts] User authenticated:', access.email);

    // Check if user is an admin using the existing function
    const isAdmin = await isSystemAdmin(access.email!, db);
    console.log('[shares/route.ts] Is admin:', isAdmin);

    // Get all share links for the user's tenants
    console.log('[shares/route.ts] Fetching share links from database...');
    const query = isAdmin ? `
      SELECT 
        msl.Id,
        msl.MediaId,
        msl.ShareToken,
        msl.CreatedAt,
        msl.ExpiresAt,
        msl.MaxAccesses,
        msl.AccessCount,
        m.FileName as MediaFileName,
        m.ContentType,
        m.MediaType,
        m.FileSize,
        msl.TenantId,
        t.Name as TenantName
      FROM MediaShareLinks msl
      INNER JOIN MediaFiles m ON msl.MediaId = m.Id
      INNER JOIN Tenants t ON msl.TenantId = t.Id
      ORDER BY msl.CreatedAt DESC
    ` : `
      SELECT 
        msl.Id,
        msl.MediaId,
        msl.ShareToken,
        msl.CreatedAt,
        msl.ExpiresAt,
        msl.MaxAccesses,
        msl.AccessCount,
        m.FileName as MediaFileName,
        m.ContentType,
        m.MediaType,
        m.FileSize,
        msl.TenantId,
        t.Name as TenantName
      FROM MediaShareLinks msl
      INNER JOIN MediaFiles m ON msl.MediaId = m.Id
      INNER JOIN Tenants t ON msl.TenantId = t.Id
      INNER JOIN TenantUsers tu ON t.Id = tu.TenantId
      WHERE tu.Email = ?
      ORDER BY msl.CreatedAt DESC
    `;

    console.log('[shares/route.ts] Executing query:', {
      isAdmin,
      query,
      params: isAdmin ? [] : [access.email]
    });

    const shareLinks = await db.prepare(query)
      .bind(...(isAdmin ? [] : [access.email]))
      .all();

    console.log('[shares/route.ts] Query results:', {
      count: shareLinks.results?.length || 0,
      success: shareLinks.success,
      error: shareLinks.error
    });

    return new Response(JSON.stringify(shareLinks.results), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[shares/route.ts] Error fetching share links:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 