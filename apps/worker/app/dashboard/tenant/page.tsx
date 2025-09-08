import TenantManagement from './TenantManagement';
import { Container, Box, Heading, Text } from '@radix-ui/themes';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';


export default async function TenantPage() {
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant']
  });

  if (!access.hasAccess) {
    return (
      <Container size="3">
        <Box py="6">
          <Heading align="center" size="6">Unauthorized</Heading>
          <Text as="p" align="center" color="gray" mt="2">
            You do not have permission to access this page.
          </Text>
        </Box>
      </Container>
    );
  }

  const session = await auth();
  
  // Get user's accessible tenants
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const isAdmin = session?.user?.email ? await isSystemAdmin(session.user.email, db) : false;
  
  let tenants: Array<{ Id: string; Name: string; Description: string; CreatedAt: string; UpdatedAt: string }> = [];
  
  if (isAdmin) {
    // System admins have access to all tenants
    const tenantsResult = await db.prepare(`
      SELECT Id, Name, Description, CreatedAt, UpdatedAt FROM Tenants
    `).all();
    tenants = (tenantsResult.results || []) as Array<{ Id: string; Name: string; Description: string; CreatedAt: string; UpdatedAt: string }>;
  } else if (session?.user?.email) {
    // Get tenants where user is a member
    const tenantsResult = await db.prepare(`
      SELECT t.Id, t.Name, t.Description, t.CreatedAt, t.UpdatedAt
      FROM Tenants t
      JOIN TenantUsers tu ON t.Id = tu.TenantId
      WHERE tu.Email = ?
    `).bind(session.user.email).all();
    tenants = (tenantsResult.results || []) as Array<{ Id: string; Name: string; Description: string; CreatedAt: string; UpdatedAt: string }>;
  }

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