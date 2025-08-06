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
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  // Use proper access control that checks all roles
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
  });

  if (!access.hasAccess) {
    redirect(`/${lang}/harbor`);
  }

  // Get user's primary tenant information using UserRoles table
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const userTenantQuery = `
    SELECT ur.TenantId, ur.RoleId, t.Name as TenantName
    FROM UserRoles ur
    LEFT JOIN Tenants t ON ur.TenantId = t.Id
    WHERE ur.Email = ?
  `;

  const userTenantResult = await db.prepare(userTenantQuery)
    .bind(session.user.email)
    .first() as any;

  if (!userTenantResult?.TenantId) {
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