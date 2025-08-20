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

    // Get query parameters for tenant filtering
    const { searchParams } = new URL(request.url);
    const selectedTenants = searchParams.get('tenants')?.split(',').filter(Boolean) || [];

    // Get user's tenant
    const userTenantQuery = `
      SELECT tu.TenantId
      FROM TenantUsers tu
      WHERE tu.Email = ?
      UNION ALL
      SELECT ur.TenantId
      FROM UserRoles ur
      WHERE ur.Email = ? AND ur.RoleId = 'subscriber'
    `;

    const userTenantResult = await db.prepare(userTenantQuery)
      .bind(session.user.email, session.user.email)
      .first() as any;

    if (!userTenantResult?.TenantId) {
      return NextResponse.json({ error: 'User not found in any tenant' }, { status: 404 });
    }

    const userTenantId = userTenantResult.TenantId;

    // If no specific tenants selected, use user's tenant
    const targetTenants = selectedTenants.length > 0 ? selectedTenants : [userTenantId];

    // Get available roles and recipients for selected tenants
    // Exclude users with only "user" role (they're not subscribers)
    const recipientsQuery = `
      SELECT 
        tu.Email,
        s.Name,
        tu.TenantId,
        tu.RoleId,
        t.Name as TenantName,
        FALSE as IsOnline,
        CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email AND s.Active = TRUE
      LEFT JOIN Tenants t ON tu.TenantId = t.Id
      LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.BlockerTenantId AND ub.IsActive = TRUE
      WHERE tu.TenantId IN (${targetTenants.map(() => '?').join(',')})
      AND s.Active = TRUE AND s.Banned = FALSE
      AND tu.Email != ?
      AND tu.RoleId != 'user'  -- Exclude users with only "user" role
      ORDER BY tu.TenantId, tu.RoleId, s.Name, tu.Email
    `;

    const recipientsResult = await db.prepare(recipientsQuery)
      .bind(...targetTenants, session.user.email)
      .all() as any;

    const recipients = recipientsResult.results || [];

    // Get role summary for selected tenants
    const rolesQuery = `
      SELECT 
        tu.RoleId,
        COUNT(DISTINCT tu.Email) as UserCount
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email AND s.Active = TRUE
      WHERE tu.TenantId IN (${targetTenants.map(() => '?').join(',')})
      AND s.Active = TRUE AND s.Banned = FALSE
      AND tu.Email != ?
      AND tu.RoleId != 'user'
      GROUP BY tu.RoleId
      ORDER BY tu.RoleId
    `;

    const rolesResult = await db.prepare(rolesQuery)
      .bind(...targetTenants, session.user.email)
      .all() as any;

    const roles = rolesResult.results || [];

    return NextResponse.json({ 
      success: true, 
      recipients: recipients.map((recipient: any) => ({
        Email: recipient.Email,
        Name: recipient.Name,
        TenantId: recipient.TenantId,
        TenantName: recipient.TenantName,
        RoleId: recipient.RoleId,
        IsBlocked: recipient.IsBlocked
      })),
      roles: roles.map((role: any) => ({
        RoleId: role.RoleId,
        UserCount: role.UserCount
      })),
      selectedTenants: targetTenants
    });

  } catch (error) {
    console.error('Error fetching recipients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
