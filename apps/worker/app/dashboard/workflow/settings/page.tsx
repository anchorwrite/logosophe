import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { Container, Heading, Text, Box, Flex, Button } from '@radix-ui/themes';
import Link from 'next/link';
import { DashboardWorkflowSettings } from '@/components/DashboardWorkflowSettings';


export default async function WorkflowSettingsPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const normalizedLogging = new NormalizedLogging(db);

  // Check if user has admin access
  const isAdmin = await isSystemAdmin(session.user.email, db);
  
  if (!isAdmin) {
    // Log unauthorized access attempt
    await normalizedLogging.logSystemOperations({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'unauthorized_workflow_access',
      accessType: 'admin',
      targetId: 'workflow-settings',
      targetName: 'Workflow Settings Page',
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { attemptedAccess: 'workflow-settings' }
    });
    
    redirect('/dashboard');
  }

  // Log successful access
  await normalizedLogging.logSystemOperations({
    userEmail: session.user.email,
    tenantId: 'system',
    activityType: 'access_workflow_settings',
    accessType: 'admin',
    targetId: 'workflow-settings',
    targetName: 'Workflow Settings Page',
    ipAddress: undefined,
    userAgent: undefined,
    metadata: { accessGranted: true }
  });

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              Workflow System Settings
            </Heading>
            <Text color="gray" size="3">
              Configure workflow system settings and monitor system health
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

      <DashboardWorkflowSettings 
        userEmail={session.user.email}
        isGlobalAdmin={isAdmin}
      />

      <Box style={{ marginTop: '2rem' }}>
        <Text size="2" color="gray">
          System settings control workflow behavior, limits, and policies. Health monitoring provides real-time system status and performance metrics.
        </Text>
      </Box>
    </Container>
  );
} 