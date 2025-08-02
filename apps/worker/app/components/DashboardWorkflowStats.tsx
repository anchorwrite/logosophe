'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, Box, Text, Heading, Flex } from '@radix-ui/themes';

interface WorkflowStats {
  activeWorkflows: number;
  completedToday: number;
  initiatedToday: number;
  terminatedToday: number;
  totalWorkflows: number;
  pendingWorkflows: number;
}

interface WorkflowStatsResponse {
  success: boolean;
  stats?: WorkflowStats;
  error?: string;
}

interface DashboardWorkflowStatsProps {
  userEmail: string;
  isGlobalAdmin: boolean;
  accessibleTenants: string[];
}

export function DashboardWorkflowStats({ userEmail, isGlobalAdmin, accessibleTenants }: DashboardWorkflowStatsProps) {
  const [stats, setStats] = useState<WorkflowStats>({
    activeWorkflows: 0,
    completedToday: 0,
    initiatedToday: 0,
    terminatedToday: 0,
    totalWorkflows: 0,
    pendingWorkflows: 0
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

        // Build query parameters based on admin type
        const params = new URLSearchParams();
        params.append('userEmail', userEmail);
        params.append('isGlobalAdmin', isGlobalAdmin.toString());
        
        if (!isGlobalAdmin && accessibleTenants.length > 0) {
          params.append('tenantIds', accessibleTenants.join(','));
        }

        const response = await fetch(`/api/dashboard/workflow/stats?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('DashboardWorkflowStats: Response error:', errorText);
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
    if (userEmail) {
      fetchStats();
    }
  }, [userEmail, isGlobalAdmin, accessibleTenants]);

  if (loading) {
    return (
      <Flex gap="4" wrap="wrap" justify="center">
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="3" style={{ textAlign: 'center' }}>
            <Text size="2" color="gray">Loading...</Text>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="3" style={{ textAlign: 'center' }}>
            <Text size="2" color="gray">Loading...</Text>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="3" style={{ textAlign: 'center' }}>
            <Text size="2" color="gray">Loading...</Text>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="3" style={{ textAlign: 'center' }}>
            <Text size="2" color="gray">Loading...</Text>
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
    <Flex gap="4" justify="center" style={{ flexWrap: 'wrap' }}>
      <Card style={{ flex: '1', minWidth: '200px' }}>
        <Box p="3" style={{ textAlign: 'center' }}>
          <Text size="2" color="gray">Active Workflows</Text>
          <Heading size="3">{stats.activeWorkflows}</Heading>
        </Box>
      </Card>
      <Card style={{ flex: '1', minWidth: '200px' }}>
        <Box p="3" style={{ textAlign: 'center' }}>
          <Text size="2" color="gray">Completed Today</Text>
          <Heading size="3">{stats.completedToday}</Heading>
        </Box>
      </Card>
      <Card style={{ flex: '1', minWidth: '200px' }}>
        <Box p="3" style={{ textAlign: 'center' }}>
          <Text size="2" color="gray">Initiated Today</Text>
          <Heading size="3">{stats.initiatedToday}</Heading>
        </Box>
      </Card>
      <Card style={{ flex: '1', minWidth: '200px' }}>
        <Box p="3" style={{ textAlign: 'center' }}>
          <Text size="2" color="gray">Terminated Today</Text>
          <Heading size="3">{stats.terminatedToday}</Heading>
        </Box>
      </Card>
      <Card style={{ flex: '1', minWidth: '200px' }}>
        <Box p="3" style={{ textAlign: 'center' }}>
          <Text size="2" color="gray">Total Workflows</Text>
          <Heading size="3">{stats.totalWorkflows}</Heading>
        </Box>
      </Card>
      <Card style={{ flex: '1', minWidth: '200px' }}>
        <Box p="3" style={{ textAlign: 'center' }}>
          <Text size="2" color="gray">Pending Workflows</Text>
          <Heading size="3">{stats.pendingWorkflows}</Heading>
        </Box>
      </Card>
    </Flex>
  );
} 