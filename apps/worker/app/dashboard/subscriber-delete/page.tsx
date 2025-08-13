'use client';

import { useState, useEffect } from 'react';
import { Container, Box, Card, Text, Heading } from '@radix-ui/themes';
import { SubscriberList } from './SubscriberList';
import { useToast } from '@/components/Toast';


interface Subscriber {
  Email: string;
  Name: string;
  Provider: string;
  Joined: string;
  LastSignin: string;
  Active: boolean;
  Left?: string;
}

interface SubscribersResponse {
  subscribers?: Subscriber[];
}

export default function SubscriberDeletePage() {
  const { showToast } = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscribers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/subscribers');
      if (!response.ok) {
        throw new Error('Failed to fetch subscribers');
      }
      const data = await response.json() as SubscribersResponse | Subscriber[];
      setSubscribers(Array.isArray(data) ? data : (data.subscribers || []));
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      showToast({
        title: 'Error',
        content: 'Failed to load subscribers',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchSubscribers();
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  if (isLoading) {
    return (
      <Container size="3">
        <Box py="6">
          <Text align="center">Loading subscribers...</Text>
        </Box>
      </Container>
    );
  }

  return (
    <Container size="3">
      <Box py="6">
        <Box mb="6">
          <Heading align="center" size="6">Subscriber Deletion</Heading>
          <Text as="p" align="center" color="gray" mt="2">
            View and hard delete subscribers (both active and inactive) and all their associated records
          </Text>
        </Box>

        <Card>
          <Box p="4">
            <Text as="p" align="center" size="4" weight="bold">Subscribers</Text>
          </Box>
          <Box p="4">
            <SubscriberList subscribers={subscribers} onRefresh={handleRefresh} />
          </Box>
        </Card>
      </Box>
    </Container>
  );
} 