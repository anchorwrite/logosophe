'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, Box, Text, Heading, Flex, Button, Badge, Select, Tabs } from '@radix-ui/themes';

interface WorkflowMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
  terminatedWorkflows: number;
  averageCompletionTime: number;
  averageParticipants: number;
  averageMessages: number;
  topTenants: Array<{ tenantName: string; workflowCount: number }>;
  topInitiators: Array<{ email: string; workflowCount: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  dailyActivity: Array<{ date: string; created: number; completed: number }>;
  weeklyTrends: Array<{ week: string; active: number; completed: number }>;
  monthlyPerformance: Array<{ month: string; total: number; completed: number; terminated: number }>;
}

interface WorkflowAnalyticsResponse {
  success: boolean;
  metrics?: WorkflowMetrics;
  error?: string;
}

interface DashboardWorkflowAnalyticsProps {
  userEmail: string;
  isGlobalAdmin: boolean;
  accessibleTenants: string[];
  timeRange?: string;
}

export function DashboardWorkflowAnalytics({ 
  userEmail, 
  isGlobalAdmin, 
  accessibleTenants,
  timeRange = '30d'
}: DashboardWorkflowAnalyticsProps) {
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      // Prevent multiple simultaneous requests
      if (fetchingRef.current) {
        return;
      }
      
      try {
        fetchingRef.current = true;
        setLoading(true);
        setError(null);

        // Build query parameters
        const params = new URLSearchParams();
        params.append('userEmail', userEmail);
        params.append('isGlobalAdmin', isGlobalAdmin.toString());
        params.append('timeRange', selectedTimeRange);
        
        if (!isGlobalAdmin && accessibleTenants.length > 0) {
          params.append('tenantIds', accessibleTenants.join(','));
        }

        const response = await fetch(`/api/dashboard/workflow/analytics?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('DashboardWorkflowAnalytics: Response error:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data: WorkflowAnalyticsResponse = await response.json();
        
        if (data.success && data.metrics) {
          setMetrics(data.metrics);
        } else {
          setError(data.error || 'Failed to fetch analytics');
        }
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    // Only fetch if we have the required data
    if (userEmail) {
      fetchAnalytics();
    }
  }, [userEmail, isGlobalAdmin, accessibleTenants, selectedTimeRange]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${remainingMinutes}m`;
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  if (loading) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="gray">Loading analytics...</Text>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="red">{error}</Text>
        </Box>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="gray">No analytics data available.</Text>
        </Box>
      </Card>
    );
  }

  return (
    <Box>
      {/* Time Range Selector */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box p="4">
          <Flex justify="between" align="center">
            <Heading size="3">Workflow Analytics</Heading>
            <Select.Root value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="7d">Last 7 Days</Select.Item>
                <Select.Item value="30d">Last 30 Days</Select.Item>
                <Select.Item value="90d">Last 90 Days</Select.Item>
                <Select.Item value="1y">Last Year</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
        </Box>
      </Card>

      {/* Key Metrics */}
      <Flex gap="4" wrap="wrap" style={{ marginBottom: '2rem' }}>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Total Workflows</Text>
            <Heading size="4">{metrics.totalWorkflows}</Heading>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Active Workflows</Text>
            <Heading size="4">{metrics.activeWorkflows}</Heading>
            <Text size="1" color="gray">
              {formatPercentage(metrics.activeWorkflows, metrics.totalWorkflows)}
            </Text>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Completed Workflows</Text>
            <Heading size="4">{metrics.completedWorkflows}</Heading>
            <Text size="1" color="gray">
              {formatPercentage(metrics.completedWorkflows, metrics.totalWorkflows)}
            </Text>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Terminated Workflows</Text>
            <Heading size="4">{metrics.terminatedWorkflows}</Heading>
            <Text size="1" color="gray">
              {formatPercentage(metrics.terminatedWorkflows, metrics.totalWorkflows)}
            </Text>
          </Box>
        </Card>
      </Flex>

      {/* Performance Metrics */}
      <Flex gap="4" wrap="wrap" style={{ marginBottom: '2rem' }}>
        <Card style={{ flex: '1', minWidth: '250px' }}>
          <Box p="4">
            <Text size="2" color="gray">Average Completion Time</Text>
            <Heading size="4">{formatDuration(metrics.averageCompletionTime)}</Heading>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '250px' }}>
          <Box p="4">
            <Text size="2" color="gray">Average Participants</Text>
            <Heading size="4">{metrics.averageParticipants.toFixed(1)}</Heading>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '250px' }}>
          <Box p="4">
            <Text size="2" color="gray">Average Messages</Text>
            <Heading size="4">{metrics.averageMessages.toFixed(1)}</Heading>
          </Box>
        </Card>
      </Flex>

      {/* Detailed Analytics */}
      <Tabs.Root defaultValue="tenants">
        <Tabs.List>
          <Tabs.Trigger value="tenants">Top Tenants</Tabs.Trigger>
          <Tabs.Trigger value="initiators">Top Initiators</Tabs.Trigger>
          <Tabs.Trigger value="status">Status Distribution</Tabs.Trigger>
          <Tabs.Trigger value="activity">Daily Activity</Tabs.Trigger>
        </Tabs.List>

        <Box pt="3">
          <Tabs.Content value="tenants">
            <Card>
              <Box p="4">
                <Heading size="3" style={{ marginBottom: '1rem' }}>Top Tenants by Workflow Count</Heading>
                <Flex direction="column" gap="2">
                  {metrics.topTenants.map((tenant, index) => (
                    <Flex key={tenant.tenantName} justify="between" align="center">
                      <Flex gap="2" align="center">
                        <Text size="2" weight="medium">#{index + 1}</Text>
                        <Text size="2">{tenant.tenantName}</Text>
                      </Flex>
                      <Badge color="blue">{tenant.workflowCount} workflows</Badge>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="initiators">
            <Card>
              <Box p="4">
                <Heading size="3" style={{ marginBottom: '1rem' }}>Top Initiators by Workflow Count</Heading>
                <Flex direction="column" gap="2">
                  {metrics.topInitiators.map((initiator, index) => (
                    <Flex key={initiator.email} justify="between" align="center">
                      <Flex gap="2" align="center">
                        <Text size="2" weight="medium">#{index + 1}</Text>
                        <Text size="2">{initiator.email}</Text>
                      </Flex>
                      <Badge color="green">{initiator.workflowCount} workflows</Badge>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="status">
            <Card>
              <Box p="4">
                <Heading size="3" style={{ marginBottom: '1rem' }}>Workflow Status Distribution</Heading>
                <Flex direction="column" gap="2">
                  {metrics.statusDistribution.map((status) => (
                    <Flex key={status.status} justify="between" align="center">
                      <Text size="2" style={{ textTransform: 'capitalize' }}>{status.status}</Text>
                      <Badge color="gray">{status.count} workflows</Badge>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="activity">
            <Card>
              <Box p="4">
                <Heading size="3" style={{ marginBottom: '1rem' }}>Daily Activity (Last 7 Days)</Heading>
                <Flex direction="column" gap="2">
                  {metrics.dailyActivity.slice(-7).map((day) => (
                    <Flex key={day.date} justify="between" align="center">
                      <Text size="2">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                      <Flex gap="2">
                        <Badge color="green">+{day.created} created</Badge>
                        <Badge color="blue">+{day.completed} completed</Badge>
                      </Flex>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            </Card>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
} 