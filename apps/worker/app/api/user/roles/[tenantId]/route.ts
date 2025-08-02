import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get user's roles in the specific tenant
    const userRoles = await db.prepare(`
      SELECT r.Id, r.Name
      FROM Roles r
      JOIN UserRoles ur ON r.Id = ur.RoleId
      JOIN TenantUsers tu ON ur.Email = tu.Email
      WHERE ur.Email = ? AND tu.TenantId = ?
    `).bind(access.email, tenantId).all() as any;

    const roles = userRoles.results?.map((role: any) => role.Id) || [];

    return NextResponse.json({
      success: true,
      roles,
      tenantId
    });

  } catch (error) {
    console.error('Error fetching user roles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 