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
  IsPrimaryTenant: boolean; // This is just for UI grouping, not a real concept
  CreatedAt?: string;
  Joined?: string;
  LastSignin?: string;
  // Additional fields for profile modal
  AllTenants?: Array<{
    TenantId: string;
    TenantName?: string;
    Roles: string[];
  }>;
  // Activity data
  MessagesSent?: number;
  MediaDocuments?: number;
  PublishedDocuments?: number;
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
    // System admins can see all users with consolidated roles
    userQuery = `
      SELECT 
        tu.Email,
        s.Name,
        tu.TenantId,
        GROUP_CONCAT(COALESCE(ur.RoleId, tu.RoleId)) as RoleIds,
        s.Active,
        s.Banned,
        CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked,
        s.CreatedAt,
        s.Joined,
        s.Signin as LastSignin
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email
      LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
      LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = tu.TenantId AND ub.IsActive = TRUE
      WHERE s.Active = TRUE AND s.Banned = FALSE
      GROUP BY tu.Email, s.Name, tu.TenantId, s.Active, s.Banned, ub.BlockedEmail, ub.BlockerEmail, s.CreatedAt, s.Joined, s.Signin
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
        s.Active,
        s.Banned,
        CASE WHEN ub.BlockedEmail IS NOT NULL THEN 1 ELSE 0 END as IsBlocked,
        s.CreatedAt,
        s.Joined,
        s.Signin as LastSignin
      FROM TenantUsers tu
      LEFT JOIN Subscribers s ON tu.Email = s.Email
      LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
      LEFT JOIN UserBlocks ub ON tu.Email = ub.BlockedEmail AND tu.TenantId = tu.TenantId AND ub.IsActive = TRUE
      WHERE tu.TenantId IN (${accessibleTenants.map(() => '?').join(',')})
      AND s.Active = TRUE AND s.Banned = FALSE
      GROUP BY tu.Email, s.Name, tu.TenantId, s.Active, s.Banned, ub.BlockedEmail, ub.BlockerEmail, s.CreatedAt, s.Joined, s.Signin
      ORDER BY tu.TenantId, s.Name, tu.Email
    `;
    params = accessibleTenants;

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

  // Process users to add online status, primary tenant flag, and fetch all tenant memberships
  const processedUsers = await Promise.all(users.map(async (user, index) => {
    // Determine if this is the first row for this user
    const isFirstRowForUser = index === 0 || users[index - 1].Email !== user.Email;
    
    // Determine online status
    let isOnline = false;
    try {
      if (user.Email.includes('@logosophe.test')) {
        const match = user.Email.match(/test-user-(\d+)@logosophe\.test/);
        if (match) {
          const userNumber = parseInt(match[1], 10);
          // Test users 410 and 414 are online
          isOnline = [410, 414].includes(userNumber);
        }
      }
    } catch (error) {
      console.error('Error checking online status for user:', user.Email, error);
      isOnline = false;
    }

            // Fetch all tenant memberships and roles for this user
        let allTenants: Array<{ TenantId: string; TenantName?: string; Roles: string[] }> = [];
        let messagesSent = 0;
        let mediaDocuments = 0;
        let publishedDocuments = 0;
        let lastSigninFromLogs: string | undefined = undefined;
        let isGloballyBlocked = false;
        let accessibleTenantsForUser = accessibleTenants; // For access control in blocking check
        
        if (isFirstRowForUser) {
          try {
            // Fetch tenant memberships
            const tenantMemberships = await db.prepare(`
              SELECT 
                tu.TenantId,
                t.Name as TenantName,
                GROUP_CONCAT(COALESCE(ur.RoleId, tu.RoleId)) as RoleIds
              FROM TenantUsers tu
              LEFT JOIN Tenants t ON tu.TenantId = t.Id
              LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
              WHERE tu.Email = ?
              GROUP BY tu.TenantId, t.Name
              ORDER BY tu.TenantId
            `).bind(user.Email).all() as D1Result<{ TenantId: string; TenantName?: string; RoleIds: string }>;
            
            allTenants = (tenantMemberships.results || []).map(t => ({
              TenantId: t.TenantId,
              TenantName: t.TenantName || t.TenantId,
              Roles: t.RoleIds ? t.RoleIds.split(',').filter(role => role.trim()) : []
            }));

            // Fetch activity data
            const messagesResult = await db.prepare(`
              SELECT COUNT(*) as count FROM Messages WHERE SenderEmail = ?
            `).bind(user.Email).first() as { count: number } | null;
            messagesSent = messagesResult?.count || 0;

            const mediaResult = await db.prepare(`
              SELECT COUNT(*) as count FROM MediaFiles WHERE UploadedBy = ?
            `).bind(user.Email).first() as { count: number } | null;
            mediaDocuments = mediaResult?.count || 0;

            const publishedResult = await db.prepare(`
              SELECT COUNT(*) as count FROM PublishedContent WHERE PublisherId = ?
            `).bind(user.Email).first() as { count: number } | null;
            publishedDocuments = publishedResult?.count || 0;

            // Fetch last sign-in time from SystemLogs
            const lastSigninResult = await db.prepare(`
              SELECT Timestamp FROM SystemLogs 
              WHERE UserEmail = ? AND ActivityType = 'signin' AND IsDeleted = 0
              ORDER BY Timestamp DESC 
              LIMIT 1
            `).bind(user.Email).first() as { Timestamp: string } | null;
            lastSigninFromLogs = lastSigninResult?.Timestamp || undefined;

            // Check if user is globally blocked using same logic as blocks page
            let blocksQuery = '';
            let blockParams: any[] = [];
            
            if (isAdmin) {
              // System admins can see all blocks - check if user is blocked anywhere
              blocksQuery = `
                SELECT COUNT(*) as count FROM UserBlocks 
                WHERE BlockedEmail = ? AND IsActive = TRUE
              `;
              blockParams = [user.Email];
            } else {
              // Tenant admins can only see blocks from their accessible tenants
              const placeholders = accessibleTenants.map(() => '?').join(',');
              blocksQuery = `
                SELECT COUNT(*) as count FROM UserBlocks 
                WHERE BlockedEmail = ? AND TenantId IN (${placeholders}) AND IsActive = TRUE
              `;
              blockParams = [user.Email, ...accessibleTenants];
            }
            
            const blocksResult = await db.prepare(blocksQuery).bind(...blockParams).first() as { count: number } | null;
            isGloballyBlocked = (blocksResult?.count || 0) > 0;

          } catch (error) {
            console.error('Error fetching profile data for user:', user.Email, error);
            allTenants = [];
            messagesSent = 0;
            mediaDocuments = 0;
            publishedDocuments = 0;
            lastSigninFromLogs = undefined;
          }
        }

            return {
          ...user,
          IsOnline: isOnline,
          IsPrimaryTenant: isFirstRowForUser,
          AllTenants: allTenants,
          MessagesSent: messagesSent,
          MediaDocuments: mediaDocuments,
          PublishedDocuments: publishedDocuments,
          LastSigninFromLogs: lastSigninFromLogs,
          IsGloballyBlocked: isGloballyBlocked
        };
  }));

  return (
    <RecipientsClient 
      initialUsers={processedUsers} 
      initialTenants={tenants}
      currentUserEmail={session.user.email}
      isSystemAdmin={isAdmin}
      accessibleTenants={accessibleTenants}
    />
  );
} 