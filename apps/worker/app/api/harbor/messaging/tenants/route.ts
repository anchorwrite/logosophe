import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get user's tenant memberships from both TenantUsers and UserRoles tables
    const userTenantsQuery = `
      SELECT 
        tu.TenantId,
        t.Name as TenantName,
        tu.RoleId as UserRole
      FROM TenantUsers tu
      LEFT JOIN Tenants t ON tu.TenantId = t.Id
      WHERE tu.Email = ?
      UNION ALL
      SELECT 
        ur.TenantId,
        t.Name as TenantName,
        ur.RoleId as UserRole
      FROM UserRoles ur
      LEFT JOIN Tenants t ON ur.TenantId = t.Id
      WHERE ur.Email = ? AND ur.RoleId = 'subscriber'
    `;

    const userTenantsResult = await db.prepare(userTenantsQuery)
      .bind(session.user.email, session.user.email)
      .all() as any;

    if (!userTenantsResult?.results || userTenantsResult.results.length === 0) {
      return NextResponse.json({ error: 'User not found in any tenant' }, { status: 404 });
    }

    // Remove duplicates and organize by tenant
    const tenantMap = new Map();
    userTenantsResult.results.forEach((tenant: any) => {
      if (!tenantMap.has(tenant.TenantId)) {
        tenantMap.set(tenant.TenantId, {
          TenantId: tenant.TenantId,
          TenantName: tenant.TenantName || tenant.TenantId,
          UserRoles: []
        });
      }
      tenantMap.get(tenant.TenantId).UserRoles.push(tenant.UserRole);
    });

    const tenants = Array.from(tenantMap.values());

    return NextResponse.json({ 
      success: true, 
      tenants: tenants
    });

  } catch (error) {
    console.error('Error fetching user tenants:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
