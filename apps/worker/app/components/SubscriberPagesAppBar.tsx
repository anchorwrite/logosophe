"use client";

import Link from "next/link";
import { SvgIcon } from "@/common/SvgIcon";
import { Button, Flex, Box } from "@radix-ui/themes";
import { useTranslation } from 'react-i18next';
import { useSession } from "next-auth/react";
import { PreferencesButton } from "@/components/PreferencesButton";
import type { Locale } from '@/types/i18n';

interface SubscriberPagesAppBarProps {
  lang: Locale;
}

export default function SubscriberPagesAppBar({ lang }: SubscriberPagesAppBarProps) {
  const { t } = useTranslation('translations');
  const { data: session } = useSession();

  return (
    <Flex justify="between" align="center" style={{ width: '100%' }}>
      <Link href={`/${lang}`} aria-label="homepage">
        <Box style={{ display: 'flex', alignItems: 'center', position: 'relative', marginBottom: '-8px', zIndex: 10 }}>
          <SvgIcon src="/img/svg/logo.svg" width="101px" height="64px" />
        </Box>
      </Link>
      
      <Flex gap="4" align="center" p="2">
        {session?.user ? (
          <>
            <Button variant="ghost" asChild>
              <Link href={`/${lang}/harbor`}>
                {t('harbor.nav.harbor')}
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/${lang}/harbor/profile`}>
                {t('harbor.nav.profile')}
              </Link>
            </Button>
            <PreferencesButton />
            <Button variant="ghost" asChild>
              <Link href={`/${lang}/signout`}>
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
