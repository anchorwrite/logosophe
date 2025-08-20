import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { Box, Flex, Heading, Button, Card, Text, Badge } from '@radix-ui/themes';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import type { Locale } from '@/types/i18n';
import { getDictionary } from '@/lib/dictionary';
import { SubscriberAnalytics } from '@/components/harbor/analytics/SubscriberAnalytics';

type Params = Promise<{ lang: Locale }>;

export default async function HarborAnalyticsPage({ params }: { params: Params }) {
  const session = await auth();
  const { lang } = await params;
  const dict = await getDictionary(lang);
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  // Check if user has subscriber role
  const access = await checkAccess({
    requireAuth: true,
    allowedRoles: ['subscriber']
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
          <Heading size="5">{dict.harbor.contentAnalytics}</Heading>
          <Box style={{ width: '120px' }} /> {/* Spacer for alignment */}
        </Flex>
        <SubscriberAnalytics lang={lang} dict={dict} />
      </Box>
    </Flex>
  );
}
