import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { getUserWorkflowTenants } from '@/lib/workflow';
import { SystemLogs } from '@/lib/system-logs';
import { Container, Heading, Text, Box } from '@radix-ui/themes';
import { DashboardWorkflowDetails } from '@/components/DashboardWorkflowDetails';


interface WorkflowDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowDetailsPage({
  params
}: WorkflowDetailsPageProps) {
  const { id } = await params;
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
      activityType: 'UNAUTHORIZED_WORKFLOW_ACCESS',
      metadata: { attemptedAccess: 'workflow-details', workflowId: id }
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

  // If tenant admin, verify they have access to this workflow's tenant
  if (!isAdmin) {
    const workflowTenant = await db.prepare(`
      SELECT w.TenantId
      FROM Workflows w
      WHERE w.Id = ?
    `).bind(id).first() as { TenantId: string } | null;

    if (!workflowTenant) {
      redirect('/dashboard/workflow');
    }

    const userTenantAccess = await db.prepare(`
      SELECT 1 FROM TenantUsers tu
      WHERE tu.Email = ? AND tu.TenantId = ?
    `).bind(session.user.email, workflowTenant.TenantId).first();

    if (!userTenantAccess) {
      redirect('/dashboard/workflow');
    }
  }

  // Log successful access
  await systemLogs.createLog({
    logType: 'activity',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'ACCESS_WORKFLOW_DETAILS',
    targetId: id,
    metadata: { workflowId: id }
  });

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="6" style={{ marginBottom: '0.5rem' }}>
          Workflow Details
        </Heading>
        <Text color="gray" size="3">
          Monitor and manage workflow information
        </Text>
      </Box>

      <DashboardWorkflowDetails 
        workflowId={id}
        userEmail={session.user.email}
        isGlobalAdmin={isAdmin}
      />
    </Container>
  );
} 