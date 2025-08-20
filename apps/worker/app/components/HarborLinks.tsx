'use client';

import { Card, Box, Grid, Heading } from '@radix-ui/themes';
import Link from 'next/link';
import { Users, MessageSquare, Workflow, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HarborLinks({ lang }: { lang: string }) {
  const { t } = useTranslation('translations');
  
  const myLinks = [
    { href: `/${lang}/harbor/media`, label: t('harbor.mediaLibrary'), roles: ['subscriber'] },
    { href: `/${lang}/harbor/media/upload`, label: t('harbor.uploadMedia'), roles: ['subscriber'] },
    { href: `/${lang}/harbor/content`, label: t('harbor.contentDashboard'), roles: ['publisher'] }
  ];

  const analyticsLinks = [
    { href: `/${lang}/harbor/analytics`, label: t('harbor.contentAnalytics'), roles: ['subscriber'] }
  ];

  const myCrewLinks = [
    {
      name: t('harbor.tenantMembers'),
      href: `/${lang}/harbor/tenant-members`,
      icon: Users
    },
    {
      name: t('harbor.messaging'),
      href: `/${lang}/harbor/messaging`,
      icon: MessageSquare
    },
    {
      name: t('harbor.workflow'),
      href: `/${lang}/harbor/workflow`,
      icon: Workflow
    }
  ];

  return (
    <>
      <Card size="3" style={{ width: '100%', maxWidth: '64rem' }}>
        <Box p="4" style={{ textAlign: 'center' }}>
          <Heading size="5">{t('harbor.contentManagement')}</Heading>
        </Box>
        <Box p="4">
          <Grid columns="3" gap="4">
            {myLinks.map((link) => (
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

      <Card size="3" style={{ width: '100%', maxWidth: '64rem' }}>
        <Box p="4" style={{ textAlign: 'center' }}>
          <Heading size="5">{t('harbor.analytics')}</Heading>
        </Box>
        <Box p="4">
          <Grid columns="3" gap="4">
            {analyticsLinks.map((link) => (
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

      <Card size="3" style={{ width: '100%', maxWidth: '64rem' }}>
        <Box p="4" style={{ textAlign: 'center' }}>
          <Heading size="5">{t('harbor.collaboration')}</Heading>
        </Box>
        <Box p="4">
          <Grid columns="3" gap="4">
            {myCrewLinks.map((link) => (
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
                {link.name}
              </Link>
            ))}
          </Grid>
        </Box>
      </Card>
    </>
  );
} 