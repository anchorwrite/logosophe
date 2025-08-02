import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserWorkflowTenants } from '@/lib/workflow';
import { SystemLogs } from '@/lib/system-logs';
import { Container, Heading, Text, Box, Flex, Button, Tabs } from '@radix-ui/themes';
import Link from 'next/link';
import { DashboardWorkflowSearch } from '@/components/DashboardWorkflowSearch';
import { DashboardWorkflowList } from '@/components/DashboardWorkflowList';
import { DashboardWorkflowBulkActions } from '@/components/DashboardWorkflowBulkActions';
import { EnhancedWorkflowList } from '@/components/EnhancedWorkflowList';

export const runtime = 'edge';

export default async function WorkflowSearchPage() {
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
      metadata: { attemptedAccess: 'workflow-search' }
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
  let userTenants: Array<{ id: string; name: string }> = [];
  if (!isAdmin) {
    const tenantResult = await db.prepare(`
      SELECT DISTINCT t.Id as id, t.Name as name
      FROM Tenants t
      JOIN TenantUsers tu ON t.Id = tu.TenantId
      WHERE tu.Email = ?
      ORDER BY t.Name
    `).bind(session.user.email).all() as { results: { id: string; name: string }[] };
    userTenants = tenantResult.results || [];
  }

  // Log successful access
  await systemLogs.createLog({
    logType: 'ACTIVITY',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'ACCESS_WORKFLOW_SEARCH'
  });

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              Workflow Search & Management
            </Heading>
            <Text color="gray" size="3">
              Advanced workflow search, filtering, and bulk management
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

      <EnhancedWorkflowList 
        userEmail={session.user.email}
        isGlobalAdmin={isAdmin}
        accessibleTenants={accessibleTenants}
        userTenants={userTenants}
      />

      <Box style={{ marginTop: '2rem' }}>
        <Text size="2" color="gray">
          Use the search and filter options above to find specific workflows. Select multiple workflows to perform bulk operations.
        </Text>
      </Box>
    </Container>
  );
} 