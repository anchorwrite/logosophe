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

    // Get available users to block (excluding already blocked users and the current user)
    const recipientsQuery = `
      SELECT 
        tu.Email,
        s.Name,
        tu.TenantId,
        tu.RoleId,
        FALSE as IsOnline,
        CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email AND s.Active = TRUE
      LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
      LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.TenantId AND ub.IsActive = TRUE
      WHERE tu.TenantId = ?
      AND s.Active = TRUE AND s.Banned = FALSE
      AND tu.Email != ?
      AND ur.RoleId = 'subscriber'
      ORDER BY s.Name, tu.Email
    `;

    const recipientsResult = await db.prepare(recipientsQuery)
      .bind(userTenantId, session.user.email)
      .all() as any;

    const recipients = recipientsResult.results || [];

    return NextResponse.json({ 
      success: true, 
      recipients: recipients.map((recipient: any) => ({
        Email: recipient.Email,
        Name: recipient.Name,
        TenantId: recipient.TenantId,
        IsBlocked: recipient.IsBlocked
      }))
    });

  } catch (error) {
    console.error('Error fetching recipients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
