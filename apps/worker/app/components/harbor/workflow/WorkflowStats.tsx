'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, Box, Text, Heading, Flex } from '@radix-ui/themes';

interface WorkflowStats {
  activeWorkflows: number;
  completedToday: number;
  initiatedToday: number;
  terminatedToday: number;
}

interface WorkflowStatsResponse {
  success: boolean;
  stats?: WorkflowStats;
  error?: string;
}

interface WorkflowStatsProps {
  userEmail: string;
  userTenantId: string;
  dict: any;
}

export function WorkflowStats({ userEmail, userTenantId, dict }: WorkflowStatsProps) {
  const [stats, setStats] = useState<WorkflowStats>({
    activeWorkflows: 0,
    completedToday: 0,
    initiatedToday: 0,
    terminatedToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const fetchStats = async () => {
      // Prevent multiple simultaneous requests
      if (fetchingRef.current) {
        return;
      }
      
      try {
        fetchingRef.current = true;
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/harbor/workflow/stats?tenantId=${userTenantId}&userEmail=${userEmail}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('WorkflowStats: Response error:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data: WorkflowStatsResponse = await response.json();
        
        if (data.success && data.stats) {
          setStats(data.stats);
        } else {
          setError(data.error || 'Failed to fetch workflow statistics');
        }
      } catch (err) {
        console.error('Error fetching workflow stats:', err);
        setError('Failed to load workflow statistics');
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    // Only fetch if we have the required data
    if (userEmail && userTenantId) {
      fetchStats();
    }
  }, [userEmail, userTenantId]);

  if (loading) {
    return (
      <Flex gap="4" wrap="wrap" justify="center">
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="3" style={{ textAlign: 'center' }}>
            <Text size="2" color="gray">{(dict as any).common.loading}</Text>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="3" style={{ textAlign: 'center' }}>
            <Text size="2" color="gray">{(dict as any).common.loading}</Text>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="3" style={{ textAlign: 'center' }}>
            <Text size="2" color="gray">{(dict as any).common.loading}</Text>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="3" style={{ textAlign: 'center' }}>
            <Text size="2" color="gray">{(dict as any).common.loading}</Text>
          </Box>
        </Card>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex gap="4" wrap="wrap" justify="center">
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="3" style={{ textAlign: 'center' }}>
            <Text size="2" color="red">{error}</Text>
          </Box>
        </Card>
      </Flex>
    );
  }

  return (
    <Flex gap="4" justify="center" style={{ flexWrap: 'nowrap' }}>
      <Card style={{ flex: '1', minWidth: '0' }}>
        <Box p="3" style={{ textAlign: 'center' }}>
          <Text size="2" color="gray">{(dict as any).workflow.activeWorkflows}</Text>
          <Heading size="3">{stats.activeWorkflows}</Heading>
        </Box>
      </Card>
      <Card style={{ flex: '1', minWidth: '0' }}>
        <Box p="3" style={{ textAlign: 'center' }}>
          <Text size="2" color="gray">{(dict as any).workflow.completedToday}</Text>
          <Heading size="3">{stats.completedToday}</Heading>
        </Box>
      </Card>
      <Card style={{ flex: '1', minWidth: '0' }}>
        <Box p="3" style={{ textAlign: 'center' }}>
          <Text size="2" color="gray">{(dict as any).workflow.createdToday}</Text>
          <Heading size="3">{stats.initiatedToday}</Heading>
        </Box>
      </Card>
      <Card style={{ flex: '1', minWidth: '0' }}>
        <Box p="3" style={{ textAlign: 'center' }}>
          <Text size="2" color="gray">{(dict as any).workflow.terminatedToday}</Text>
          <Heading size="3">{stats.terminatedToday}</Heading>
        </Box>
      </Card>
    </Flex>
  );
} 