import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Box, Flex, Heading, Text, Card, Button } from "@radix-ui/themes";
import Link from "next/link";
import type { Locale } from '@/types/i18n';
import { CreateWorkflowClient } from './CreateWorkflowClient';
import { getCloudflareContext } from '@opennextjs/cloudflare';

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
  
  console.log('Create workflow page - User email:', session?.user?.email);
  console.log('Create workflow page - User role:', session?.user?.role);
  
  if (!session?.user?.email) {
    console.log('Create workflow page - No session, redirecting to signin');
    redirect('/signin');
  }

  // Only subscribers can access this page
  if (session.user.role !== 'subscriber') {
    console.log('Create workflow page - User role is not subscriber, redirecting to harbor');
    redirect(`/${lang}/harbor`);
  }

  // Get user's tenant information
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // Get all user tenants and roles
  const userTenantsQuery = `
    SELECT 
      tu.TenantId, 
      t.Name as TenantName,
      ur.RoleId,
      r.Name as RoleName
    FROM TenantUsers tu
    LEFT JOIN Tenants t ON tu.TenantId = t.Id
    LEFT JOIN UserRoles ur ON tu.Email = ur.Email AND tu.TenantId = ur.TenantId
    LEFT JOIN Roles r ON ur.RoleId = r.Id
    WHERE tu.Email = ?
    ORDER BY t.Name, r.Name
  `;

  const userTenantsResult = await db.prepare(userTenantsQuery)
    .bind(session.user.email)
    .all() as any;

  console.log('Create workflow page - User tenants result:', userTenantsResult);

  if (!userTenantsResult?.results || userTenantsResult.results.length === 0) {
    console.log('Create workflow page - No tenants found, redirecting to harbor');
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