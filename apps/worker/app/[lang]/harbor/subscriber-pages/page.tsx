'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Box, Flex, Heading, Text, Tabs, Container } from '@radix-ui/themes';
import HandleManager from '@/components/harbor/subscriber-pages/HandleManager';
import BlogManager from '@/components/harbor/subscriber-pages/BlogManager';
import AnnouncementManager from '@/components/harbor/subscriber-pages/AnnouncementManager';
import BiographyManager from '@/components/harbor/subscriber-pages/BiographyManager';
import ContactInfoManager from '@/components/harbor/subscriber-pages/ContactInfoManager';
import EmailPreferencesManager from '@/components/harbor/EmailPreferencesManager';

type TabType = 'handles' | 'blog' | 'announcements' | 'biography' | 'contact' | 'email-preferences';

export default function SubscriberPagesPage() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('handles');

  // Redirect if not authenticated
  if (status === 'loading') {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
        <Text size="5">{t('common.loading')}</Text>
      </Flex>
    );
  }

  if (status === 'unauthenticated' || !session?.user?.email) {
    router.push('/signin');
    return null;
  }

  return (
    <Box style={{ minHeight: '100vh', backgroundColor: 'var(--gray-1)' }}>
      {/* Header */}
      <Box style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-6)' }}>
        <Container size="4">
          <Box py="6">
            <Flex justify="between" align="center">
              <Box>
                <Heading size="8" mb="2">
                  {t('subscriber_pages.title')}
                </Heading>
                <Text size="5" color="gray">
                  {t('subscriber_pages.subtitle')}
                </Text>
              </Box>
              <Text size="2" color="gray">
                {t('subscriber_pages.logged_in_as')}: {session.user.email}
              </Text>
            </Flex>
          </Box>
        </Container>
      </Box>

      {/* Content */}
      <Container size="4" py="6">
        <Tabs.Root value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
          <Tabs.List size="2" style={{ marginBottom: '2rem' }}>
            <Tabs.Trigger value="handles">
              {t('subscriber_pages.tabs.handles')}
            </Tabs.Trigger>
            <Tabs.Trigger value="blog">
              {t('subscriber_pages.tabs.blog')}
            </Tabs.Trigger>
            <Tabs.Trigger value="announcements">
              {t('subscriber_pages.tabs.announcements')}
            </Tabs.Trigger>
            <Tabs.Trigger value="biography">
              {t('subscriber_pages.tabs.biography')}
            </Tabs.Trigger>
            <Tabs.Trigger value="contact">
              {t('subscriber_pages.tabs.contact')}
            </Tabs.Trigger>
            <Tabs.Trigger value="email-preferences">
              {t('subscriber_pages.tabs.emailPreferences')}
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="handles">
            <HandleManager subscriberEmail={session.user.email} />
          </Tabs.Content>

          <Tabs.Content value="blog">
            <BlogManager subscriberEmail={session.user.email} />
          </Tabs.Content>
          <Tabs.Content value="announcements">
            <AnnouncementManager subscriberEmail={session.user.email} />
          </Tabs.Content>
          <Tabs.Content value="biography">
            <BiographyManager subscriberEmail={session.user.email} />
          </Tabs.Content>
          <Tabs.Content value="contact">
            <ContactInfoManager subscriberEmail={session.user.email} />
          </Tabs.Content>
          <Tabs.Content value="email-preferences">
            <EmailPreferencesManager subscriberEmail={session.user.email} />
          </Tabs.Content>
        </Tabs.Root>
      </Container>
    </Box>
  );
}
