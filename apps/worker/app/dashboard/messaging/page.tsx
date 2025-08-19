import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { getUserMessagingTenants } from '@/lib/messaging';
import { SystemLogs } from '@/lib/system-logs';
import { Container, Heading, Text, Flex, Card, Button, Box } from '@radix-ui/themes';
import Link from 'next/link';


export default async function MessagingAdminPage() {
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
    // Log unauthorized access attempt
    await systemLogs.createLog({
      logType: 'activity',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      activityType: 'unauthorized_messaging_access',
      metadata: { attemptedAccess: 'messaging-admin' }
    });
    
    redirect('/dashboard');
  }

  // Log successful access
  await systemLogs.createLog({
    logType: 'activity',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'access_messaging_admin'
  });

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="6" style={{ marginBottom: '0.5rem' }}>
          Messaging Administration
        </Heading>
        <Text color="gray" size="3">
          Manage messaging system, user blocks, and system settings
        </Text>
      </Box>

      <Flex gap="4" wrap="wrap">
        {/* Message Management */}
        <Card style={{ flex: '1', minWidth: '300px' }}>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>
              Message Management
            </Heading>
            <Text color="gray" size="2" style={{ marginBottom: '1.5rem' }}>
              View, search, and manage all messages in the system
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button asChild>
                <Link href="/dashboard/messaging/messages">
                  View Messages
                </Link>
              </Button>
              <Button variant="soft" asChild>
                <Link href="/dashboard/messaging/interface">
                  Compose Message
                </Link>
              </Button>
            </Flex>
          </Box>
        </Card>

        {/* User Blocks */}
        <Card style={{ flex: '1', minWidth: '300px' }}>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>
              User Blocks
            </Heading>
            <Text color="gray" size="2" style={{ marginBottom: '1.5rem', display: 'block' }}>
              Manage user blocking relationships and view block history
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button asChild>
                <Link href="/dashboard/messaging/blocks">
                  Manage Blocks
                </Link>
              </Button>
            </Flex>
          </Box>
        </Card>

        {/* System Controls - Admin Only */}
        {isAdmin && (
          <Card style={{ flex: '1', minWidth: '300px' }}>
            <Box style={{ padding: '1.5rem' }}>
              <Heading size="4" style={{ marginBottom: '1rem' }}>
                System Controls
              </Heading>
              <Text color="gray" size="2" style={{ marginBottom: '1.5rem', display: 'block' }}>
                Configure messaging system settings and controls
              </Text>
              <Flex gap="2" wrap="wrap">
                <Button asChild>
                  <Link href="/dashboard/messaging/system">
                    System Settings
                  </Link>
                </Button>
              </Flex>
            </Box>
          </Card>
        )}

        {/* Recipients */}
        <Card style={{ flex: '1', minWidth: '300px' }}>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>
              Recipients
            </Heading>
            <Text color="gray" size="2" style={{ marginBottom: '1.5rem', display: 'block' }}>
              View and manage available messaging recipients
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button asChild>
                <Link href="/dashboard/messaging/recipients">
                  View Recipients
                </Link>
              </Button>
            </Flex>
          </Box>
        </Card>
      </Flex>

      {/* Quick Stats */}
      <Box style={{ marginTop: '2rem' }}>
        <Heading size="4" style={{ marginBottom: '1rem' }}>
          Quick Statistics
        </Heading>
        <Flex gap="4" wrap="wrap">
          <Card style={{ flex: '1', minWidth: '200px' }}>
            <Box style={{ padding: '1rem' }}>
              <Text size="2" color="gray">Total Messages</Text>
              <Heading size="3">-</Heading>
            </Box>
          </Card>
          <Card style={{ flex: '1', minWidth: '200px' }}>
            <Box style={{ padding: '1rem' }}>
              <Text size="2" color="gray">Active Users</Text>
              <Heading size="3">-</Heading>
            </Box>
          </Card>
          <Card style={{ flex: '1', minWidth: '200px' }}>
            <Box style={{ padding: '1rem' }}>
              <Text size="2" color="gray">Blocked Users</Text>
              <Heading size="3">-</Heading>
            </Box>
          </Card>
          <Card style={{ flex: '1', minWidth: '200px' }}>
            <Box style={{ padding: '1rem' }}>
              <Text size="2" color="gray">Messages with Attachments</Text>
              <Heading size="3">-</Heading>
            </Box>
          </Card>
        </Flex>
      </Box>
    </Container>
  );
} 