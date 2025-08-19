import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserWorkflowTenants } from '@/lib/workflow';
import { SystemLogs } from '@/lib/system-logs';
import { Container, Heading, Text, Box, Flex, Button } from '@radix-ui/themes';
import Link from 'next/link';
import { WorkflowHistoryTabs } from '@/components/WorkflowHistoryTabs';


export default async function WorkflowHistoryPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const systemLogs = new SystemLogs(db);

  // Check if user has admin access
  const isAdmin = await isSystemAdmin(session.user.email, db);
  
  // Get user's accessible tenants for workflow access
  const accessibleTenants = await getUserWorkflowTenants(session.user.email);
  
  if (!isAdmin && accessibleTenants.length === 0) {
    // Log unauthorized access attempt
    await systemLogs.createLog({
      logType: 'activity',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      activityType: 'unauthorized_workflow_access',
      metadata: { attemptedAccess: 'workflow-history' }
    });
    
    redirect('/dashboard');
  }

  // Check if user is a tenant admin
  const isTenantAdmin = !isAdmin && await db.prepare(`
    SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
  `).bind(session.user.email).first();

  if (!isAdmin && !isTenantAdmin) {
    redirect('/dashboard');
  }

  // Log successful access
  await systemLogs.createLog({
    logType: 'activity',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'access_workflow_history'
  });

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              Workflow History
            </Heading>
            <Text color="gray" size="3">
              Review completed and terminated workflows
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

      <WorkflowHistoryTabs 
        userEmail={session.user.email}
        isGlobalAdmin={isAdmin}
        accessibleTenants={accessibleTenants}
      />

      <Box style={{ marginTop: '2rem' }}>
        <Text size="2" color="gray">
          View historical workflow data to analyze patterns and outcomes. Completed workflows show successful outcomes, while terminated workflows show early endings.
        </Text>
      </Box>
    </Container>
  );
} 