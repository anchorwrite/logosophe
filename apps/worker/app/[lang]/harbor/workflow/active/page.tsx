import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { Box, Flex, Heading, Text, Card, Button, Badge } from "@radix-ui/themes";
import Link from "next/link";
import type { Locale } from '@/types/i18n';
import { ActiveWorkflowsClient } from './ActiveWorkflowsClient';
import { getRequestContext } from '@/lib/request-context';
import { checkAccess } from '@/lib/access-control';
import { getDictionary } from '@/lib/dictionary';

type Params = Promise<{ lang: Locale }>;

export default async function HarborWorkflowActivePage({ params }: { params: Params }) {
  const session = await auth();
  const { lang } = await params;
  const dict = await getDictionary(lang);
  
  console.log('Active workflows page - User email:', session?.user?.email);
  
  if (!session?.user?.email) {
    console.log('Active workflows page - No session, redirecting to signin');
    redirect('/signin');
  }

  // Use proper access control that checks all roles
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant', 'author', 'editor', 'agent', 'reviewer', 'subscriber']
  });

  console.log('Active workflows page - Access result:', access);

  if (!access.hasAccess) {
    console.log('Active workflows page - Access denied, redirecting to harbor');
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

  console.log('Active workflows page - User tenant result:', userTenantResult);

  if (!userTenantResult?.TenantId) {
    console.log('Active workflows page - No tenant found, redirecting to harbor');
    redirect(`/${lang}/harbor`);
  }

  const userTenantId = userTenantResult.TenantId;

  return (
    <Flex direction="column" align="center" gap="6">
      <Box p="6" style={{ width: '100%', maxWidth: '1000px' }}>
        <Flex align="center" gap="4" mb="6">
          <Button variant="soft" asChild>
            <Link href={`/${lang}/harbor/workflow`}>
              ← Back to Workflows
            </Link>
          </Button>
          <Heading size="6">{(dict as any).workflow.activeWorkflows}</Heading>
        </Flex>

        <ActiveWorkflowsClient 
          userEmail={session.user.email}
          userTenantId={userTenantId}
          lang={lang}
          dict={dict}
        />
      </Box>
    </Flex>
  );
} 