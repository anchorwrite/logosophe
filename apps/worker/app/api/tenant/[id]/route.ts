import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from "@/lib/access-control";
import { auth } from '@/auth';
import { isSystemAdmin } from '@/lib/access';
import { getDB } from '@/lib/request-context';
import { v4 as uuidv4 } from 'uuid';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';


interface TenantUpdateRequest {
  name: string;
  description?: string;
}

type Params = Promise<{ id: string }>;

// GET /api/tenant/[id] - Get tenant details
export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id } = await params;

    // Check if user is a system admin
    const isAdmin = access.email ? await isSystemAdmin(access.email, db) : false;

    let tenant;
    if (isAdmin) {
      // System admins can access any tenant
      tenant = await db.prepare(`
        SELECT Id, Name, Description, CreatedAt, UpdatedAt
        FROM Tenants
        WHERE Id = ?
      `).bind(id).first();
    } else {
      // Tenant users can only access tenants they belong to
      tenant = await db.prepare(`
        SELECT t.Id, t.Name, t.Description, t.CreatedAt, t.UpdatedAt
        FROM Tenants t
        JOIN TenantUsers tu ON t.Id = tu.TenantId
        WHERE t.Id = ? AND tu.Email = ?
      `).bind(id, access.email).first();
    }

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/tenant/[id] - Update tenant
export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { env } = await getCloudflareContext({async: true});
  if (!await isSystemAdmin(session.user.email, env.DB)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { name, description } = await request.json() as TenantUpdateRequest;

    // Check if tenant exists
    const tenant = await env.DB.prepare(`
      SELECT Id FROM Tenants WHERE Id = ?
    `).bind(id).first();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Update tenant
    await env.DB.prepare(`
      UPDATE Tenants 
      SET Name = ?, Description = ?, UpdatedAt = datetime('now')
      WHERE Id = ?
    `).bind(name, description, id).run();

    // Log the activity using NormalizedLogging
    const normalizedLogging = new NormalizedLogging(env.DB);
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logUserManagement({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'update_tenant',
      accessType: 'admin',
      targetId: id,
      targetName: name,
      ipAddress,
      userAgent,
      metadata: {
        email: session.user.email,
        tenantId: id,
        tenantName: name,
        provider: 'credentials',
        userId: session.user.id
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error updating tenant:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/tenant/[id] - Delete tenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { env } = await getCloudflareContext({async: true});
  if (!await isSystemAdmin(session.user.email, env.DB)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Check if tenant exists
    const tenant = await env.DB.prepare(`
      SELECT Id, Name FROM Tenants WHERE Id = ?
    `).bind(id).first() as { Id: string; Name: string } | null;

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Delete related records first to handle foreign key constraints
    // Delete from TenantResources
    await env.DB.prepare(`
      DELETE FROM TenantResources WHERE TenantId = ?
    `).bind(id).run();

    // Delete from TenantUsers
    await env.DB.prepare(`
      DELETE FROM TenantUsers WHERE TenantId = ?
    `).bind(id).run();

    // Delete from UserRoles (if it has TenantId column)
    await env.DB.prepare(`
      DELETE FROM UserRoles WHERE TenantId = ?
    `).bind(id).run();

    // Delete from MediaAccess
    await env.DB.prepare(`
      DELETE FROM MediaAccess WHERE TenantId = ?
    `).bind(id).run();

    // Delete from MediaShareLinks
    await env.DB.prepare(`
      DELETE FROM MediaShareLinks WHERE TenantId = ?
    `).bind(id).run();

    // Note: SystemLogs are intentionally NOT deleted to preserve audit trail
    // SystemLogs records with TenantId will remain for historical purposes

    // Finally delete the tenant
    await env.DB.prepare(`
      DELETE FROM Tenants WHERE Id = ?
    `).bind(id).run();

    // Log the activity using NormalizedLogging
    const normalizedLogging = new NormalizedLogging(env.DB);
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logUserManagement({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'delete_tenant',
      accessType: 'admin',
      targetId: id,
      targetName: tenant.Name,
      ipAddress,
      userAgent,
      metadata: {
        email: session.user.email,
        tenantId: id,
        tenantName: tenant.Name,
        provider: 'credentials',
        userId: session.user.id
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 