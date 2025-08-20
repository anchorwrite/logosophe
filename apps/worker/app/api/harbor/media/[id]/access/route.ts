import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { createMediaMetadata, MediaAccessMetadata } from '@/lib/media-metadata';


export async function GET(
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

    // Verify the media file belongs to the user
    const mediaFile = await db.prepare(`
      SELECT Id FROM MediaFiles 
      WHERE Id = ? AND UploadedBy = ?
    `).bind(id, access.email).first();

    if (!mediaFile) {
      return new Response('Media file not found', { status: 404 });
    }

    // Get current tenant access for this file
    const accessResult = await db.prepare(`
      SELECT TenantId FROM MediaAccess 
      WHERE MediaId = ?
    `).bind(id).all();

    // Log the access settings view with enhanced metadata
    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
    const viewMetadata = createMediaMetadata<MediaAccessMetadata>({
      currentTenants: accessResult.results?.map((r: any) => r.TenantId) || []
    }, 'view_access_settings', id);

    await normalizedLogging.logMediaOperations({
      userEmail: access.email,
      tenantId: 'harbor',
      activityType: 'view_access_settings',
      accessType: 'read',
      targetId: id.toString(),
      targetName: `Media file ${id}`,
      ipAddress,
      userAgent,
      metadata: viewMetadata
    });

    return Response.json(accessResult.results);
  } catch (error) {
    console.error('Error fetching media access:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

export async function PUT(
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

    // Verify the media file belongs to the user
    const mediaFile = await db.prepare(`
      SELECT Id FROM MediaFiles 
      WHERE Id = ? AND UploadedBy = ?
    `).bind(id, access.email).first();

    if (!mediaFile) {
      return new Response('Media file not found', { status: 404 });
    }

    const body = await request.json() as { tenants: string[] };
    const { tenants } = body;

    // Delete existing access records
    await db.prepare(`
      DELETE FROM MediaAccess WHERE MediaId = ?
    `).bind(id).run();

    // Insert new access records
    if (tenants && tenants.length > 0) {
      for (const tenantId of tenants) {
        await db.prepare(`
          INSERT INTO MediaAccess (MediaId, TenantId, RoleId, AccessType, GrantedBy)
          VALUES (?, ?, ?, ?, ?)
        `).bind(id, tenantId, 'tenant', 'view', access.email).run();
      }
    }

    // Log the access settings update with enhanced metadata
    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
    const updateMetadata = createMediaMetadata<MediaAccessMetadata>({
      newTenants: tenants || [],
      previousTenants: [] // Could be enhanced to track previous state
    }, 'update_access_settings', id);

    await normalizedLogging.logMediaOperations({
      userEmail: access.email,
      tenantId: 'harbor',
      activityType: 'update_access_settings',
      accessType: 'write',
      targetId: id.toString(),
      targetName: `Media file ${id}`,
      ipAddress,
      userAgent,
      metadata: updateMetadata
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating media access:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 