import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { RecipientsClient } from './RecipientsClient';
import type { D1Result } from '@cloudflare/workers-types';


interface Recipient {
  Email: string;
  Name: string;
  TenantId: string;
  RoleIds: string;
  IsOnline: boolean;
  IsBlocked: boolean;
  IsActive: boolean;
  IsBanned: boolean;
  IsPrimaryTenant: boolean; // New field to identify primary vs additional tenant rows
}

interface Tenant {
  Id: string;
  Name: string;
  UserCount: number;
}

export default async function RecipientsPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const normalizedLogging = new NormalizedLogging(db);

  // Check if user has admin access
  const isAdmin = await isSystemAdmin(session.user.email, db);
  const accessibleTenants = await getUserMessagingTenants(session.user.email);
  
  if (!isAdmin && accessibleTenants.length === 0) {
    redirect('/dashboard/messaging');
  }

  // Log access
  await normalizedLogging.logMessagingOperations({
    userEmail: session.user.email,
    tenantId: 'system',
    activityType: 'access_recipients',
    accessType: 'admin',
    targetId: 'messaging-recipients-page',
    targetName: 'Messaging Recipients Page',
    ipAddress: undefined,
    userAgent: undefined,
    metadata: { accessGranted: true }
  });

  // Build query to get users with all their tenant memberships
  let userQuery = '';
  let tenantQuery = '';
  let params: any[] = [];

  if (isAdmin) {
    // System admins can see all users with all their tenant memberships
    userQuery = `
      SELECT 
        tu.Email,
        s.Name,
        tu.TenantId,
        GROUP_CONCAT(COALESCE(ur.RoleId, tu.RoleId)) as RoleIds,
        FALSE as IsOnline,
        CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked,
        s.Active,
        s.Banned,
        CASE WHEN tu.TenantId = (
          SELECT MIN(tu2.TenantId) 
          FROM TenantUsers tu2 
          WHERE tu2.Email = tu.Email
        ) THEN 1 ELSE 0 END as IsPrimaryTenant
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email
      LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
      LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = tu.TenantId AND ub.IsActive = TRUE
      WHERE s.Active = TRUE AND s.Banned = FALSE
      GROUP BY tu.Email, s.Name, tu.TenantId, s.Active, s.Banned, ub.BlockedEmail, ub.BlockerEmail
      ORDER BY tu.Email, tu.TenantId
    `;

    tenantQuery = `
      SELECT 
        t.Id,
        t.Name,
        COUNT(DISTINCT tu.Email) as UserCount
      FROM Tenants t
      LEFT JOIN TenantUsers tu ON t.Id = tu.TenantId
      LEFT JOIN Subscribers s ON tu.Email = s.Email
      WHERE s.Active = TRUE AND s.Banned = FALSE
      GROUP BY t.Id, t.Name
      ORDER BY t.Name
    `;
  } else {
    // Regular users can only see users in their accessible tenants
    userQuery = `
      SELECT 
        tu.Email,
        s.Name,
        tu.TenantId,
        GROUP_CONCAT(COALESCE(ur.RoleId, tu.RoleId)) as RoleIds,
        FALSE as IsOnline,
        CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked,
        s.Active,
        s.Banned,
        CASE WHEN tu.TenantId = (
          SELECT MIN(tu2.TenantId) 
          FROM TenantUsers tu2 
          WHERE tu2.Email = tu.Email AND tu2.TenantId IN (${accessibleTenants.map(() => '?').join(',')})
        ) THEN 1 ELSE 0 END as IsPrimaryTenant
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email
      LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
      LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = tu.TenantId AND ub.IsActive = TRUE
      WHERE tu.TenantId IN (${accessibleTenants.map(() => '?').join(',')})
      AND s.Active = TRUE AND s.Banned = FALSE
      GROUP BY tu.Email, s.Name, tu.TenantId, s.Active, s.Banned, ub.BlockedEmail, ub.BlockerEmail
      ORDER BY tu.Email, tu.TenantId
    `;
    params = [...accessibleTenants, ...accessibleTenants]; // First set for the subquery, second for the main query

    tenantQuery = `
      SELECT 
        t.Id,
        t.Name,
        COUNT(DISTINCT tu.Email) as UserCount
      FROM Tenants t
      LEFT JOIN TenantUsers tu ON t.Id = tu.TenantId
      LEFT JOIN Subscribers s ON tu.Email = s.Email
      WHERE t.Id IN (${accessibleTenants.map(() => '?').join(',')})
      AND s.Active = TRUE AND s.Banned = FALSE
      GROUP BY t.Id, t.Name
      ORDER BY t.Name
    `;
  }

  // Get users
  const usersResult = await db.prepare(userQuery).bind(...params).all() as D1Result<Recipient>;
  const users = usersResult.results || [];
  
  // Get tenants
  const tenantsResult = await db.prepare(tenantQuery).bind(...(isAdmin ? [] : accessibleTenants)).all() as D1Result<Tenant>;
  const tenants = tenantsResult.results || [];

  return <RecipientsClient initialUsers={users} initialTenants={tenants} />;
} 