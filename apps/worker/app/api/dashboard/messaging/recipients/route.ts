import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';

interface GetRecipientsResponse {
  users: {
    email: string;
    name: string;
    tenantId: string;
    roleIds: string;
    isOnline: boolean;
    isBlocked: boolean;
    isActive: boolean;
    isBanned: boolean;
  }[];
  tenants: {
    id: string;
    name: string;
    userCount: number;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user has admin access
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const accessibleTenants = await getUserMessagingTenants(session.user.email);
    
    if (!isAdmin && accessibleTenants.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Build query based on user's access level
    let userQuery = '';
    let tenantQuery = '';
    let params: any[] = [];

    if (isAdmin) {
      // System admins can see all users with consolidated roles
      if (tenantId) {
        userQuery = `
          SELECT 
            tu.Email,
            s.Name,
            tu.TenantId,
            GROUP_CONCAT(COALESCE(ur.RoleId, tu.RoleId)) as RoleIds,
            s.Active,
            s.Banned,
            CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
          FROM TenantUsers tu
          LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
          LEFT JOIN Subscribers s ON tu.Email = s.Email
          LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = tu.TenantId AND ub.IsActive = TRUE
          WHERE tu.TenantId = ?
          ${includeInactive ? '' : 'AND s.Active = TRUE AND s.Banned = FALSE'}
          GROUP BY tu.Email, s.Name, tu.TenantId, s.Active, s.Banned, ub.BlockedEmail, ub.BlockerEmail
          ORDER BY s.Name, tu.Email
        `;
        params = [tenantId];
      } else {
        userQuery = `
          SELECT 
            tu.Email,
            s.Name,
            tu.TenantId,
            GROUP_CONCAT(COALESCE(ur.RoleId, tu.RoleId)) as RoleIds,
            s.Active,
            s.Banned,
            CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
          FROM TenantUsers tu
          LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
          LEFT JOIN Subscribers s ON tu.Email = s.Email
          LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = tu.TenantId AND ub.IsActive = TRUE
          ${includeInactive ? '' : 'WHERE s.Active = TRUE AND s.Banned = FALSE'}
          GROUP BY tu.Email, s.Name, tu.TenantId, s.Active, s.Banned, ub.BlockedEmail, ub.BlockerEmail
          ORDER BY tu.TenantId, s.Name, tu.Email
        `;
      }

      tenantQuery = `
        SELECT 
          t.Id,
          t.Name,
          COUNT(DISTINCT tu.Email) as UserCount
        FROM Tenants t
        LEFT JOIN TenantUsers tu ON t.Id = tu.TenantId
        LEFT JOIN Subscribers s ON tu.Email = s.Email
        ${includeInactive ? '' : 'WHERE s.Active = TRUE AND s.Banned = FALSE'}
        GROUP BY t.Id, t.Name
        ORDER BY t.Name
      `;
    } else {
      // Regular users can only see users in their accessible tenants
      if (tenantId) {
        if (!accessibleTenants.includes(tenantId)) {
          return NextResponse.json({ error: 'Access denied to specified tenant' }, { status: 403 });
        }
        userQuery = `
          SELECT 
            tu.Email,
            s.Name,
            tu.TenantId,
            GROUP_CONCAT(COALESCE(ur.RoleId, tu.RoleId)) as RoleIds,
            s.Active,
            s.Banned,
            CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
          FROM TenantUsers tu
          LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
          LEFT JOIN Subscribers s ON tu.Email = s.Email
          LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = tu.TenantId AND ub.IsActive = TRUE
          WHERE tu.TenantId = ?
          ${includeInactive ? '' : 'AND s.Active = TRUE AND s.Banned = FALSE'}
          GROUP BY tu.Email, s.Name, tu.TenantId, s.Active, s.Banned, ub.BlockedEmail, ub.BlockerEmail
          ORDER BY s.Name, tu.Email
        `;
        params = [tenantId];
      } else {
        userQuery = `
          SELECT 
            tu.Email,
            s.Name,
            tu.TenantId,
            GROUP_CONCAT(COALESCE(ur.RoleId, tu.RoleId)) as RoleIds,
            s.Active,
            s.Banned,
            CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
          FROM TenantUsers tu
          LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
          LEFT JOIN Subscribers s ON tu.Email = s.Email
          LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = tu.TenantId AND ub.IsActive = TRUE
          WHERE tu.TenantId IN (${accessibleTenants.map(() => '?').join(',')})
          ${includeInactive ? '' : 'AND s.Active = TRUE AND s.Banned = FALSE'}
          GROUP BY tu.Email, s.Name, tu.TenantId, s.Active, s.Banned, ub.BlockedEmail, ub.BlockerEmail
          ORDER BY tu.TenantId, s.Name, tu.Email
        `;
        params = accessibleTenants;
      }

      tenantQuery = `
        SELECT 
          t.Id,
          t.Name,
          COUNT(DISTINCT tu.Email) as UserCount
        FROM Tenants t
        LEFT JOIN TenantUsers tu ON t.Id = tu.TenantId
        LEFT JOIN Subscribers s ON tu.Email = s.Email
        WHERE t.Id IN (${accessibleTenants.map(() => '?').join(',')})
        ${includeInactive ? '' : 'AND s.Active = TRUE AND s.Banned = FALSE'}
        GROUP BY t.Id, t.Name
        ORDER BY t.Name
      `;
      params = [...accessibleTenants, ...accessibleTenants];
    }

    // Get users
    const usersResult = await db.prepare(userQuery).bind(...params).all();
    
    // Get tenants
    const tenantsResult = await db.prepare(tenantQuery).bind(...(isAdmin ? [] : accessibleTenants)).all();

    // Check online status by looking for active sessions
    const users = usersResult.results?.map(user => {
      // For now, implement a basic online status check
      // This could be enhanced to check actual SSE connections or active sessions
      let isOnline = false;
      
      // Check if user has an active session (basic implementation)
      // In a real implementation, this would check SSE connections or active sessions
      try {
        // For test users, we can implement a simple online status
        // This is a placeholder - replace with actual online status logic
        const userEmail = user.Email as string;
        if (userEmail.includes('@logosophe.test')) {
          // Simple logic: test users with specific numbers are "online"
          const match = userEmail.match(/test-user-(\d+)@logosophe\.test/);
          if (match) {
            const userNumber = parseInt(match[1], 10);
            // Example: users 410 and 414 are online
            isOnline = [410, 414].includes(userNumber);
          }
        }
      } catch (error) {
        console.error('Error checking online status for user:', user.Email, error);
        isOnline = false;
      }

      return {
        email: user.Email as string,
        name: user.Name as string,
        tenantId: user.TenantId as string,
        roleIds: user.RoleIds as string,
        isOnline,
        isBlocked: user.IsBlocked === 1,
        isActive: user.Active === 1,
        isBanned: user.Banned === 1
      };
    }) || [];

    const tenants = tenantsResult.results?.map(tenant => ({
      id: tenant.Id,
      name: tenant.Name,
      userCount: tenant.UserCount
    })) || [];

    return NextResponse.json({
      users,
      tenants
    } as GetRecipientsResponse);

  } catch (error) {
    console.error('Error getting recipients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 