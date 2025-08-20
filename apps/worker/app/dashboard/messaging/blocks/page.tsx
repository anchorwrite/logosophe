import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { BlocksClient } from './BlocksClient';
import type { D1Result } from '@cloudflare/workers-types';


interface UserBlock {
  Id: number;
  BlockerEmail: string;
  BlockedEmail: string;
  TenantId: string;
  Reason: string;
  CreatedAt: string;
  IsActive: boolean;
  BlockerUserName: string;
  BlockedUserName: string;
}

export default async function UserBlocksPage() {
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
    activityType: 'access_user_blocks',
    accessType: 'admin',
    targetId: 'user-blocks-page',
    targetName: 'User Blocks Page',
    ipAddress: undefined,
    userAgent: undefined,
    metadata: { accessGranted: true }
  });

  // Fetch blocks based on user's access level
  let blocksQuery = '';
  let params: any[] = [];

  if (isAdmin) {
    // System admins can see all blocks
    blocksQuery = `
      SELECT 
        ub.*,
        s1.Name as BlockerUserName,
        s2.Name as BlockedUserName
      FROM UserBlocks ub
      LEFT JOIN Subscribers s1 ON ub.BlockerEmail = s1.Email
      LEFT JOIN Subscribers s2 ON ub.BlockedEmail = s2.Email
      WHERE ub.IsActive = TRUE
      ORDER BY ub.CreatedAt DESC
      LIMIT 100
    `;
  } else {
    // Tenant admins can only see blocks from their tenants
    blocksQuery = `
      SELECT 
        ub.*,
        s1.Name as BlockerUserName,
        s2.Name as BlockedUserName
      FROM UserBlocks ub
      LEFT JOIN Subscribers s1 ON ub.BlockerEmail = s1.Email
      LEFT JOIN Subscribers s2 ON ub.BlockedEmail = s2.Email
      WHERE ub.IsActive = TRUE
      AND ub.TenantId IN (${accessibleTenants.map(() => '?').join(',')})
      ORDER BY ub.CreatedAt DESC
      LIMIT 100
    `;
    params = accessibleTenants;
  }

  const blocksResult = await db.prepare(blocksQuery).bind(...params).all() as D1Result<UserBlock>;
  const blocks = blocksResult.results || [];

  return <BlocksClient initialBlocks={blocks} accessibleTenants={accessibleTenants} />;
} 