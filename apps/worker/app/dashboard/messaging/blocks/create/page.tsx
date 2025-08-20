import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { CreateBlockClient } from './CreateBlockClient';
import type { D1Result } from '@cloudflare/workers-types';

interface TenantUser {
  Email: string;
  Name: string;
  Role: string;
  TenantId: string;
}

export default async function CreateBlockPage() {
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
  await normalizedLogging.logSystemOperations({
    userEmail: session.user.email,
    tenantId: 'system',
    activityType: 'access_create_block',
    accessType: 'admin',
    targetId: 'create-block-page',
    targetName: 'Create Block Page',
    ipAddress: undefined,
    userAgent: undefined,
    metadata: { accessGranted: true }
  });

  // Get tenant users for the accessible tenants
  let tenantUsers: TenantUser[] = [];
  
  if (accessibleTenants.length > 0) {
    const placeholders = accessibleTenants.map(() => '?').join(',');
    const usersQuery = `
      SELECT DISTINCT
        tu.Email,
        s.Name,
        r.Name as Role,
        tu.TenantId
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email
      LEFT JOIN Roles r ON tu.RoleId = r.Id
      WHERE tu.TenantId IN (${placeholders})
      AND tu.Email != ?
      ORDER BY s.Name, tu.Email
    `;
    
    const usersResult = await db.prepare(usersQuery)
      .bind(...accessibleTenants, session.user.email)
      .all() as D1Result<TenantUser>;
    
    tenantUsers = usersResult.results || [];
  }

  return (
    <CreateBlockClient 
      accessibleTenants={accessibleTenants}
      tenantUsers={tenantUsers}
      currentUserEmail={session.user.email}
    />
  );
}
