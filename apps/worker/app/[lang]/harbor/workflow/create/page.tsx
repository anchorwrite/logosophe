import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Box, Flex, Heading, Text, Card, Button } from "@radix-ui/themes";
import Link from "next/link";
import type { Locale } from '@/types/i18n';
import { CreateWorkflowClient } from './CreateWorkflowClient';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';

type Params = Promise<{ lang: Locale }>;

interface UserTenant {
  tenantId: string;
  tenantName: string;
  roleId: string;
  roleName: string;
}

export default async function HarborWorkflowCreatePage({ params }: { params: Params }) {
  const session = await auth();
  const { lang } = await params;
  
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
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // Get all user tenants and roles from UserRoles table
  const userTenantsQuery = `
    SELECT 
      ur.TenantId, 
      t.Name as TenantName,
      ur.RoleId,
      r.Name as RoleName
    FROM UserRoles ur
    LEFT JOIN Tenants t ON ur.TenantId = t.Id
    LEFT JOIN Roles r ON ur.RoleId = r.Id
    WHERE ur.Email = ?
    ORDER BY t.Name, r.Name
  `;

  const userTenantsResult = await db.prepare(userTenantsQuery)
    .bind(session.user.email)
    .all() as any;

  if (!userTenantsResult?.results || userTenantsResult.results.length === 0) {
    redirect(`/${lang}/harbor`);
  }

  // Process the results to get unique tenant-role combinations
  const userTenants: UserTenant[] = [];
  const seen = new Set<string>();
  
  for (const row of userTenantsResult.results) {
    const key = `${row.TenantId}-${row.RoleId}`;
    if (!seen.has(key)) {
      seen.add(key);
      userTenants.push({
        tenantId: row.TenantId,
        tenantName: row.TenantName,
        roleId: row.RoleId,
        roleName: row.RoleName
      });
    }
  }

  // If user has only one tenant-role combination, use it as default
  const defaultTenant = userTenants.length === 1 ? userTenants[0] : null;

  return (
    <Flex direction="column" align="center" gap="6">
      <Box p="6" style={{ width: '100%', maxWidth: '800px' }}>
        <Flex align="center" gap="4" mb="6">
          <Button variant="soft" asChild>
            <Link href={`/${lang}/harbor/workflow`}>
              ← Back to Workflows
            </Link>
          </Button>
          <Heading size="6">Create Workflow</Heading>
        </Flex>

        <CreateWorkflowClient 
          userEmail={session.user.email}
          userTenants={userTenants}
          defaultTenant={defaultTenant}
          lang={lang}
        />
      </Box>
    </Flex>
  );
} 