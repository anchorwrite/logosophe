import { auth } from '@/auth'
import { redirect } from 'next/navigation';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';
import { Box, Card, Flex, Grid, Heading, Text } from '@radix-ui/themes';
import PresetAvatarsManager from './PresetAvatarsManager';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge'

export default async function PresetAvatarsPage() {
  const session = await auth()
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin']
  });

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;

  if (!access.hasAccess || !session?.user?.email || !(await isSystemAdmin(session.user.email, db))) {
    redirect('/dashboard');
  }

  return (
    <Flex direction="column" align="center" style={{ minHeight: '60vh' }} gap="6">
      <Box style={{ textAlign: 'center' }}>
        <Box mb="6">
          <Heading size="8">Preset Avatars Management</Heading>
        </Box>
        <Text size="5">Manage system-wide preset avatars</Text>
      </Box>

      <Card size="3" style={{ width: '100%', maxWidth: '64rem' }}>
        <Box p="4">
          <PresetAvatarsManager session={session} />
        </Box>
      </Card>
    </Flex>
  );
} 