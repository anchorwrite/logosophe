"use client";

import Link from "next/link";
import { SvgIcon } from "@/common/SvgIcon";
import { Button, Flex, Box, Badge } from "@radix-ui/themes";
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import type { Locale } from '@/types/i18n';
import SubscriberOptIn from "@/components/SubscriberOptIn";
import SubscriberOptOut from "@/components/SubscriberOptOut";
import { PreferencesButton } from "@/components/PreferencesButton";
import { useMessaging } from '@/contexts/MessagingContext';
import { useWorkflowMessaging } from '@/contexts/WorkflowMessagingContext';
import { UnreadMessageBadge } from '@/components/harbor/UnreadMessageBadge';
import { UnreadWorkflowBadge } from '@/components/harbor/UnreadWorkflowBadge';
import { ConnectionStatusIndicator } from '@/components/harbor/ConnectionStatusIndicator';


interface ProviderResponse {
  provider: string;
}


function HarborAppBar({ lang }: { lang: Locale }) {
  const { t, i18n } = useTranslation('translations');
  const [isLoading, setIsLoading] = useState(true);
  const [provider, setProvider] = useState<string>('');
  const { unreadCount } = useMessaging();
  const { unreadCount: workflowUnreadCount } = useWorkflowMessaging();


  const { data: session } = useSession();

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        const response = await fetch('/api/user/provider');
        if (!response.ok) {
          throw new Error('Failed to fetch provider');
        }
        const data = await response.json() as ProviderResponse;
        setProvider(data.provider);
      } catch (error) {
        console.error('Error fetching provider:', error);
      }
    };



    if (i18n.isInitialized) {
      setIsLoading(false);
      if (session?.user) {
        fetchProvider();
      }
    }
  }, [i18n.isInitialized, session]);

  if (isLoading) {
    return null;
  }

  return (
    <Flex justify="between" align="center" style={{ width: '100%' }}>
      <Link href={`/${lang}`} aria-label="homepage">
        <Box style={{ display: 'flex', alignItems: 'center', position: 'relative', marginBottom: '-8px', zIndex: 10 }}>
          <SvgIcon src="/img/svg/logo.svg" width="101px" height="64px" />
        </Box>
      </Link>
      {/* Connection Status Indicator */}
      {session?.user?.role === 'subscriber' && (
        <Flex align="center" gap="4" style={{ marginLeft: '1rem' }}>
          <ConnectionStatusIndicator size="small" showText={false} />
          <UnreadMessageBadge />
          <UnreadWorkflowBadge />
        </Flex>
      )}
      <Flex gap="4" align="center" p="2">
        {session?.user ? (
          <>
            <Button variant="ghost" asChild>
              <Link href={`/${lang}/harbor`}>
                {t('harbor.nav.harbor')}
              </Link>
            </Button>
            {session.user.role === 'subscriber' && (
              <>
                <SubscriberOptOut email={session.user.email as string} />
              </>
            )}
            <Button variant="ghost" asChild>
              <Link href={`/${lang}/harbor/profile`}>
                {t('harbor.nav.profile')}
              </Link>
            </Button>
            <PreferencesButton />
            <Button variant="ghost" asChild>
              <Link href="/signout">
                {t('auth.signOut')}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <PreferencesButton />
            <Button variant="ghost" asChild>
              <Link href="/signin">
                {t('auth.signIn')}
              </Link>
            </Button>
          </>
        )}
      </Flex>
    </Flex>
  );
}

export default HarborAppBar; 