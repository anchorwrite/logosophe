import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Box, Flex, Heading, Text, Card, Button } from "@radix-ui/themes";
import Link from "next/link";
import type { Locale } from '@/types/i18n';
import { getDictionary } from '@/lib/dictionary';
import { getRequestContext } from '@/lib/request-context';
import { WorkflowStats } from '@/components/harbor/workflow/WorkflowStats';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type Params = Promise<{ lang: Locale }>;

export default async function HarborWorkflowPage({ params }: { params: Params }) {
  const session = await auth();
  const { lang } = await params;
  const dict = await getDictionary(lang);
  
  console.log('Workflow page - User email:', session?.user?.email);
  console.log('Workflow page - User role:', session?.user?.role);
  
  if (!session?.user?.email) {
    console.log('Workflow page - No session, redirecting to signin');
    redirect('/signin');
  }

  // Only subscribers can access this page
  if (session.user.role !== 'subscriber') {
    console.log('Workflow page - User role is not subscriber, redirecting to harbor');
    redirect(`/${lang}/harbor`);
  }

  // Get user's primary tenant information
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const userTenantQuery = `
    SELECT tu.TenantId, tu.RoleId, t.Name as TenantName
    FROM TenantUsers tu
    LEFT JOIN Tenants t ON tu.TenantId = t.Id
    WHERE tu.Email = ?
  `;

  const userTenantResult = await db.prepare(userTenantQuery)
    .bind(session.user.email)
    .first() as any;

  console.log('Workflow page - User tenant result:', userTenantResult);

  if (!userTenantResult?.TenantId) {
    console.log('Workflow page - No tenant found, redirecting to harbor');
    redirect(`/${lang}/harbor`);
  }

  const userTenantId = userTenantResult.TenantId;

  return (
    <Flex direction="column" align="center" gap="6">
      <Box p="6">
        <Heading size="7" align="center" mb="4">{(dict as any).workflow.title}</Heading>
        <Text size="5" align="center" color="gray" mb="6">
          {(dict as any).workflow.description}
        </Text>
        
        <Flex gap="4" wrap="wrap" justify="center">
          {/* Active Workflows */}
          <Card style={{ flex: '1', minWidth: '300px', maxWidth: '400px' }}>
            <Box p="4">
              <Heading size="4" mb="3">{(dict as any).workflow.activeWorkflows}</Heading>
              <Text color="gray" size="2" mb="4">
                {(dict as any).workflow.activeWorkflowsDescription}
              </Text>
              <Button asChild style={{ width: '100%' }}>
                <Link href={`/${lang}/harbor/workflow/active`}>
                  {(dict as any).workflow.viewActiveWorkflows}
                </Link>
              </Button>
            </Box>
          </Card>

          {/* Create Workflow */}
          <Card style={{ flex: '1', minWidth: '300px', maxWidth: '400px' }}>
            <Box p="4">
              <Heading size="4" mb="3">{(dict as any).workflow.createWorkflow}</Heading>
              <Text color="gray" size="2" mb="4">
                {(dict as any).workflow.createWorkflowDescription}
              </Text>
              <Button asChild style={{ width: '100%' }}>
                <Link href={`/${lang}/harbor/workflow/create`}>
                  {(dict as any).workflow.createNewWorkflow}
                </Link>
              </Button>
            </Box>
          </Card>

          {/* Workflow History */}
          <Card style={{ flex: '1', minWidth: '300px', maxWidth: '400px' }}>
            <Box p="4">
              <Heading size="4" mb="3">{(dict as any).workflow.history.title}</Heading>
              <Text color="gray" size="2" mb="4">
                {(dict as any).workflow.history.description}
              </Text>
              <Button asChild style={{ width: '100%' }}>
                <Link href={`/${lang}/harbor/workflow/history`}>
                  {(dict as any).workflow.history.viewHistory}
                </Link>
              </Button>
            </Box>
          </Card>
        </Flex>

        {/* Quick Stats */}
        <Box mt="6" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Box style={{ maxWidth: '800px', width: '100%' }}>
            <Heading size="4" mb="4" align="center">{(dict as any).workflow.quickOverview}</Heading>
            <WorkflowStats 
              userEmail={session.user.email}
              userTenantId={userTenantId}
              dict={dict}
            />
          </Box>
        </Box>
      </Box>
    </Flex>
  );
} 