import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { getUserWorkflowTenants } from '@/lib/workflow';
import { SystemLogs } from '@/lib/system-logs';
import { Container, Heading, Text, Flex, Card, Button, Box } from '@radix-ui/themes';
import Link from 'next/link';
import { DashboardWorkflowStats } from '@/components/DashboardWorkflowStats';


export default async function WorkflowPage() {
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
      logType: 'ACTIVITY',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      activityType: 'UNAUTHORIZED_WORKFLOW_ACCESS',
      metadata: { attemptedAccess: 'workflow-admin' }
    });
    
    redirect('/dashboard');
  }

  // Check if user is a tenant admin
  const isTenantAdmin = !isAdmin && await db.prepare(`
    SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
  `).bind(session.user.email).first();

  // Log successful access
  await systemLogs.createLog({
    logType: 'ACTIVITY',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'ACCESS_WORKFLOW_ADMIN'
  });

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="6" style={{ marginBottom: '0.5rem' }}>
          Workflow Administration
        </Heading>
        <Text color="gray" size="3">
          Manage collaborative workflows, track progress, and coordinate team activities
        </Text>
      </Box>

      <Flex gap="4" wrap="wrap">
        {/* Workflow Monitoring */}
        <Card style={{ flex: '1', minWidth: '300px' }}>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>
              Workflow Monitoring
            </Heading>
            <Text color="gray" size="2" style={{ marginBottom: '1.5rem', display: 'block' }}>
              Monitor and track collaborative workflows across your organization
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button asChild>
                <Link href="/dashboard/workflow/active">
                  View Active Workflows
                </Link>
              </Button>
              <Button variant="soft" asChild>
                <Link href="/dashboard/workflow/history">
                  View History
                </Link>
              </Button>
            </Flex>
          </Box>
        </Card>

        {/* Workflow Details */}
        <Card style={{ flex: '1', minWidth: '300px' }}>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>
              Workflow Details
            </Heading>
            <Text color="gray" size="2" style={{ marginBottom: '1.5rem', display: 'block' }}>
              View detailed information about specific workflows
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button asChild>
                <Link href="/dashboard/workflow/search">
                  Search Workflows
                </Link>
              </Button>
            </Flex>
          </Box>
        </Card>

        {/* Workflow History */}
        <Card style={{ flex: '1', minWidth: '300px' }}>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>
              Workflow History
            </Heading>
            <Text color="gray" size="2" style={{ marginBottom: '1.5rem', display: 'block' }}>
              Review completed workflows and their outcomes
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button asChild>
                <Link href="/dashboard/workflow/history">
                  View History
                </Link>
              </Button>
            </Flex>
          </Box>
        </Card>

        {/* System Controls - Admin Only */}
        {(isAdmin || isTenantAdmin) && (
          <Card style={{ flex: '1', minWidth: '300px' }}>
            <Box style={{ padding: '1.5rem' }}>
              <Heading size="4" style={{ marginBottom: '1rem' }}>
                System Controls
              </Heading>
              <Text color="gray" size="2" style={{ marginBottom: '1.5rem', display: 'block' }}>
                Configure workflow system settings and permissions
              </Text>
              <Flex gap="2" wrap="wrap">
                <Button asChild>
                  <Link href="/dashboard/workflow/system">
                    System Settings
                  </Link>
                </Button>
              </Flex>
            </Box>
          </Card>
        )}
      </Flex>

      {/* Workflow Statistics */}
      <Box style={{ marginTop: '2rem' }}>
        <Heading size="4" style={{ marginBottom: '1rem' }}>
          Workflow Statistics
        </Heading>
        <DashboardWorkflowStats 
          userEmail={session.user.email}
          isGlobalAdmin={isAdmin}
          accessibleTenants={accessibleTenants}
        />
      </Box>
    </Container>
  );
} 