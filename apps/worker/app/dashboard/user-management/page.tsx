import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { checkAccess } from '@/lib/access-control';
import { SystemLogs } from '@/lib/system-logs';
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
  const systemLogs = new SystemLogs(db);

  // Check if user is system admin or tenant admin
  const isAdmin = await isSystemAdmin(session.user.email, db);
  const isTenantAdmin = !isAdmin && await db.prepare(
    'SELECT Role FROM Credentials WHERE Email = ?'
  ).bind(session.user.email).first() as { Role: string } | null;
  
  if (!isAdmin && !isTenantAdmin) {
    // Log unauthorized access attempt
    await systemLogs.logAuth({
      userId: session.user.id || session.user.email,
      email: session.user.email,
      provider: 'credentials',
      activityType: 'UNAUTHORIZED_USER_MANAGEMENT_ACCESS',
      ipAddress: 'unknown',
      userAgent: 'unknown',
      metadata: { attemptedAccess: 'user-management' }
    });
    
    redirect('/dashboard');
  }

  // Log successful access
  await systemLogs.logAuth({
    userId: session.user.id || session.user.email,
    email: session.user.email,
    provider: 'credentials',
    activityType: 'ACCESS_USER_MANAGEMENT',
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