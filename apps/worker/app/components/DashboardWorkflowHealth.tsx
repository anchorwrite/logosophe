'use client';

import { useState, useEffect } from 'react';
import { Card, Box, Text, Heading, Flex, Button, Badge, Tabs } from '@radix-ui/themes';

interface SystemHealth {
  databaseStatus: 'healthy' | 'warning' | 'error';
  workerStatus: 'healthy' | 'warning' | 'error';
  storageUsage: number;
  activeConnections: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
  lastBackup: string;
  pendingWorkflows: number;
  stuckWorkflows: number;
  systemAlerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
  performanceMetrics: {
    workflowsPerHour: number;
    messagesPerHour: number;
    averageWorkflowDuration: number;
    completionRate: number;
  };
}

interface DashboardWorkflowHealthProps {
  userEmail: string;
  isGlobalAdmin: boolean;
}

export function DashboardWorkflowHealth({ 
  userEmail, 
  isGlobalAdmin 
}: DashboardWorkflowHealthProps) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/dashboard/workflow/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json() as { success: boolean; health?: SystemHealth; error?: string };
      
      if (data.success && data.health) {
        setHealth(data.health);
      } else {
        setError(data.error || 'Failed to fetch system health');
      }
    } catch (err) {
      console.error('Error fetching system health:', err);
      setError('Failed to load system health');
    } finally {
      setLoading(false);
    }
  };

  const refreshHealth = async () => {
    setRefreshing(true);
    await fetchHealth();
    setRefreshing(false);
  };

  useEffect(() => {
    if (userEmail) {
      fetchHealth();
    }
  }, [userEmail]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'green';
      case 'warning': return 'amber';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatStorageUsage = (percentage: number) => {
    if (percentage < 70) return 'green';
    if (percentage < 90) return 'amber';
    return 'red';
  };

  if (loading) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="gray">Loading system health...</Text>
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

  if (!health) {
    return (
      <Card>
        <Box p="4">
          <Text size="2" color="gray">No system health data available.</Text>
        </Box>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Card style={{ marginBottom: '2rem' }}>
        <Box p="4">
          <Flex justify="between" align="center">
            <Box>
              <Heading size="3">System Health Monitor</Heading>
              <Text size="2" color="gray">
                Real-time workflow system health and performance metrics
              </Text>
            </Box>
            <Button 
              variant="soft" 
              onClick={refreshHealth}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Flex>
        </Box>
      </Card>

      {/* System Status Overview */}
      <Flex gap="4" wrap="wrap" style={{ marginBottom: '2rem' }}>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Database Status</Text>
            <Badge color={getStatusColor(health.databaseStatus)} style={{ marginTop: '0.5rem' }}>
              {health.databaseStatus.toUpperCase()}
            </Badge>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Worker Status</Text>
            <Badge color={getStatusColor(health.workerStatus)} style={{ marginTop: '0.5rem' }}>
              {health.workerStatus.toUpperCase()}
            </Badge>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Storage Usage</Text>
            <Heading size="4">{health.storageUsage}%</Heading>
            <Badge color={formatStorageUsage(health.storageUsage)} style={{ marginTop: '0.5rem' }}>
              {health.storageUsage < 70 ? 'Good' : health.storageUsage < 90 ? 'Warning' : 'Critical'}
            </Badge>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">System Uptime</Text>
            <Heading size="4">{formatUptime(health.uptime)}</Heading>
          </Box>
        </Card>
      </Flex>

      {/* Performance Metrics */}
      <Flex gap="4" wrap="wrap" style={{ marginBottom: '2rem' }}>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Active Connections</Text>
            <Heading size="4">{health.activeConnections}</Heading>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Avg Response Time</Text>
            <Heading size="4">{health.averageResponseTime}ms</Heading>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Error Rate</Text>
            <Heading size="4">{health.errorRate}%</Heading>
            <Badge color={health.errorRate < 1 ? 'green' : health.errorRate < 5 ? 'amber' : 'red'} style={{ marginTop: '0.5rem' }}>
              {health.errorRate < 1 ? 'Excellent' : health.errorRate < 5 ? 'Acceptable' : 'High'}
            </Badge>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Last Backup</Text>
            <Heading size="4">{new Date(health.lastBackup).toLocaleDateString()}</Heading>
            <Text size="1" color="gray">{new Date(health.lastBackup).toLocaleTimeString()}</Text>
          </Box>
        </Card>
      </Flex>

      {/* Workflow Issues */}
      <Flex gap="4" wrap="wrap" style={{ marginBottom: '2rem' }}>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Pending Workflows</Text>
            <Heading size="4">{health.pendingWorkflows}</Heading>
            <Badge color={health.pendingWorkflows < 10 ? 'green' : health.pendingWorkflows < 50 ? 'amber' : 'red'} style={{ marginTop: '0.5rem' }}>
              {health.pendingWorkflows < 10 ? 'Low' : health.pendingWorkflows < 50 ? 'Medium' : 'High'}
            </Badge>
          </Box>
        </Card>
        <Card style={{ flex: '1', minWidth: '200px' }}>
          <Box p="4">
            <Text size="2" color="gray">Stuck Workflows</Text>
            <Heading size="4">{health.stuckWorkflows}</Heading>
            <Badge color={health.stuckWorkflows === 0 ? 'green' : 'red'} style={{ marginTop: '0.5rem' }}>
              {health.stuckWorkflows === 0 ? 'None' : 'Issue'}
            </Badge>
          </Box>
        </Card>
      </Flex>

      <Tabs.Root defaultValue="performance">
        <Tabs.List>
          <Tabs.Trigger value="performance">Performance Metrics</Tabs.Trigger>
          <Tabs.Trigger value="alerts">System Alerts</Tabs.Trigger>
        </Tabs.List>

        <Box pt="3">
          <Tabs.Content value="performance">
            <Card>
              <Box p="4">
                <Heading size="3" style={{ marginBottom: '1rem' }}>Performance Metrics</Heading>
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="center">
                    <Text size="2">Workflows per Hour</Text>
                    <Badge color="blue">{health.performanceMetrics.workflowsPerHour}</Badge>
                  </Flex>
                  <Flex justify="between" align="center">
                    <Text size="2">Messages per Hour</Text>
                    <Badge color="blue">{health.performanceMetrics.messagesPerHour}</Badge>
                  </Flex>
                  <Flex justify="between" align="center">
                    <Text size="2">Average Workflow Duration</Text>
                    <Badge color="blue">{Math.round(health.performanceMetrics.averageWorkflowDuration)} minutes</Badge>
                  </Flex>
                  <Flex justify="between" align="center">
                    <Text size="2">Completion Rate</Text>
                    <Badge color={health.performanceMetrics.completionRate > 90 ? 'green' : health.performanceMetrics.completionRate > 75 ? 'amber' : 'red'}>
                      {health.performanceMetrics.completionRate}%
                    </Badge>
                  </Flex>
                </Flex>
              </Box>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="alerts">
            <Card>
              <Box p="4">
                <Heading size="3" style={{ marginBottom: '1rem' }}>System Alerts</Heading>
                {health.systemAlerts.length === 0 ? (
                  <Text size="2" color="gray">No active system alerts</Text>
                ) : (
                  <Flex direction="column" gap="2">
                    {health.systemAlerts.map((alert) => (
                      <Box key={alert.id} style={{ padding: '0.75rem', backgroundColor: 'var(--gray-2)', borderRadius: 'var(--radius-3)' }}>
                        <Flex justify="between" align="start">
                          <Box>
                            <Text size="2" weight="medium">{alert.message}</Text>
                            <Text size="1" color="gray">{new Date(alert.timestamp).toLocaleString()}</Text>
                          </Box>
                          <Badge color={alert.type === 'error' ? 'red' : alert.type === 'warning' ? 'amber' : 'blue'}>
                            {alert.type.toUpperCase()}
                          </Badge>
                        </Flex>
                      </Box>
                    ))}
                  </Flex>
                )}
              </Box>
            </Card>
          </Tabs.Content>
        </Box>
      </Tabs.Root>

      {/* Health Summary */}
      <Card style={{ marginTop: '2rem' }}>
        <Box p="4">
          <Heading size="3" style={{ marginBottom: '1rem' }}>System Health Summary</Heading>
          <Flex direction="column" gap="2">
            <Flex justify="between" align="center">
              <Text size="2">Overall Status</Text>
              <Badge color={
                health.databaseStatus === 'healthy' && 
                health.workerStatus === 'healthy' && 
                health.errorRate < 5 && 
                health.stuckWorkflows === 0 ? 'green' : 'amber'
              }>
                {health.databaseStatus === 'healthy' && 
                 health.workerStatus === 'healthy' && 
                 health.errorRate < 5 && 
                 health.stuckWorkflows === 0 ? 'HEALTHY' : 'ATTENTION NEEDED'}
              </Badge>
            </Flex>
            <Flex justify="between" align="center">
              <Text size="2">Performance</Text>
              <Badge color={health.performanceMetrics.completionRate > 90 ? 'green' : 'amber'}>
                {health.performanceMetrics.completionRate > 90 ? 'EXCELLENT' : 'GOOD'}
              </Badge>
            </Flex>
            <Flex justify="between" align="center">
              <Text size="2">Storage</Text>
              <Badge color={formatStorageUsage(health.storageUsage)}>
                {health.storageUsage < 70 ? 'OPTIMAL' : health.storageUsage < 90 ? 'WARNING' : 'CRITICAL'}
              </Badge>
            </Flex>
          </Flex>
        </Box>
      </Card>
    </Box>
  );
} 