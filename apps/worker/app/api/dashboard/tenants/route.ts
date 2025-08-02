import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'You do not have permission to view tenants' }, { status: 403 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user is actually a global admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(access.email, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(access.email).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'You do not have permission to view tenants' }, { status: 403 });
    }

    let tenants;

    if (isGlobalAdmin) {
      // Global admins can see all tenants
      tenants = await db.prepare(`
        SELECT Id as id, Name as name
        FROM Tenants
        ORDER BY Name
      `).all() as { results: { id: string; name: string }[] };
    } else {
      // Tenant admins can only see their accessible tenants
      tenants = await db.prepare(`
        SELECT DISTINCT t.Id as id, t.Name as name
        FROM Tenants t
        JOIN TenantUsers tu ON t.Id = tu.TenantId
        WHERE tu.Email = ?
        ORDER BY t.Name
      `).bind(access.email).all() as { results: { id: string; name: string }[] };
    }

    return NextResponse.json({
      success: true,
      tenants: tenants.results || []
    });

  } catch (error) {
    console.error('Dashboard tenants error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 