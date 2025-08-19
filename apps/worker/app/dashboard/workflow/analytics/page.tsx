import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserWorkflowTenants } from '@/lib/workflow';
import { SystemLogs } from '@/lib/system-logs';
import { Container, Heading, Text, Box, Flex, Button } from '@radix-ui/themes';
import Link from 'next/link';
import { WorkflowAnalyticsTabs } from '@/components/WorkflowAnalyticsTabs';


export default async function WorkflowAnalyticsPage() {
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
      metadata: { attemptedAccess: 'workflow-analytics' }
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

  // Get user's accessible tenants for display
  let userTenants = [];
  if (!isAdmin) {
    const tenantResult = await db.prepare(`
      SELECT DISTINCT t.Id as id, t.Name as name
      FROM Tenants t
      JOIN TenantUsers tu ON t.Id = tu.TenantId
      WHERE tu.Email = ?
      ORDER BY t.Name
    `).bind(session.user.email).all() as { results: { id: string; name: string }[] };
    userTenants = tenantResult.results || [];
  } else {
    // Global admin gets all tenants
    const allTenants = await db.prepare(`
      SELECT Id as id, Name as name
      FROM Tenants
      ORDER BY Name
    `).all() as { results: { id: string; name: string }[] };
    userTenants = allTenants.results || [];
  }

  // Log successful access
  await systemLogs.createLog({
    logType: 'activity',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'access_workflow_analytics'
  });

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              Workflow Analytics & Reports
            </Heading>
            <Text color="gray" size="3">
              Comprehensive analytics and reporting for workflow performance
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

      <WorkflowAnalyticsTabs 
        userEmail={session.user.email}
        isGlobalAdmin={isAdmin}
        accessibleTenants={accessibleTenants}
        userTenants={userTenants}
      />

      <Box style={{ marginTop: '2rem' }}>
        <Text size="2" color="gray">
          Use the analytics dashboard to monitor workflow performance and generate detailed reports for analysis and compliance.
        </Text>
      </Box>
    </Container>
  );
} 