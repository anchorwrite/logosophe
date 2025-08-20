import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserWorkflowTenants } from '@/lib/workflow';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';
import { Container, Heading, Text, Box, Flex, Button } from '@radix-ui/themes';
import Link from 'next/link';
import { DashboardWorkflowList } from '@/components/DashboardWorkflowList';


export default async function ActiveWorkflowsPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const normalizedLogging = new NormalizedLogging(db);

  // Check if user has admin access
  const isAdmin = await isSystemAdmin(session.user.email, db);
  
  // Get user's accessible tenants for workflow access
  const accessibleTenants = await getUserWorkflowTenants(session.user.email);
  
  if (!isAdmin && accessibleTenants.length === 0) {
    // Log unauthorized access attempt
    await normalizedLogging.logSystemOperations({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'unauthorized_workflow_access',
      accessType: 'admin',
      targetId: 'workflow-active',
      targetName: 'Active Workflows Page',
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { attemptedAccess: 'workflow-active' }
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
  await normalizedLogging.logSystemOperations({
    userEmail: session.user.email,
    tenantId: 'system',
    activityType: 'access_active_workflows',
    accessType: 'admin',
    targetId: 'workflow-active',
    targetName: 'Active Workflows Page',
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
              Active Workflows
            </Heading>
            <Text color="gray" size="3">
              Monitor currently active workflows across your organization
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

      <DashboardWorkflowList 
        userEmail={session.user.email}
        isGlobalAdmin={isAdmin}
        accessibleTenants={accessibleTenants}
        status="active"
        title="Active Workflows"
        showPagination={true}
      />


    </Container>
  );
} 