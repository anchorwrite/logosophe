'use client';

import { useState, useEffect } from 'react';
import { Text, Flex } from '@radix-ui/themes';

interface WorkflowStats {
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
  terminatedWorkflows: number;
  pausedWorkflows: number;
}

interface WorkflowSystemStatsProps {
  userEmail: string;
}

export function WorkflowSystemStats({ userEmail }: WorkflowSystemStatsProps) {
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/dashboard/workflow/stats', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data = await response.json() as {
          success: boolean;
          stats?: WorkflowStats;
          error?: string;
        };
        
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
      }
    };

    if (userEmail) {
      fetchStats();
    }
  }, [userEmail]);

  if (loading) {
    return (
      <Flex direction="column" gap="2">
        <Text size="2">
          • Total Workflows: <Text weight="bold">Loading...</Text>
        </Text>
        <Text size="2">
          • Active Workflows: <Text weight="bold">Loading...</Text>
        </Text>
        <Text size="2">
          • System Health: <Text weight="bold" color="green">Healthy</Text>
        </Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex direction="column" gap="2">
        <Text size="2" color="red">
          Error loading statistics: {error}
        </Text>
      </Flex>
    );
  }

  if (!stats) {
    return (
      <Flex direction="column" gap="2">
        <Text size="2" color="gray">
          No statistics available
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="2">
      <Text size="2">
        • Total Workflows: <Text weight="bold">{stats.totalWorkflows}</Text>
      </Text>
      <Text size="2">
        • Active Workflows: <Text weight="bold">{stats.activeWorkflows}</Text>
      </Text>
      <Text size="2">
        • Completed Workflows: <Text weight="bold">{stats.completedWorkflows}</Text>
      </Text>
      <Text size="2">
        • Terminated Workflows: <Text weight="bold">{stats.terminatedWorkflows}</Text>
      </Text>
      <Text size="2">
        • Paused Workflows: <Text weight="bold">{stats.pausedWorkflows}</Text>
      </Text>
      <Text size="2">
        • System Health: <Text weight="bold" color="green">Healthy</Text>
      </Text>
    </Flex>
  );
} 