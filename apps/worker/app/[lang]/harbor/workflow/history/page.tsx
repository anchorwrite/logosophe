import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Box, Flex, Heading, Text, Card, Button, Badge } from "@radix-ui/themes";
import Link from "next/link";
import type { Locale } from '@/types/i18n';
import { checkAccess } from '@/lib/access-control';
import { getRequestContext } from '@/lib/request-context';
import { WorkflowHistoryClient } from './WorkflowHistoryClient';
import { getDictionary } from '@/lib/dictionary';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type Params = Promise<{ lang: Locale }>;

export default async function HarborWorkflowHistoryPage({ params }: { params: Params }) {
  const session = await auth();
  const { lang } = await params;
  const dict = await getDictionary(lang);
  
  console.log('Workflow history page - User email:', session?.user?.email);
  
  if (!session?.user?.email) {
    console.log('Workflow history page - No session, redirecting to signin');
    redirect('/signin');
  }

  // Use proper access control that checks all roles
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
  });

  console.log('Workflow history page - Access result:', access);

  if (!access.hasAccess) {
    console.log('Workflow history page - Access denied, redirecting to harbor');
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

  console.log('Workflow history page - User tenant result:', userTenantResult);

  if (!userTenantResult?.TenantId) {
    console.log('Workflow history page - No tenant found, redirecting to harbor');
    redirect(`/${lang}/harbor`);
  }

  const userTenantId = userTenantResult.TenantId;

  return (
    <Box style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '0 1rem' }}>
      <Flex direction="column" gap="6">
        <Flex align="center" gap="4" mb="4">
          <Button variant="soft" asChild>
            <Link href={`/${lang}/harbor/workflow`}>
              ← Back to Workflows
            </Link>
          </Button>
          <Heading size="6">{(dict as any).workflow.history.title}</Heading>
        </Flex>

        <WorkflowHistoryClient 
          userEmail={session.user.email}
          userTenantId={userTenantId}
          lang={lang}
        />
      </Flex>
    </Box>
  );
} 