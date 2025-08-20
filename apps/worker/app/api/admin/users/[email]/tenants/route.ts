import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { D1Database } from '@cloudflare/workers-types';
import type { Session } from 'next-auth';


type TenantAssignmentRequest = {
  tenantIds: string[];
};

type TenantAssignmentResponse = {
  tenantId: string;
  tenantName: string;
  assigned: boolean;
};

async function checkAdminAccess(): Promise<{ db: D1Database; session: Session } | { error: string }> {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: 'Unauthorized' };
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const isAdmin = await isSystemAdmin(session.user.email, db);

  if (!isAdmin) {
    return { error: 'Forbidden' };
  }

  return { db, session };
}

// GET /api/admin/users/[email]/tenants - Get current tenant assignments
export async function GET(
  request: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params;
  const access = await checkAdminAccess();
  if ('error' in access) {
    return NextResponse.json({ message: access.error }, { status: 401 });
  }

  const { db } = access;

  try {
    const { email } = await params;

    // Check if user exists in Credentials
    const user = await db.prepare('SELECT * FROM Credentials WHERE Email = ?')
      .bind(email)
      .first();

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Get all available tenants
    const allTenants = await db.prepare(`
      SELECT Id, Name FROM Tenants ORDER BY Name ASC
    `).all() as D1Result<{ Id: string; Name: string }>;

    // Get current tenant assignments for this user
    const currentAssignments = await db.prepare(`
      SELECT TenantId FROM TenantUsers WHERE Email = ?
    `).bind(email).all() as D1Result<{ TenantId: string }>;

    const assignedTenantIds = new Set(
      currentAssignments.results?.map((r: any) => r.TenantId) || []
    );

    // Build response with assignment status
    const assignments: TenantAssignmentResponse[] = (allTenants.results || []).map((tenant: any) => ({
      tenantId: tenant.Id,
      tenantName: tenant.Name,
      assigned: assignedTenantIds.has(tenant.Id)
    }));

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('Error fetching tenant assignments:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/users/[email]/tenants - Update tenant assignments
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params;
  const access = await checkAdminAccess();
  if ('error' in access) {
    return NextResponse.json({ message: access.error }, { status: 401 });
  }

  const { db, session } = access;

  try {
    const { email } = await params;
    const { tenantIds } = await request.json() as TenantAssignmentRequest;

    // Check if user exists in Credentials
    const user = await db.prepare('SELECT * FROM Credentials WHERE Email = ?')
      .bind(email)
      .first();

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Only allow tenant assignments for users with 'tenant' role
    if (user.Role !== 'tenant') {
      return NextResponse.json({ 
        message: 'Tenant assignments are only allowed for users with tenant role' 
      }, { status: 400 });
    }

    // Validate that all tenant IDs exist
    if (tenantIds.length > 0) {
      const placeholders = tenantIds.map(() => '?').join(',');
      const existingTenants = await db.prepare(`
        SELECT Id FROM Tenants WHERE Id IN (${placeholders})
      `).bind(...tenantIds).all() as D1Result<{ Id: string }>;

      if (existingTenants.results?.length !== tenantIds.length) {
        return NextResponse.json({ message: 'One or more tenant IDs are invalid' }, { status: 400 });
      }
    }

    // Get current assignments
    const currentAssignments = await db.prepare(`
      SELECT TenantId FROM TenantUsers WHERE Email = ?
    `).bind(email).all() as D1Result<{ TenantId: string }>;

    const currentTenantIds = new Set(
      currentAssignments.results?.map((r: any) => r.TenantId) || []
    );

    const newTenantIds = new Set(tenantIds);

    // Calculate changes
    const tenantsToAdd = tenantIds.filter(id => !currentTenantIds.has(id));
    const tenantsToRemove = Array.from(currentTenantIds).filter(id => !newTenantIds.has(id));

    // Remove assignments that are no longer needed
    for (const tenantId of tenantsToRemove) {
      await db.prepare(`
        DELETE FROM TenantUsers WHERE Email = ? AND TenantId = ?
      `).bind(email, tenantId).run();

      // Also remove from UserRoles
      await db.prepare(`
        DELETE FROM UserRoles WHERE Email = ? AND TenantId = ?
      `).bind(email, tenantId).run();
    }

    // Add new assignments
    for (const tenantId of tenantsToAdd) {
      // Add to TenantUsers with 'tenant' role
      await db.prepare(`
        INSERT INTO TenantUsers (TenantId, Email, RoleId)
        VALUES (?, ?, 'tenant')
      `).bind(tenantId, email).run();

      // Add to UserRoles
      await db.prepare(`
        INSERT INTO UserRoles (TenantId, Email, RoleId)
        VALUES (?, ?, 'tenant')
      `).bind(tenantId, email).run();
    }

    // Log the activity
    const normalizedLogging = new NormalizedLogging(db);
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logUserManagement({
      userEmail: session.user.email || '',
      tenantId: 'system',
      activityType: 'update_tenant_assignments',
      accessType: 'admin',
      targetId: email,
      targetName: `Admin User ${email}`,
      ipAddress,
      userAgent,
      metadata: { 
        targetEmail: email, 
        addedTenants: tenantsToAdd,
        removedTenants: tenantsToRemove
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'Tenant assignments updated successfully',
      added: tenantsToAdd.length,
      removed: tenantsToRemove.length
    });
  } catch (error) {
    console.error('Error updating tenant assignments:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 