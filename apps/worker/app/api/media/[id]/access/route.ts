import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';

export const runtime = 'edge';

type Params = Promise<{ id: string }>

interface AccessRequest {
  tenants: string[];
}

interface TenantUser {
  TenantId: string;
  RoleId: string;
}

interface MediaFile {
  FileName: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id: mediaId } = await params;

    // Get current tenant access
    const accessList = await db.prepare(`
      SELECT TenantId 
      FROM MediaAccess 
      WHERE MediaId = ?
    `).bind(mediaId).all();

    return NextResponse.json(accessList.results);
  } catch (error) {
    console.error('Error fetching tenant access:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id: mediaId } = await params;

    const body = await request.json() as AccessRequest;
    const { tenants } = body;

    if (!Array.isArray(tenants)) {
      return new NextResponse('Tenants must be an array', { status: 400 });
    }

    // Skip tenant access check for system admins
    const isAdmin = await isSystemAdmin(access.email, db);
    
    if (isAdmin) {
      // For global admins, we need to create MediaAccess entries with the admin role
      const mediaFile = await db.prepare(`
        SELECT FileName FROM MediaFiles WHERE Id = ?
      `).bind(mediaId).first<MediaFile>();

      if (!mediaFile) {
        return new NextResponse('Media file not found', { status: 404 });
      }

      // Remove all existing access
      await db.prepare(`
        DELETE FROM MediaAccess 
        WHERE MediaId = ?
      `).bind(mediaId).run();

      // Add new access entries with admin role
      for (const tenantId of tenants) {
        await db.prepare(`
          INSERT INTO MediaAccess (MediaId, TenantId, RoleId, AccessType, GrantedBy)
          VALUES (?, ?, 'admin', 'view', ?)
        `).bind(mediaId, tenantId, access.email).run();

        // Log the access change using SystemLogs
        const systemLogs = new SystemLogs(db);
        await systemLogs.createLog({
          logType: 'MEDIA_ACCESS',
          timestamp: new Date().toISOString(),
          userEmail: 'system_admin',
          tenantId,
          accessType: 'share',
          targetId: mediaId,
          targetName: mediaFile.FileName,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
      }

      return new NextResponse('Access updated successfully');
    }

    // For non-admin users, get their accessible tenants
    const userTenants = await db.prepare(`
      SELECT TenantId, RoleId 
      FROM TenantUsers 
      WHERE Email = ?
    `).bind(access.email).all<TenantUser>();

    if (!userTenants.results || userTenants.results.length === 0) {
      return new NextResponse('User does not have access to any tenants', { status: 403 });
    }

    // Filter the requested tenants to only include those the user has access to
    const accessibleTenants = new Set(userTenants.results.map(r => r.TenantId));
    const filteredTenants = tenants.filter(tenantId => accessibleTenants.has(tenantId));

    if (filteredTenants.length === 0) {
      return new NextResponse('User does not have access to any of the specified tenants', { status: 403 });
    }

    // Create a map of tenant IDs to role IDs
    const tenantRoleMap = new Map(
      userTenants.results.map(r => [r.TenantId, r.RoleId])
    );

    // Get the media file details for logging
    const mediaFile = await db.prepare(`
      SELECT FileName FROM MediaFiles WHERE Id = ?
    `).bind(mediaId).first<MediaFile>();

    if (!mediaFile) {
      return new NextResponse('Media file not found', { status: 404 });
    }

    // Get current tenant access for comparison
    const currentAccess = await db.prepare(`
      SELECT TenantId FROM MediaAccess WHERE MediaId = ?
    `).bind(mediaId).all<{ TenantId: string }>();

    const currentTenants = new Set(currentAccess.results.map(r => r.TenantId));
    const newTenants = new Set(filteredTenants);

    // Log deletions for tenants that are being removed
    const systemLogs = new SystemLogs(db);
    for (const tenantId of currentTenants) {
      if (!newTenants.has(tenantId)) {
        await systemLogs.logMediaAccess({
          userEmail: access.email,
          tenantId,
          accessType: 'delete',
          targetId: mediaId,
          targetName: mediaFile.FileName,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
      }
    }

    // Remove all existing access
    await db.prepare(`
      DELETE FROM MediaAccess 
      WHERE MediaId = ?
    `).bind(mediaId).run();

    // Add new access entries with role IDs and log changes
    for (const tenantId of filteredTenants) {
      const roleId = tenantRoleMap.get(tenantId);
      if (!roleId) {
        throw new Error(`No role found for tenant ${tenantId}`);
      }

      await db.prepare(`
        INSERT INTO MediaAccess (MediaId, TenantId, RoleId, AccessType, GrantedBy)
        VALUES (?, ?, ?, 'view', ?)
      `).bind(mediaId, tenantId, roleId, access.email).run();

      // Log the access change - only log if this is a new tenant
      if (!currentTenants.has(tenantId)) {
        await systemLogs.logMediaAccess({
          userEmail: access.email,
          tenantId,
          accessType: 'share',
          targetId: mediaId,
          targetName: mediaFile.FileName,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
      }
    }

    return new NextResponse('Access updated successfully');
  } catch (error) {
    console.error('Error updating tenant access:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 