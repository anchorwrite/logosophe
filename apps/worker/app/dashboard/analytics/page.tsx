"use client";

import { useState, useEffect, useRef } from 'react';
import { Container, Heading, Text, Box, Flex, Button, Card, Badge } from '@radix-ui/themes';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

interface Tenant {
  TenantId: string;
  TotalOperations: number;
  UniqueUsers: number;
  FirstActivity: string;
  LastActivity: string;
}

interface AdminAnalyticsData {
  overview: Array<{
    LogType: string;
    TotalOperations: number;
    UniqueUsers: number;
    ActiveTenants: number;
    ActiveDays: number;
  }>;
  dailyTrends: Array<{
    Date: string;
    LogType: string;
    DailyOperations: number;
    DailyUsers: number;
  }>;
  topUsers: Array<{
    UserEmail: string;
    TotalOperations: number;
    OperationTypes: number;
    ActiveDays: number;
    LastActivity: string;
  }>;
  mediaOperations: Array<{
    ActivityType: string;
    OperationCount: number;
    UniqueFiles: number;
    UniqueUsers: number;
  }>;
  authProviders: Array<{
    Provider: string;
    SignInCount: number;
    UniqueUsers: number;
  }>;
  trendAnalysis: Array<{
    LogType: string;
    current_count: number;
    previous_count: number;
    percent_change: number;
  }>;
  peakHours: Array<{
    Hour: number;
    ActivityCount: number;
  }>;
  errorRate: Array<{
    Date: string;
    TotalRequests: number;
    ErrorCount: number;
    ErrorRate: number;
  }>;
  filters: {
    days: number;
    tenantId: string | null;
    userRole: string;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7');
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const tenantSelectorRef = useRef<HTMLDivElement>(null);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tenantSelectorRef.current && !tenantSelectorRef.current.contains(event.target as Node)) {
        setShowTenantSelector(false);
      }
    }

    if (showTenantSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTenantSelector]);

  // Fetch available tenants
  useEffect(() => {
    async function fetchTenants() {
      try {
        console.log('Fetching tenants...');
        const response = await fetch('/api/analytics/admin/tenants');
        console.log('Tenants response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Tenants API error:', response.status, errorText);
          throw new Error(`Failed to fetch tenants: ${response.status} ${errorText}`);
        }
        
        const result = await response.json() as { success: boolean; data: Tenant[] };
        console.log('Tenants API response:', result);
        
        if (result.success && result.data) {
          setTenants(result.data);
          console.log('Set tenants:', result.data.length, 'tenants');
        } else {
          console.error('Tenants API returned no data:', result);
          setTenants([]);
        }
      } catch (err) {
        console.error('Error fetching tenants:', err);
        setTenants([]);
      }
    }

    fetchTenants();
  }, []);

  // Fetch analytics data
  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          days: timeRange,
          ...(selectedTenants.length > 0 && { tenantIds: selectedTenants.join(',') })
        });

        const response = await fetch(`/api/analytics/admin/overview?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }

        const result = await response.json() as { data: AdminAnalyticsData };
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [timeRange, selectedTenants]);

  const handleTenantToggle = (tenantId: string) => {
    setSelectedTenants(prev => 
      prev.includes(tenantId) 
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const handleSelectAllTenants = () => {
    setSelectedTenants(tenants.map(t => t.TenantId));
  };

  const handleClearAllTenants = () => {
    setSelectedTenants([]);
  };

  const getSelectedTenantsLabel = () => {
    if (selectedTenants.length === 0) return 'All Tenants';
    if (selectedTenants.length === 1) {
      const tenant = tenants.find(t => t.TenantId === selectedTenants[0]);
      return tenant ? tenant.TenantId : selectedTenants[0];
    }
    return `${selectedTenants.length} Tenants Selected`;
  };

  if (loading) {
    return (
      <Container size="3">
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
          <Text size="4">Loading analytics...</Text>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="3">
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
          <Text color="red" size="4">Error: {error}</Text>
        </Box>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container size="3">
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
          <Text size="4">No data available</Text>
        </Box>
      </Container>
    );
  }

  // Prepare data for charts
  const dailyTrendsData = data.dailyTrends.reduce((acc, item) => {
    const existing = acc.find(d => d.Date === item.Date);
    if (existing) {
      existing[item.LogType] = item.DailyOperations;
    } else {
      acc.push({ Date: item.Date, [item.LogType]: item.DailyOperations });
    }
    return acc;
  }, [] as any[]);

  const peakHoursData = data.peakHours.map(hour => ({
    Hour: `${hour.Hour}:00`,
    Activity: hour.ActivityCount
  }));

  const errorRateData = data.errorRate.map(item => ({
    Date: new Date(item.Date).toLocaleDateString(),
    ErrorRate: item.ErrorRate,
    TotalRequests: item.TotalRequests
  }));

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              System Analytics
            </Heading>
            <Text color="gray" size="3">
              {data.filters.userRole === 'system_admin' ? 'Global System Overview' : 'Tenant Analytics'}
            </Text>
          </Box>
          <Flex gap="2">
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--gray-6)' }}
            >
              <option value="1">1 Day</option>
              <option value="7">7 Days</option>
              <option value="30">30 Days</option>
              <option value="90">90 Days</option>
            </select>
            {/* Show tenant selector for system admins - check if we have tenants data */}
            {tenants.length > 0 ? (
              <Box style={{ position: 'relative' }} ref={tenantSelectorRef}>
                <Button 
                  variant="outline" 
                  onClick={() => setShowTenantSelector(!showTenantSelector)}
                  style={{ minWidth: '200px', justifyContent: 'space-between' }}
                >
                  <Text>{getSelectedTenantsLabel()}</Text>
                  <Text>▼</Text>
                </Button>
                
                {showTenantSelector && (
                  <Card style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    right: 0, 
                    zIndex: 1000,
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    <Box style={{ padding: '1rem' }}>
                      <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
                        <Text weight="medium">Select Tenants</Text>
                        <Flex gap="1">
                          <Button size="1" variant="soft" onClick={handleSelectAllTenants}>
                            All
                          </Button>
                          <Button size="1" variant="soft" onClick={handleClearAllTenants}>
                            Clear
                          </Button>
                        </Flex>
                      </Flex>
                      
                      <Flex direction="column" gap="2">
                        {tenants.map((tenant) => (
                          <Flex key={tenant.TenantId} align="center" gap="2">
                            <input
                              type="checkbox"
                              id={tenant.TenantId}
                              checked={selectedTenants.includes(tenant.TenantId)}
                              onChange={() => handleTenantToggle(tenant.TenantId)}
                            />
                            <label htmlFor={tenant.TenantId} style={{ cursor: 'pointer', flex: 1 }}>
                              <Flex direction="column">
                                <Text weight="medium">{tenant.TenantId}</Text>
                                <Text size="1" color="gray">
                                  {tenant.TotalOperations.toLocaleString()} operations • {tenant.UniqueUsers} users
                                </Text>
                              </Flex>
                            </label>
                          </Flex>
                        ))}
                      </Flex>
                    </Box>
                  </Card>
                )}
              </Box>
            ) : (
              <Text size="2" color="gray">No tenant data available</Text>
            )}
          </Flex>
        </Flex>
      </Box>

      {/* Overview Cards */}
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="4" style={{ marginBottom: '1rem' }}>System Overview</Heading>
        <Flex gap="4" wrap="wrap">
          {data.overview.map((item) => (
            <Card key={item.LogType} style={{ flex: '1', minWidth: '250px' }}>
              <Box style={{ padding: '1.5rem' }}>
                <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
                  <Heading size="3" style={{ textTransform: 'capitalize' }}>
                    {item.LogType.replace('_', ' ')}
                  </Heading>
                  <Badge variant="soft">{item.ActiveTenants} tenants</Badge>
                </Flex>
                <Text size="6" weight="bold" style={{ marginBottom: '0.5rem' }}>
                  {item.TotalOperations.toLocaleString()}
                </Text>
                <Text color="gray" size="2">
                  {item.UniqueUsers} users • {item.ActiveDays} active days
                </Text>
              </Box>
            </Card>
          ))}
        </Flex>
      </Box>

      {/* Trend Analysis - Week over Week */}
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="4" style={{ marginBottom: '1rem' }}>Week over Week Trends</Heading>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Flex direction="column" gap="3">
              {data.trendAnalysis.map((trend) => (
                <Flex key={trend.LogType} justify="between" align="center" style={{ padding: '1rem', border: '1px solid var(--gray-6)', borderRadius: '4px' }}>
                  <Box>
                    <Text weight="medium" style={{ textTransform: 'capitalize' }}>
                      {trend.LogType.replace('_', ' ')}
                    </Text>
                    <Text color="gray" size="2">
                      {trend.current_count} vs {trend.previous_count} previous week
                    </Text>
                  </Box>
                  <Box style={{ textAlign: 'right' }}>
                    <Text weight="bold" size="3">{trend.current_count.toLocaleString()}</Text>
                    <Text color={trend.percent_change > 0 ? 'green' : 'red'} size="2">
                      {trend.percent_change > 0 ? '+' : ''}{trend.percent_change}%
                    </Text>
                  </Box>
                </Flex>
              ))}
            </Flex>
          </Box>
        </Card>
      </Box>

      {/* Operations Chart */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>Operations by Category</Heading>
            <Box style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.overview}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="LogType" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="TotalOperations" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Daily Trends */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>Daily Activity Trends</Heading>
            <Box style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Date" />
                  <YAxis />
                  <Tooltip />
                  {data.overview.map((item, index) => (
                    <Line 
                      key={item.LogType}
                      type="monotone" 
                      dataKey={item.LogType} 
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Peak Activity Hours */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>Peak Activity Hours</Heading>
            <Box style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Hour" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="Activity" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Error Rate Analysis */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>Error Rate Analysis</Heading>
            <Box style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={errorRateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="ErrorRate" stroke="#ff4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Top Users */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>Top Users by Activity</Heading>
            <Flex direction="column" gap="3">
              {data.topUsers.map((user, index) => (
                <Flex key={user.UserEmail} justify="between" align="center" style={{ padding: '1rem', border: '1px solid var(--gray-6)', borderRadius: '4px' }}>
                  <Flex align="center" gap="3">
                    <Box style={{ width: '32px', height: '32px', backgroundColor: 'var(--blue-3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Text size="2" weight="medium">{index + 1}</Text>
                    </Box>
                    <Box>
                      <Text weight="medium">{user.UserEmail}</Text>
                      <Text color="gray" size="2">
                        {user.OperationTypes} operation types • {user.ActiveDays} active days
                      </Text>
                    </Box>
                  </Flex>
                  <Box style={{ textAlign: 'right' }}>
                    <Text weight="bold" size="3">{user.TotalOperations.toLocaleString()}</Text>
                    <Text color="gray" size="2">operations</Text>
                  </Box>
                </Flex>
              ))}
            </Flex>
          </Box>
        </Card>
      </Box>

      {/* Media Operations */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>Media Operations Breakdown</Heading>
            <Box style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.mediaOperations}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ActivityType" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="OperationCount" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Authentication Providers */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>Authentication Provider Usage</Heading>
            <Box style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.authProviders}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ Provider, SignInCount }) => `${Provider}: ${SignInCount}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="SignInCount"
                  >
                    {data.authProviders.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Card>
      </Box>
    </Container>
  );
}
