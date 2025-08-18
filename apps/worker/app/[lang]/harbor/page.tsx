"use client";

import { redirect } from "next/navigation";
import SubscriberOptIn from "@/components/SubscriberOptIn";
import HarborLinks from "@/components/HarborLinks";
import AuthenticationMessage from "@/components/AuthenticationMessage";
import { Box, Flex, Heading, Text } from "@radix-ui/themes";
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import type { Locale } from '@/types/i18n';

type Params = Promise<{ lang: Locale }>;

export default function HarborPage({ params }: { params: Params }) {
  const { t, i18n } = useTranslation('translations');
  const [isLoading, setIsLoading] = useState(true);
  const [lang, setLang] = useState<Locale>('en');
  const { data: session, status, update } = useSession();

  // Force session refresh if status is unauthenticated but we expect to be authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      // Try to refresh the session to handle timing issues with test users
      update().catch((error) => {
        console.error('Session refresh error:', error);
      });
    }
  }, [status, update]);

  useEffect(() => {
    const init = async () => {
      const { lang: resolvedLang } = await params;
      setLang(resolvedLang);
      if (i18n.isInitialized) {
        setIsLoading(false);
      }
    };
    init();
  }, [params, i18n.isInitialized]);

  if (isLoading || status === "loading") {
    return (
      <Flex direction="column" align="center" gap="6">
        <Box p="6">
          <Heading size="7" align="center" mb="4">{t('harbor.setupAccount')}</Heading>
          <Text size="5" align="center" color="gray">{t('common.loading')}</Text>
        </Box>
      </Flex>
    );
  }

  if (status === "unauthenticated") {
    redirect('/signin');
  }

  if (!session?.user.role) {
    return (
      <Flex direction="column" align="center" gap="6">
        <Box p="6">
          <Heading size="7" align="center" mb="4">{t('harbor.accessDenied')}</Heading>
          <Text size="5" align="center" color="gray">{t('harbor.needRole')}</Text>
        </Box>
      </Flex>
    );
  }

  if (session.user.role !== 'subscriber') {
    return (
      <Flex direction="column" align="center" gap="6">
        <Box p="6">
          <Heading size="7" align="center" mb="4">{t('harbor.welcome')}</Heading>
          <SubscriberOptIn email={session.user.email as string} />
        </Box>
      </Flex>
    );
  }

  return (
    <Flex direction="column" align="center" gap="6">
      <Box p="6">
        <Heading size="7" align="center" mb="4">{t('harbor.welcome')}</Heading>
        <Flex direction="column" gap="4" align="center">
          <AuthenticationMessage email={session.user.email as string} />
          <Text size="5" align="center" color="gray">{t('harbor.subscriberMessage')}</Text>
        </Flex>
        <HarborLinks lang={lang} />
      </Box>
    </Flex>
  );
}