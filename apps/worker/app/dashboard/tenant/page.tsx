import TenantManagement from './TenantManagement';
import { Container, Box, Heading, Text } from '@radix-ui/themes';
import { checkAccess } from '@/lib/access-control';
import { getUserTenants, isSystemAdmin } from '@/lib/access';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export default async function TenantPage() {
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant']
  });

  if (!access.hasAccess) {
    return new Response('Unauthorized', { status: 401 });
  }

  const session = await auth();
  const tenants = await getUserTenants(session?.user?.email!);

  // Properly check if user is a system admin
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const isAdmin = session?.user?.email ? await isSystemAdmin(session.user.email, db) : false;

  return (
    <Container size="3">
      <Box py="6">
        <Box mb="6">
          <Heading align="center" size="6">Tenant Management</Heading>
          <Text as="p" align="center" color="gray" mt="2">
            Manage tenants, their users, and roles
          </Text>
        </Box>
        <TenantManagement 
          isSystemAdmin={isAdmin} 
          tenants={tenants}
        />
      </Box>
    </Container>
  );
} 