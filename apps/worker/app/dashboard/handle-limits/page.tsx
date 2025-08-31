import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { checkAccess } from '@/lib/access-control';
import { NormalizedLogging } from '@/lib/normalized-logging';
import HandleLimitsManager from '@/components/HandleLimitsManager';
import { Box, Container } from '@radix-ui/themes';

export default async function HandleLimitsPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant']
  });

  if (!access.hasAccess) {
    redirect('/harbor');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const normalizedLogging = new NormalizedLogging(db);

  // Check if user is system admin or tenant admin
  const isAdmin = await isSystemAdmin(session.user.email, db);
  const isTenantAdmin = !isAdmin && await db.prepare(
    'SELECT Role FROM Credentials WHERE Email = ?'
  ).bind(session.user.email).first() as { Role: string } | null;
  
  if (!isAdmin && !isTenantAdmin) {
    // Log unauthorized access attempt
    await normalizedLogging.logAuthentication({
      userEmail: session.user.email,
      userId: session.user.id || session.user.email,
      provider: 'credentials',
      activityType: 'unauthorized_handle_limits_access',
      accessType: 'auth',
      targetId: session.user.email,
      targetName: `Unauthorized Handle Limits Access (${session.user.email})`,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      metadata: { attemptedAccess: 'handle-limits' }
    });
    
    redirect('/dashboard');
  }

  // Get user's accessible tenants if tenant admin
  let accessibleTenants: Array<{ Id: string; Name: string }> = [];
  if (!isAdmin && isTenantAdmin) {
    const tenantsResult = await db.prepare(`
      SELECT DISTINCT t.Id, t.Name
      FROM Tenants t
      JOIN TenantUsers tu ON t.Id = tu.TenantId
      WHERE tu.Email = ?
      ORDER BY t.Name
    `).bind(session.user.email).all();
    
    accessibleTenants = (tenantsResult.results || []) as Array<{ Id: string; Name: string }>;
  }

  // Log successful access
  await normalizedLogging.logSystemOperations({
    userEmail: session.user.email,
    tenantId: accessibleTenants.length > 0 ? accessibleTenants[0].Id : 'system',
    activityType: 'access_handle_limits',
    accessType: 'admin',
    targetId: 'handle-limits-page',
    targetName: 'Handle Limits Management Page',
    ipAddress: undefined,
    userAgent: undefined,
    metadata: { 
      isSystemAdmin: isAdmin,
      isTenantAdmin: !!isTenantAdmin,
      accessibleTenantsCount: accessibleTenants.length
    }
  });

  return (
    <Container size="4">
      <Box py="6">
        <HandleLimitsManager 
          isSystemAdmin={isAdmin}
          accessibleTenants={accessibleTenants}
        />
      </Box>
    </Container>
  );
}
