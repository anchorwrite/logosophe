import { auth } from '@/auth'
import Link from 'next/link';
import { Box, Card, Flex, Grid, Heading, Text } from '@radix-ui/themes';
import { checkAccess } from '@/lib/access-control';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';


export default async function DashboardPage() {
  const session = await auth()
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant']
  });

  if (!access.hasAccess) {
    redirect('/harbor');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const isAdmin = session?.user?.email ? await isSystemAdmin(session.user.email, db) : false;

  const contentManagementLinks = [

    { href: '/dashboard/media', label: 'Media Library', roles: ['admin', 'tenant'] },
    { href: '/dashboard/media/shares', label: 'Media Share Links', roles: ['admin', 'tenant'] },
    { href: '/dashboard/media/upload', label: 'Upload Media', roles: ['admin', 'tenant'] },
    { href: '/dashboard/soft-deleted-files', label: 'Soft-Deleted Files', roles: ['admin', 'tenant'] },

  ].sort((a, b) => a.label.localeCompare(b.label));



  const accessManagementLinks = [
    { href: '/dashboard/logs', label: 'System Logs', roles: ['admin', 'tenant'] },
    { href: '/dashboard/roles', label: 'Roles & Permissions', roles: ['admin'] },
    { href: '/dashboard/subscribers', label: 'Subscribers', roles: ['admin', 'tenant'] },
            { href: '/dashboard/test-users', label: 'Test Users', roles: ['admin'] }
  ].sort((a, b) => a.label.localeCompare(b.label));

  const mediatedAccessManagementLinks = [
    { href: '/dashboard/subscriber-add', label: 'Subscriber Add', roles: ['admin', 'tenant'] },
    { href: '/dashboard/subscriber-update', label: 'Subscriber Update', roles: ['admin', 'tenant'] },
    { href: '/dashboard/subscriber-delete', label: 'Subscriber Delete', roles: ['admin', 'tenant'] },
    { href: '/dashboard/tenant', label: 'Tenant Management', roles: ['admin', 'tenant'] },
    { href: '/dashboard/user-management', label: 'User Management', roles: ['admin', 'tenant'] },
    { href: '/dashboard/avatars', label: 'Preset Avatars', roles: ['admin', 'tenant'] },
    { href: '/dashboard/admin-users', label: 'Administrative Users', roles: ['admin'] }
  ].sort((a, b) => a.label.localeCompare(b.label));

  const collaborationLinks = [
    { href: '/dashboard/messaging', label: 'Messaging System', roles: ['admin', 'tenant'] },
    { href: '/dashboard/messaging/interface', label: 'Messaging Interface', roles: ['admin', 'tenant'] },
    { href: '/dashboard/messaging/messages', label: 'Message Management', roles: ['admin', 'tenant'] },
    { href: '/dashboard/messaging/blocks', label: 'User Blocks', roles: ['admin', 'tenant'] },
    { href: '/dashboard/messaging/recipients', label: 'Recipients', roles: ['admin', 'tenant'] },
    { href: '/dashboard/messaging/system', label: 'System Controls', roles: ['admin'] },
    { href: '/dashboard/workflow', label: 'Workflow System', roles: ['admin', 'tenant'] },
    { href: '/dashboard/workflow/settings', label: 'Workflow Settings', roles: ['admin'] }
  ].sort((a, b) => a.label.localeCompare(b.label));

  // Filter links based on user role
  const filterLinks = (links: typeof contentManagementLinks) => 
    links.filter(link => link.roles.includes(access.role as 'admin' | 'tenant'));

  const filteredContentManagementLinks = filterLinks(contentManagementLinks);
  const filteredAccessManagementLinks = filterLinks(accessManagementLinks);
  const filteredMediatedAccessManagementLinks = filterLinks(mediatedAccessManagementLinks);
  const filteredCollaborationLinks = filterLinks(collaborationLinks);

  return (
    <Flex direction="column" align="center" style={{ minHeight: '60vh' }} gap="6">
      <Box style={{ textAlign: 'center' }}>
        <Box mb="6">
          <Heading size="8">Dashboard</Heading>
        </Box>
        {session ? (
          <Text size="5">You are signed in as {session.user?.email}.</Text>
        ) : (
          <Text size="5">
            Please <Link href="/signin" style={{ color: 'var(--blue-11)', textDecoration: 'underline' }}>sign in</Link> to access the dashboard.
          </Text>
        )}
      </Box>

      {session && (
        <>
          {filteredContentManagementLinks.length > 0 && (
            <Card size="3" style={{ width: '100%', maxWidth: '64rem' }}>
              <Box p="4" style={{ textAlign: 'center' }}>
                <Heading size="5">Content Management</Heading>
              </Box>
              <Box p="4">
                <Grid columns="3" gap="4">
                  {filteredContentManagementLinks.map((link) => (
                    <Link 
                      key={link.href}
                      href={link.href}
                      style={{
                        color: 'var(--blue-11)',
                        textDecoration: 'underline',
                        fontSize: '1.125rem',
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        transition: 'background-color 0.2s',
                      }}
                      className="hover:bg-gray-3"
                    >
                      {link.label}
                    </Link>
                  ))}
                </Grid>
              </Box>
            </Card>
          )}



          {filteredAccessManagementLinks.length > 0 && (
            <Card size="3" style={{ width: '100%', maxWidth: '64rem' }}>
              <Box p="4" style={{ textAlign: 'center' }}>
                <Heading size="5">Access Management (Direct)</Heading>
              </Box>
              <Box p="4">
                <Grid columns="3" gap="4">
                  {filteredAccessManagementLinks.map((link) => (
                    <Link 
                      key={link.href}
                      href={link.href}
                      style={{
                        color: 'var(--blue-11)',
                        textDecoration: 'underline',
                        fontSize: '1.125rem',
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        transition: 'background-color 0.2s',
                      }}
                      className="hover:bg-gray-3"
                    >
                      {link.label}
                    </Link>
                  ))}
                </Grid>
              </Box>
            </Card>
          )}

          {filteredMediatedAccessManagementLinks.length > 0 && (
            <Card size="3" style={{ width: '100%', maxWidth: '64rem' }}>
              <Box p="4" style={{ textAlign: 'center' }}>
                <Heading size="5">Access Management (Mediated)</Heading>
              </Box>
              <Box p="4">
                <Grid columns="3" gap="4">
                  {filteredMediatedAccessManagementLinks.map((link) => (
                    <Link 
                      key={link.href}
                      href={link.href}
                      style={{
                        color: 'var(--blue-11)',
                        textDecoration: 'underline',
                        fontSize: '1.125rem',
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        transition: 'background-color 0.2s',
                      }}
                      className="hover:bg-gray-3"
                    >
                      {link.label}
                    </Link>
                  ))}
                </Grid>
              </Box>
            </Card>
          )}

          {filteredCollaborationLinks.length > 0 && (
            <Card size="3" style={{ width: '100%', maxWidth: '64rem' }}>
              <Box p="4" style={{ textAlign: 'center' }}>
                <Heading size="5">Collaboration</Heading>
              </Box>
              <Box p="4">
                <Grid columns="3" gap="4">
                  {filteredCollaborationLinks.map((link) => (
                    <Link 
                      key={link.href}
                      href={link.href}
                      style={{
                        color: 'var(--blue-11)',
                        textDecoration: 'underline',
                        fontSize: '1.125rem',
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        transition: 'background-color 0.2s',
                      }}
                      className="hover:bg-gray-3"
                    >
                      {link.label}
                    </Link>
                  ))}
                </Grid>
              </Box>
            </Card>
          )}
        </>
      )}
    </Flex>
  );
}
