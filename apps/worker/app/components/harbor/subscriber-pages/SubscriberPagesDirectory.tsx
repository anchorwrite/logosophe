'use client';

import { useState, useEffect } from 'react';
import { Box, Text, Flex, Grid, Card, Badge, Button, TextField, Select } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';

interface SubscriberHandle {
  Id: number;
  Handle: string;
  DisplayName: string;
  Description: string;
  IsActive: boolean;
  IsPublic: boolean;
  CreatedAt: string;
  SubscriberEmail: string;
  ContentFocus?: string;
  RecentActivity?: string;
}

interface SubscriberPagesDirectoryProps {
  lang: string;
}

export function SubscriberPagesDirectory({ lang }: SubscriberPagesDirectoryProps) {
  const { t } = useTranslation('translations');
  const [handles, setHandles] = useState<SubscriberHandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHandles() {
      try {
        const response = await fetch('/api/pages/discover');
        if (!response.ok) {
          throw new Error('Failed to fetch subscriber pages');
        }
        const data = await response.json() as { handles: SubscriberHandle[] };
        setHandles(data.handles || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchHandles();
  }, []);

  if (loading) {
    return (
      <Box>
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text size="6" mb="4">Subscriber Pages Directory</Text>
      <Grid columns={{ initial: "1", md: "2", lg: "3" }} gap="4">
        {handles.filter(h => h.IsActive && h.IsPublic).map((handle) => (
          <Card key={handle.Id} size="2">
            <Box p="4">
              <Text size="5" weight="bold" mb="2">
                {handle.DisplayName}
              </Text>
              <Text size="2" color="gray" mb="2">
                @{handle.Handle}
              </Text>
              <Text size="3" mb="3">
                {handle.Description || 'No description available'}
              </Text>
              <Link href={`/${lang}/pages/${handle.Handle}`}>
                <Button size="2" variant="soft" style={{ width: '100%' }}>
                  View Page
                </Button>
              </Link>
            </Box>
          </Card>
        ))}
      </Grid>
    </Box>
  );
}
