import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { checkAccess } from '@/lib/access-control';
import { NormalizedLogging } from '@/lib/normalized-logging';
import UserManagement from '@/components/UserManagement';
import { Box, Container } from '@radix-ui/themes';


export default async function UserManagementPage() {
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
      activityType: 'unauthorized_user_management_access',
      accessType: 'auth',
      targetId: session.user.email,
      targetName: `Unauthorized User Management Access (${session.user.email})`,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      metadata: { attemptedAccess: 'user-management' }
    });
    
    redirect('/dashboard');
  }

  // Log successful access
  await normalizedLogging.logAuthentication({
    userEmail: session.user.email,
    userId: session.user.id || session.user.email,
    provider: 'credentials',
    activityType: 'access_user_management',
    accessType: 'auth',
    targetId: session.user.email,
    targetName: `User Management Access (${session.user.email})`,
    ipAddress: 'unknown',
    userAgent: 'unknown'
  });

  return (
    <Container size="3">
      <Box py="6">
        <UserManagement />
      </Box>
    </Container>
  );
} 