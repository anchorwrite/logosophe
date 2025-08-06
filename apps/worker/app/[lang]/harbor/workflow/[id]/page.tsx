import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { Box, Flex, Heading, Text, Card, Button, Badge } from "@radix-ui/themes";
import Link from "next/link";
import type { Locale } from '@/types/i18n';
import { checkAccess } from '@/lib/access-control';
import { getRequestContext } from '@/lib/request-context';
import { WorkflowDetailClient } from './WorkflowDetailClient';
import { getDictionary } from '@/lib/dictionary';

type Params = Promise<{ lang: Locale; id: string }>;

export default async function HarborWorkflowDetailPage({ params }: { params: Params }) {
  let session;
  try {
    session = await auth();
  } catch (error) {
    console.error('Workflow detail page - Auth error:', error);
    // If auth fails, redirect to signin
    redirect('/signin');
  }
  
  const { lang, id } = await params;
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

  // Get user's tenant information using UserRoles table
  let userTenantResult;
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const userTenantQuery = `
      SELECT ur.TenantId, ur.RoleId, t.Name as TenantName
      FROM UserRoles ur
      LEFT JOIN Tenants t ON ur.TenantId = t.Id
      WHERE ur.Email = ?
    `;

    userTenantResult = await db.prepare(userTenantQuery)
      .bind(session.user.email)
      .first() as any;
  } catch (error) {
    console.error('Workflow detail page - Database error:', error);
    // If database query fails, redirect to harbor
    redirect(`/${lang}/harbor`);
  }

  if (!userTenantResult?.TenantId) {
    redirect(`/${lang}/harbor`);
  }

  const userTenantId = userTenantResult.TenantId;

  return (
    <Box style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '0 1rem' }}>
      <Flex direction="column" gap="6">
        <Flex align="center" gap="4" mb="4">
          <Button variant="soft" asChild>
            <Link href={`/${lang}/harbor/workflow/active`}>
              ← {(dict as any).workflow?.history?.detail?.backToActive || 'Back to Active Workflows'}
            </Link>
          </Button>
          <Heading size="6">{(dict as any).workflow?.history?.detail?.title || 'Workflow Details'}</Heading>
        </Flex>

        <WorkflowDetailClient 
          workflowId={id}
          userEmail={session.user.email}
          userTenantId={userTenantId}
          lang={lang}
          dict={dict}
        />
      </Flex>
    </Box>
  );
} 