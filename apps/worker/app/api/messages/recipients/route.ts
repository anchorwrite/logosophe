import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import type { GetRecipientsResponse } from '@/types/messaging';


// GET /api/messages/recipients - Get available recipients for messaging
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    
    // Get user's accessible tenants
    const accessibleTenants = await getUserMessagingTenants(session.user.email);
    
    if (!isAdmin && accessibleTenants.length === 0) {
      return NextResponse.json({ error: 'No accessible tenants found' }, { status: 403 });
    }

    // If tenantId is specified, verify access
    if (tenantId) {
      if (!isAdmin && !accessibleTenants.includes(tenantId)) {
        return NextResponse.json({ error: 'Access denied to specified tenant' }, { status: 403 });
      }
    }

    // Build query based on user's access level
    let userQuery = '';
    let tenantQuery = '';
    let params: any[] = [];

    if (isAdmin) {
      // System admins can see all users across all tenants
      if (tenantId) {
        userQuery = `
          SELECT 
            tu.Email,
            s.Name,
            tu.TenantId,
            tu.RoleId,
            s.Active,
            s.Banned,
            CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
          FROM TenantUsers tu
          LEFT JOIN Subscribers s ON tu.Email = s.Email
          LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.TenantId AND ub.IsActive = TRUE
          WHERE tu.TenantId = ?
          ${includeInactive ? '' : 'AND s.Active = TRUE AND s.Banned = FALSE'}
          ORDER BY s.Name, tu.Email
        `;
        params = [tenantId];
      } else {
        userQuery = `
          SELECT 
            tu.Email,
            s.Name,
            tu.TenantId,
            tu.RoleId,
            s.Active,
            s.Banned,
            CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
          FROM TenantUsers tu
          LEFT JOIN Subscribers s ON tu.Email = s.Email
          LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.TenantId AND ub.IsActive = TRUE
          ${includeInactive ? '' : 'WHERE s.Active = TRUE AND s.Banned = FALSE'}
          ORDER BY tu.TenantId, s.Name, tu.Email
        `;
      }

      tenantQuery = `
        SELECT 
          t.Id,
          t.Name,
          COUNT(tu.Email) as UserCount
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
            tu.RoleId,
            s.Active,
            s.Banned,
            CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
          FROM TenantUsers tu
          LEFT JOIN Subscribers s ON tu.Email = s.Email
          LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.TenantId AND ub.IsActive = TRUE
          WHERE tu.TenantId = ?
          ${includeInactive ? '' : 'AND s.Active = TRUE AND s.Banned = FALSE'}
          ORDER BY s.Name, tu.Email
        `;
        params = [tenantId];
      } else {
        userQuery = `
          SELECT 
            tu.Email,
            s.Name,
            tu.TenantId,
            tu.RoleId,
            s.Active,
            s.Banned,
            CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked
          FROM TenantUsers tu
          LEFT JOIN Subscribers s ON tu.Email = s.Email
          LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.TenantId AND ub.IsActive = TRUE
          WHERE tu.TenantId IN (${accessibleTenants.map(() => '?').join(',')})
          ${includeInactive ? '' : 'AND s.Active = TRUE AND s.Banned = FALSE'}
          ORDER BY tu.TenantId, s.Name, tu.Email
        `;
        params = accessibleTenants;
      }

      tenantQuery = `
        SELECT 
          t.Id,
          t.Name,
          COUNT(tu.Email) as UserCount
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

    // Check online status (simplified - in a real implementation, this would check active sessions)
    const users = usersResult.results?.map(user => ({
      email: user.Email,
      name: user.Name,
      tenantId: user.TenantId,
      roleId: user.RoleId,
      isOnline: false, // TODO: Implement real-time online status
      isBlocked: user.IsBlocked === 1,
      isActive: user.Active === 1,
      isBanned: user.Banned === 1
    })) || [];

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