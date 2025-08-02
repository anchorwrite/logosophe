import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { SystemLogs } from '@/lib/system-logs';
import { RecipientsClient } from './RecipientsClient';
import type { D1Result } from '@cloudflare/workers-types';

export const runtime = 'edge';

interface Recipient {
  Email: string;
  Name: string;
  TenantId: string;
  RoleId: string;
  IsOnline: boolean;
  IsBlocked: boolean;
  IsActive: boolean;
  IsBanned: boolean;
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
  const systemLogs = new SystemLogs(db);

  // Check if user has admin access
  const isAdmin = await isSystemAdmin(session.user.email, db);
  const accessibleTenants = await getUserMessagingTenants(session.user.email);
  
  if (!isAdmin && accessibleTenants.length === 0) {
    redirect('/dashboard/messaging');
  }

  // Log access
  await systemLogs.createLog({
    logType: 'ACTIVITY',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'ACCESS_RECIPIENTS'
  });

  // Build query based on user's access level
  let userQuery = '';
  let tenantQuery = '';
  let params: any[] = [];

  if (isAdmin) {
    // System admins can see all users
    userQuery = `
      SELECT 
        tu.Email,
        s.Name,
        tu.TenantId,
        tu.RoleId,
        FALSE as IsOnline,
        CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked,
        s.Active,
        s.Banned
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email
      LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.TenantId AND ub.IsActive = TRUE
      WHERE s.Active = TRUE AND s.Banned = FALSE
      ORDER BY tu.TenantId, s.Name, tu.Email
    `;

    tenantQuery = `
      SELECT 
        t.Id,
        t.Name,
        COUNT(tu.Email) as UserCount
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
        tu.RoleId,
        FALSE as IsOnline,
        CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked,
        s.Active,
        s.Banned
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email
      LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = ub.TenantId AND ub.IsActive = TRUE
      WHERE tu.TenantId IN (${accessibleTenants.map(() => '?').join(',')})
      AND s.Active = TRUE AND s.Banned = FALSE
      ORDER BY tu.TenantId, s.Name, tu.Email
    `;
    params = accessibleTenants;

    tenantQuery = `
      SELECT 
        t.Id,
        t.Name,
        COUNT(tu.Email) as UserCount
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