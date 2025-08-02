import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { MediaLibrary } from '@/components/harbor/media/MediaLibrary';
import { Box, Flex, Heading, Button } from '@radix-ui/themes';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import type { Locale } from '@/types/i18n';
import { getDictionary } from '@/lib/dictionary';

type Params = Promise<{ lang: Locale }>;

export default async function HarborMediaPage({ params }: { params: Params }) {
  const session = await auth();
  const { lang } = await params;
  const dict = await getDictionary(lang);
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  // Check if user has any roles that allow media access
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['admin', 'tenant', 'editor', 'author', 'subscriber', 'agent', 'reviewer', 'user']
  });

  if (!access.hasAccess) {
    redirect(`/${lang}/harbor`);
  }

  return (
    <Flex direction="column" align="center" gap="4">
      <Box p="4" style={{ width: '100%', maxWidth: '64rem' }}>
        <Flex justify="between" align="center" mb="4">
          <Link href={`/${lang}/harbor`}>
            <Button variant="soft">
              <ArrowLeft className="mr-2" />
              {dict.harbor.backToHarbor}
            </Button>
          </Link>
          <Heading size="5">{dict.harbor.mediaLibrary}</Heading>
          <Link href={`/${lang}/harbor/media/upload`}>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {dict.harbor.uploadMedia}
            </Button>
          </Link>
        </Flex>
        <MediaLibrary />
      </Box>
    </Flex>
  );
} 