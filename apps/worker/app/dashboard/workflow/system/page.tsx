import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';
import { Container, Heading, Text, Box, Flex, Button, Card } from '@radix-ui/themes';
import Link from 'next/link';
import { WorkflowSystemStats } from '@/components/WorkflowSystemStats';


export default async function WorkflowSystemPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const systemLogs = new SystemLogs(db);

  // Check if user has admin access
  const isAdmin = await isSystemAdmin(session.user.email, db);
  
  if (!isAdmin) {
    // Log unauthorized access attempt
    await systemLogs.createLog({
      logType: 'activity',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      activityType: 'UNAUTHORIZED_WORKFLOW_ACCESS',
      metadata: { attemptedAccess: 'workflow-system' }
    });
    
    redirect('/dashboard');
  }

  // Log successful access
  await systemLogs.createLog({
    logType: 'activity',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'ACCESS_WORKFLOW_SYSTEM'
  });

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              Workflow System Management
            </Heading>
            <Text color="gray" size="3">
              System-level workflow administration and monitoring
            </Text>
          </Box>
          <Flex gap="2">
            <Button variant="soft" asChild>
              <Link href="/dashboard/workflow">
                ← Back to Workflow Dashboard
              </Link>
            </Button>
          </Flex>
        </Flex>
      </Box>

      <Flex gap="4" wrap="wrap">
        {/* System Statistics */}
        <Card style={{ flex: '1', minWidth: '300px' }}>
          <Box p="4">
            <Heading size="4" style={{ marginBottom: '1rem' }}>
              System Overview
            </Heading>
            <Text size="2" color="gray" style={{ marginBottom: '1rem' }}>
              Workflow system statistics and health monitoring
            </Text>
            <WorkflowSystemStats userEmail={session.user.email} />
          </Box>
        </Card>

        {/* System Actions */}
        <Card style={{ flex: '1', minWidth: '300px' }}>
          <Box p="4">
            <Heading size="4" style={{ marginBottom: '1rem' }}>
              System Actions
            </Heading>
            <Text size="2" color="gray" style={{ marginBottom: '1rem' }}>
              Administrative actions for workflow management
            </Text>
            <Flex direction="column" gap="2">
              <Button size="2" variant="soft" asChild>
                <Link href="/dashboard/workflow/analytics">
                  View Analytics
                </Link>
              </Button>
              <Button size="2" variant="soft" asChild>
                <Link href="/dashboard/workflow/history">
                  View History
                </Link>
              </Button>
              <Button size="2" variant="soft" asChild>
                <Link href="/dashboard/workflow/settings">
                  System Settings
                </Link>
              </Button>
            </Flex>
          </Box>
        </Card>
      </Flex>


    </Container>
  );
} 