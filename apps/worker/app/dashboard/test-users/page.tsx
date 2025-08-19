import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import TestUserSignIn from '@/components/TestUserSignIn';
import ActiveSessionsDashboard from '@/components/ActiveSessionsDashboard';
import { Box, Card, Flex, Grid, Heading, Text } from '@radix-ui/themes';
import { ToastProvider } from '@/components/Toast';


export default async function TestUsersPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const systemLogs = new SystemLogs(db);

  // Check if user is system admin
  const isAdmin = await isSystemAdmin(session.user.email, db);
  
  if (!isAdmin) {
    // Log unauthorized access attempt
    await systemLogs.createLog({
      logType: 'activity',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      activityType: 'unauthorized_test_users_access',
      metadata: { attemptedAccess: 'test-users' }
    });
    
    redirect('/dashboard');
  }

  // Log successful access
  await systemLogs.createLog({
    logType: 'activity',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'access_test_users'
  });
  return (
    <ToastProvider>
      <Flex direction="column" align="center" style={{ minHeight: '60vh' }} gap="6">
        <Box style={{ textAlign: 'center' }}>
          <Box mb="6">
            <Heading size="8">Test User Management</Heading>
          </Box>
          <Text size="5" color="gray">
            This page provides access to test users for development and testing purposes.
          </Text>
        </Box>

        <Grid columns="1" gap="6" style={{ width: '100%', maxWidth: '120rem' }}>
          <Card size="3">
            <Box p="4">
              <TestUserSignIn />
            </Box>
          </Card>

          <Card size="3">
            <Box p="4">
              <ActiveSessionsDashboard />
            </Box>
          </Card>
        </Grid>
      </Flex>
    </ToastProvider>
  );
} 