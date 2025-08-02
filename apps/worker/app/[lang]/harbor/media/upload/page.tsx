import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { checkAccess } from '@/lib/access-control';
import { getDictionary } from '@/lib/dictionary';
import { HarborMediaUpload } from '@/components/harbor/media/HarborMediaUpload';
import { Box, Flex, Heading, Text, Button } from '@radix-ui/themes';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Locale } from '@/types/i18n';

type Params = Promise<{ lang: Locale }>;

export default async function HarborMediaUploadPage({ params }: { params: Params }) {
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
          <Heading size="5">{dict.harbor.uploadMedia}</Heading>
          <Box style={{ width: 100 }} /> {/* Spacer for alignment */}
        </Flex>
        <Box style={{ textAlign: 'center' }} mb="4">
          <Text as="p" size="2" color="gray">
            {(dict as any).harbor.media.uploadDescription}
          </Text>
        </Box>
        <HarborMediaUpload />
      </Box>
    </Flex>
  );
} 